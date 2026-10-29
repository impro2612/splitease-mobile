import axios from "axios"
import * as SecureStore from "expo-secure-store"
import { router } from "expo-router"

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://splitwithease.vercel.app"

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
})

// Attach session token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("session_token")
  if (token) config.headers["Authorization"] = `Bearer ${token}`
  return config
})

// On 401, attempt silent token refresh once; if that also fails, sign out
let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

async function tryRefresh(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync("refresh_token")
  if (!refreshToken) return null
  try {
    const res = await axios.post(`${API_BASE_URL}/api/auth/mobile-refresh`, { refreshToken })
    const { token, refreshToken: newRefresh } = res.data
    // Refresh token first: if the app dies between the two writes, the next launch still
    // holds the NEW refresh token (an expired access token just triggers another refresh)
    await SecureStore.setItemAsync("refresh_token", newRefresh)
    await SecureStore.setItemAsync("session_token", token)
    return token
  } catch {
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      if (isRefreshing) {
        // Queue subsequent 401s until the in-flight refresh resolves
        return new Promise((resolve, reject) => {
          refreshQueue.push((newToken) => {
            if (newToken) {
              original.headers["Authorization"] = `Bearer ${newToken}`
              resolve(api(original))
            } else {
              reject(error)
            }
          })
        })
      }

      isRefreshing = true
      const newToken = await tryRefresh()
      isRefreshing = false

      refreshQueue.forEach((cb) => cb(newToken))
      refreshQueue = []

      if (newToken) {
        original.headers["Authorization"] = `Bearer ${newToken}`
        return api(original)
      }

      // Refresh failed — full sign-out (tokens, in-memory user AND the persisted query
      // cache). Lazy require: the auth store imports this module.
      const { useAuthStore } = require("@/store/auth") as typeof import("@/store/auth")
      await useAuthStore.getState().signOut()
      router.replace("/(auth)/signin")
    }
    // Trial ended / subscription lapsed while the app had stale status: refresh it so the
    // Plus locks show. Lazy require: query-client is created after this module.
    if (error.response?.status === 402 && error.response?.data?.code === "PLUS_REQUIRED") {
      const qc = (require("@/lib/query-client") as typeof import("@/lib/query-client")).default
      qc.invalidateQueries({ queryKey: ["plus-status"] })
    }
    return Promise.reject(error)
  }
)

// Auth endpoints
export const authApi = {
  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    api.post("/api/auth/register", data),

  signIn: (data: { email: string; password: string }) =>
    api.post("/api/auth/mobile-signin", data),

  googleSignIn: (idToken: string, mode: "signin" | "signup" = "signup") =>
    api.post("/api/auth/google", { idToken, mode }),
  appleSignIn: (identityToken: string, fullName: string, mode: "signin" | "signup" = "signup", authorizationCode?: string | null) =>
    api.post("/api/auth/apple", { identityToken, fullName, mode, authorizationCode }),

  savePhone: (phone: string) =>
    api.post("/api/auth/phone", { phone }),

  me: () => api.get("/api/auth/me"),

  forgotPassword: (email: string) =>
    api.post("/api/auth/forgot-password", { email }),

  resetPassword: (data: { email: string; token: string; newPassword: string }) =>
    api.post("/api/auth/reset-password", data),

  deleteAccount: () => api.delete("/api/auth/me"),
}

// Groups
export const groupsApi = {
  list: () => api.get("/api/groups"),
  get: (id: string) => api.get(`/api/groups/${id}`),
  create: (data: { name: string; color: string; emoji: string; imageUrl?: string | null; imageCredit?: GroupImageCredit | null; currency: string; location?: string; lat?: number; lng?: number; startDate?: string; endDate?: string }) =>
    api.post("/api/groups", data),
  update: (id: string, data: { name?: string; description?: string; emoji?: string; imageUrl?: string | null; imageCredit?: GroupImageCredit | null; color?: string; currency?: string; location?: string | null; lat?: number | null; lng?: number | null; startDate?: string | null; endDate?: string | null }) =>
    api.patch(`/api/groups/${id}`, data),
  delete: (id: string) => api.delete(`/api/groups/${id}`),
}

// Group photo suggestions (Wikipedia for places, Unsplash for the rest)
export type GroupImageCredit = { source: "wikipedia" | "unsplash"; name: string; link: string }
export type GroupImage = { url: string; thumb: string; credit: GroupImageCredit; downloadLocation?: string }
export const groupImageApi = {
  search: (params: { name: string; location?: string; theme?: string; page?: number }) =>
    api.get<{ images: GroupImage[]; hasMore: boolean }>("/api/group-image", { params }),
  select: (downloadLocation: string) => api.post("/api/group-image/select", { downloadLocation }),
  upload: (base64: string) => api.post<{ url: string }>("/api/group-photo", { data: base64 }),
}

// Members
export const membersApi = {
  add: (groupId: string, email: string) =>
    api.post(`/api/groups/${groupId}/members`, { email }),
  remove: (groupId: string, userId: string) =>
    api.delete(`/api/groups/${groupId}/members`, { data: { userId } }),
  setRole: (groupId: string, userId: string, role: "ADMIN" | "MEMBER") =>
    api.patch(`/api/groups/${groupId}/members/${userId}`, { role }),
}

// Expenses
export const expensesApi = {
  add: (groupId: string, data: {
    clientRequestId?: string; description: string; amount: number; category: string
    paidById: string; splitType: string; splits?: any[]; date?: string; currency?: string
  }) => api.post(`/api/groups/${groupId}/expenses`, data),
  update: (groupId: string, expenseId: string, data: {
    description?: string; amount?: number; category?: string
    paidById?: string; date?: string; currency?: string
    splitType?: string; splits?: { userId: string; amount: number }[]
  }) => api.patch(`/api/groups/${groupId}/expenses/${expenseId}`, data),
  delete: (groupId: string, expenseId: string) =>
    api.delete(`/api/groups/${groupId}/expenses/${expenseId}`),
}

// Balances & Settlements
export const balancesApi = {
  get: (groupId: string) => api.get(`/api/groups/${groupId}/balances`),
  settle: (groupId: string, data: { fromUserId?: string; toUserId: string; amount: number; note?: string; currency?: string }) =>
    api.post(`/api/groups/${groupId}/settle`, data),
  toggleSmartDebts: (groupId: string, enabled: boolean) =>
    api.patch(`/api/groups/${groupId}/smart-debts`, { enabled }),
}

// Friends
export const friendsApi = {
  list: () => api.get("/api/friends"),
  sync: () => api.post("/api/friends/sync"),
  send: (addresseeId: string) => api.post("/api/friends", { addresseeId }),
  respond: (id: string, action: "accept" | "reject") =>
    api.patch(`/api/friends/${id}`, { action }),
  remove: (id: string) => api.delete(`/api/friends/${id}`),
}

// Messages
export const messagesApi = {
  send: (data: { receiverId: string; content: string; clientId: string }) =>
    api.post("/api/messages", data),
  history: (friendId: string, params?: { after?: string; before?: string; limit?: number }) =>
    api.get(`/api/messages/${friendId}`, { params }),
  delete: (ids: string[]) =>
    api.delete("/api/messages", { data: { ids } }),
}

// User search
export const usersApi = {
  search: (q: string) => api.get(`/api/users/search?q=${encodeURIComponent(q)}`),
  lookupPhones: (phones: string[]) => api.post("/api/users/lookup-phones", { phones }),
}

// Blocks
export const blocksApi = {
  list: () => api.get("/api/blocks"),
  block: (blockedId: string) => api.post("/api/blocks", { blockedId }),
  unblock: (userId: string) => api.delete(`/api/blocks/${userId}`),
}

// Dashboard summary
export const dashboardApi = {
  summary: () => api.get("/api/balance-summary"),
  activity: () => api.get("/api/activity"),
}

// Push token registration
export const pushApi = {
  saveToken: (pushToken: string) => api.post("/api/auth/push-token", { pushToken }),
  clearToken: (pushToken: string) => api.delete("/api/auth/push-token", { data: { pushToken } }),
}

export const transactionsApi = {
  list:    (params?: { month?: string; category?: string; type?: string; page?: number }) =>
    api.get("/api/transactions", { params }),
  summary: (month?: string) =>
    api.get("/api/transactions/summary", { params: month ? { month } : {} }),
  insights: (month?: string) =>
    api.get("/api/transactions/insights", { params: month ? { month } : {} }),
  suggestions: (month: string) =>
    api.get("/api/transactions/suggestions", { params: { month } }),
  importCSV: (file: { uri: string; name: string; mimeType?: string }) => {
    const form = new FormData()
    form.append("file", { uri: file.uri, name: file.name, type: file.mimeType ?? "text/csv" } as unknown as Blob)
    return api.post("/api/transactions/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
  },
  importPDF: (file: { uri: string; name: string }, expectedMonth: string, password?: string) => {
    const form = new FormData()
    form.append("file", { uri: file.uri, name: file.name, type: "application/pdf" } as unknown as Blob)
    form.append("expectedMonth", expectedMonth)
    if (password) form.append("password", password)
    return api.post("/api/transactions/import-pdf", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 180000,
    })
  },
  updateCategory: (id: string, category: string) =>
    api.patch(`/api/transactions/${id}`, { category }),
  delete: (id: string) => api.delete(`/api/transactions/${id}`),
}

export const reactionsApi = {
  toggle: (groupId: string, expenseId: string, emoji: string) =>
    api.post(`/api/groups/${groupId}/expenses/${expenseId}/reactions`, { emoji }),
}

// Group chat — one chat per group
export const groupChatsApi = {
  list: () => api.get("/api/group-chats"),
  info: (groupId: string) => api.get(`/api/group-chats/${groupId}`),
  update: (groupId: string, data: { muted?: boolean; left?: boolean }) =>
    api.patch(`/api/group-chats/${groupId}`, data),
  history: (groupId: string, params?: { after?: string; before?: string; limit?: number }) =>
    api.get(`/api/group-chats/${groupId}/messages`, { params }),
  send: (groupId: string, data: { content: string; clientId: string }) =>
    api.post(`/api/group-chats/${groupId}/messages`, data),
  delete: (groupId: string, ids: string[]) =>
    api.delete(`/api/group-chats/${groupId}/messages`, { data: { ids } }),
  react: (groupId: string, messageId: string, emoji: string) =>
    api.post(`/api/group-chats/${groupId}/reactions`, { messageId, emoji }),
}

export const messageReactionsApi = {
  toggle: (messageId: string, emoji: string) =>
    api.post(`/api/messages/${messageId}/reactions`, { emoji }),
}

export const borrowBookApi = {
  list: () => api.get("/api/borrow-book"),
  create: (data: { friendId: string; amount: number; note?: string; iAmLender: boolean; currency?: string; date?: string }) =>
    api.post("/api/borrow-book", data),
  settle: (id: string) => api.patch(`/api/borrow-book/${id}`),
  delete: (id: string) => api.delete(`/api/borrow-book/${id}`),
  addPayment: (id: string, data: { amount: number; date?: string; note?: string }) =>
    api.post(`/api/borrow-book/${id}/payments`, data),
}

export const spendDiaryApi = {
  list: () => api.get("/api/spend-diary"),
  create: (title: string) => api.post("/api/spend-diary", { title }),
  delete: (id: string) => api.delete(`/api/spend-diary/${id}`),
  entries: (id: string) => api.get(`/api/spend-diary/${id}/entries`),
  addEntry: (id: string, data: { title: string; amount: number; currency?: string; date?: string }) =>
    api.post(`/api/spend-diary/${id}/entries`, data),
  editEntry: (id: string, entryId: string, data: { title: string; amount: number; currency?: string; date?: string }) =>
    api.patch(`/api/spend-diary/${id}/entries/${entryId}`, data),
  deleteEntry: (id: string, entryId: string) =>
    api.delete(`/api/spend-diary/${id}/entries/${entryId}`),
}

export const tripsApi = {
  list: () => api.get("/api/trips"),
  get: (id: string) => api.get(`/api/trips/${id}`),
  create: (data: {
    name: string; emoji?: string; startDate: string; endDate: string
    totalBudget: number; currency?: string; groupId?: string
    categories?: { category: string; amount: number }[]
  }) => api.post("/api/trips", data),
  update: (id: string, data: {
    name?: string; emoji?: string; startDate?: string; endDate?: string
    totalBudget?: number; currency?: string; status?: string; groupId?: string | null
    categories?: { category: string; amount: number }[]
  }) => api.patch(`/api/trips/${id}`, data),
  delete: (id: string) => api.delete(`/api/trips/${id}`),
}

export const budgetsApi = {
  list:   () => api.get("/api/budgets"),
  set:    (category: string, amount: number) => api.post("/api/budgets", { category, amount }),
  delete: (category: string) => api.delete("/api/budgets", { data: { category } }),
}

export const timelineApi = {
  pins: () => api.get("/api/timeline"),
}

export const plusApi = {
  status: () => api.get("/api/plus/status"),
  sync: () => api.post("/api/plus/sync"),
}

export const wrappedApi = {
  get: (year?: number) => api.get("/api/wrapped", { params: year ? { year } : {} }),
}

import axios from "axios"
import * as SecureStore from "expo-secure-store"
import { router } from "expo-router"

// ← Change this to your Next.js server URL
// For local dev: use your Mac's local network IP (e.g. http://192.168.1.5:3000)
// For production: use your deployed URL
// Replace with your ngrok URL when testing on a physical device
// e.g. export const API_BASE_URL = "https://abc123.ngrok-free.app"
export const API_BASE_URL = "https://splitwise-clone-umber.vercel.app"

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

// On 401, clear the session and send the user back to sign-in
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync("session_token")
      await SecureStore.deleteItemAsync("user_data")
      router.replace("/(auth)/signin")
    }
    return Promise.reject(error)
  }
)

// Auth endpoints
export const authApi = {
  register: (data: { name: string; email: string; phone: string; password: string }) =>
    api.post("/api/auth/register", data),

  signIn: (data: { email: string; password: string }) =>
    api.post("/api/auth/mobile-signin", data),

  me: () => api.get("/api/auth/me"),

  forgotPassword: (email: string) =>
    api.post("/api/auth/forgot-password", { email }),

  resetPassword: (data: { email: string; token: string; newPassword: string }) =>
    api.post("/api/auth/reset-password", data),
}

// Groups
export const groupsApi = {
  list: () => api.get("/api/groups"),
  get: (id: string) => api.get(`/api/groups/${id}`),
  create: (data: { name: string; description?: string; color: string; emoji: string; currency: string }) =>
    api.post("/api/groups", data),
  update: (id: string, data: { name?: string; description?: string; emoji?: string; color?: string; currency?: string }) =>
    api.patch(`/api/groups/${id}`, data),
  delete: (id: string) => api.delete(`/api/groups/${id}`),
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
    description: string; amount: number; category: string
    paidById: string; splitType: string; splits?: any[]; date?: string; currency?: string
  }) => api.post(`/api/groups/${groupId}/expenses`, data),
  update: (groupId: string, expenseId: string, data: {
    description?: string; amount?: number; category?: string
    paidById?: string; date?: string; currency?: string
  }) => api.patch(`/api/groups/${groupId}/expenses/${expenseId}`, data),
  delete: (groupId: string, expenseId: string) =>
    api.delete(`/api/groups/${groupId}/expenses/${expenseId}`),
}

// Balances & Settlements
export const balancesApi = {
  get: (groupId: string) => api.get(`/api/groups/${groupId}/balances`),
  settle: (groupId: string, data: { toUserId: string; amount: number; note?: string }) =>
    api.post(`/api/groups/${groupId}/settle`, data),
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
}

// User search
export const usersApi = {
  search: (q: string) => api.get(`/api/users/search?q=${encodeURIComponent(q)}`),
  lookupPhones: (phones: string[]) => api.post("/api/users/lookup-phones", { phones }),
}

// Dashboard summary
export const dashboardApi = {
  summary: (currency: string) => api.get("/api/balance-summary", { params: { currency } }),
}

// Push token registration
export const pushApi = {
  saveToken: (pushToken: string) => api.post("/api/auth/push-token", { pushToken }),
  clearToken: () => api.delete("/api/auth/push-token"),
}

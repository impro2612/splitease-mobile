import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import { Appearance } from "react-native"
import axios from "axios"
import { API_BASE_URL, authApi } from "@/lib/api"

export type ThemePref = "light" | "dark" | "system"

type User = {
  id: string
  name: string | null
  email: string
  image: string | null
}

type AuthState = {
  user: User | null
  token: string | null
  loading: boolean
  currency: string
  theme: ThemePref
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string, phone: string) => Promise<void>
  googleSignIn: (idToken: string, mode?: "signin" | "signup") => Promise<{ needsPhone: boolean }>
  signOut: () => Promise<void>
  loadSession: () => Promise<void>
  setUser: (user: User) => void
  setCurrency: (currency: string) => void
  setTheme: (theme: ThemePref) => void
}

function applyAppearance(theme: ThemePref) {
  if (theme === "system") {
    Appearance.setColorScheme(null)
  } else {
    Appearance.setColorScheme(theme)
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,
  currency: "INR",
  theme: "dark",

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync("session_token")
      const userJson = await SecureStore.getItemAsync("user_data")
      const currency = await SecureStore.getItemAsync("currency") ?? "INR"
      const theme = (await SecureStore.getItemAsync("theme") as ThemePref) ?? "dark"
      applyAppearance(theme)
      if (token && userJson) {
        set({ user: JSON.parse(userJson), token, loading: false, currency, theme })
      } else {
        set({ loading: false, currency, theme })
      }
    } catch {
      set({ loading: false })
    }
  },

  signIn: async (email, password) => {
    const res = await axios.post(`${API_BASE_URL}/api/auth/mobile-signin`, { email, password })
    const { token, refreshToken, user } = res.data
    await SecureStore.setItemAsync("session_token", token)
    if (refreshToken) await SecureStore.setItemAsync("refresh_token", refreshToken)
    await SecureStore.setItemAsync("user_data", JSON.stringify(user))
    set({ user, token })
  },

  signUp: async (name, email, password, phone) => {
    await axios.post(`${API_BASE_URL}/api/auth/register`, { name, email, password, phone })
    const res = await axios.post(`${API_BASE_URL}/api/auth/mobile-signin`, { email, password })
    const { token, refreshToken, user } = res.data
    await SecureStore.setItemAsync("session_token", token)
    if (refreshToken) await SecureStore.setItemAsync("refresh_token", refreshToken)
    await SecureStore.setItemAsync("user_data", JSON.stringify(user))
    set({ user, token })
  },

  googleSignIn: async (idToken: string, mode: "signin" | "signup" = "signup") => {
    const res = await authApi.googleSignIn(idToken, mode)
    const { token, refreshToken, user, needsPhone } = res.data
    await SecureStore.setItemAsync("session_token", token)
    if (refreshToken) await SecureStore.setItemAsync("refresh_token", refreshToken)
    await SecureStore.setItemAsync("user_data", JSON.stringify(user))
    set({ user, token })
    return { needsPhone: !!needsPhone }
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync("session_token")
    await SecureStore.deleteItemAsync("refresh_token")
    await SecureStore.deleteItemAsync("user_data")
    set({ user: null, token: null })
  },

  setUser: (user: User) => {
    set({ user })
    SecureStore.setItemAsync("user_data", JSON.stringify(user)).catch(() => {})
  },

  setCurrency: (currency: string) => {
    set({ currency })
    SecureStore.setItemAsync("currency", currency).catch(() => {})
  },

  setTheme: (theme: ThemePref) => {
    applyAppearance(theme)
    set({ theme })
    SecureStore.setItemAsync("theme", theme).catch(() => {})
  },
}))

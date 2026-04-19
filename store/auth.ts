import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import { Appearance } from "react-native"
import axios from "axios"
import { API_BASE_URL } from "@/lib/api"

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
  signUp: (name: string, email: string, phone: string, password: string) => Promise<void>
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
    const { token, user } = res.data
    await SecureStore.setItemAsync("session_token", token)
    await SecureStore.setItemAsync("user_data", JSON.stringify(user))
    set({ user, token })
  },

  signUp: async (name, email, phone, password) => {
    await axios.post(`${API_BASE_URL}/api/auth/register`, { name, email, phone, password })
    const res = await axios.post(`${API_BASE_URL}/api/auth/mobile-signin`, { email, password })
    const { token, user } = res.data
    await SecureStore.setItemAsync("session_token", token)
    await SecureStore.setItemAsync("user_data", JSON.stringify(user))
    set({ user, token })
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync("session_token")
    await SecureStore.deleteItemAsync("user_data")
    set({ user: null, token: null })
  },

  setUser: (user: User) => {
    SecureStore.setItemAsync("user_data", JSON.stringify(user))
    set({ user })
  },

  setCurrency: (currency: string) => {
    SecureStore.setItemAsync("currency", currency)
    set({ currency })
  },

  setTheme: (theme: ThemePref) => {
    SecureStore.setItemAsync("theme", theme)
    applyAppearance(theme)
    set({ theme })
  },
}))

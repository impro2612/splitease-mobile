import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import axios from "axios"
import { API_BASE_URL } from "@/lib/api"

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
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loadSession: () => Promise<void>
  setUser: (user: User) => void
  setCurrency: (currency: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: true,
  currency: "INR",

  loadSession: async () => {
    try {
      const token = await SecureStore.getItemAsync("session_token")
      const userJson = await SecureStore.getItemAsync("user_data")
      const currency = await SecureStore.getItemAsync("currency") ?? "INR"
      if (token && userJson) {
        set({ user: JSON.parse(userJson), token, loading: false, currency })
      } else {
        set({ loading: false, currency })
      }
    } catch {
      set({ loading: false })
    }
  },

  signIn: async (email, password) => {
    // We use the NextAuth credentials flow via a custom endpoint
    const res = await axios.post(`${API_BASE_URL}/api/auth/mobile-signin`, {
      email, password,
    })
    const { token, user } = res.data
    await SecureStore.setItemAsync("session_token", token)
    await SecureStore.setItemAsync("user_data", JSON.stringify(user))
    set({ user, token })
  },

  signUp: async (name, email, password) => {
    await axios.post(`${API_BASE_URL}/api/auth/register`, { name, email, password })
    // Auto sign in after registration
    const res = await axios.post(`${API_BASE_URL}/api/auth/mobile-signin`, {
      email, password,
    })
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
}))

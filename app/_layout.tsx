import "../global.css"
import { useEffect } from "react"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import Toast from "react-native-toast-message"
import * as SplashScreen from "expo-splash-screen"
import { useAuthStore } from "@/store/auth"

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

export default function RootLayout() {
  const { loadSession, loading } = useAuthStore()

  useEffect(() => {
    loadSession()
  }, [])

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [loading])

  if (loading) return null

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" backgroundColor="#0a0a1a" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0a0a1a" } }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="group/[id]/index" options={{ headerShown: false }} />
        </Stack>
        <Toast />
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}

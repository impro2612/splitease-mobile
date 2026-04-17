import "../global.css"
import { useEffect } from "react"
import { Platform, Keyboard, TouchableWithoutFeedback, View } from "react-native"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import Toast from "react-native-toast-message"
import * as SplashScreen from "expo-splash-screen"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { useAuthStore } from "@/store/auth"
import { pushApi } from "@/lib/api"

SplashScreen.preventAutoHideAsync()

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

async function registerForPushNotifications() {
  if (!Device.isDevice) return // won't work on emulator, but won't crash
  const { status: existing } = await Notifications.getPermissionsAsync()
  const { status } = existing === "granted"
    ? { status: existing }
    : await Notifications.requestPermissionsAsync()
  if (status !== "granted") return

  const token = await Notifications.getExpoPushTokenAsync().catch(() => null)
  if (token?.data) {
    await pushApi.saveToken(token.data).catch(() => {})
  }

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    })
  }
}

export default function RootLayout() {
  const { loadSession, loading, user } = useAuthStore()

  useEffect(() => {
    loadSession()
  }, [])

  // Register push token once user is logged in
  useEffect(() => {
    if (user) {
      registerForPushNotifications()
    }
  }, [user?.id])

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [loading])

  if (loading) return null

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            <StatusBar style="light" backgroundColor="#0a0a1a" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0a0a1a" } }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[friendId]" options={{ headerShown: false }} />
            </Stack>
            <Toast />
          </View>
        </TouchableWithoutFeedback>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}

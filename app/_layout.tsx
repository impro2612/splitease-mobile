import "../global.css"
import { useEffect } from "react"
import { Platform, View, Text, useColorScheme } from "react-native"
import { Stack, router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import Toast from "react-native-toast-message"
import { Ionicons } from "@expo/vector-icons"
import * as SplashScreen from "expo-splash-screen"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { useAuthStore } from "@/store/auth"
import { pushApi } from "@/lib/api"
import { getTrackConfig, clearTrackConfig } from "@/lib/trackExpense"
import { syncTrackConfigToNative } from "@/lib/nativeTrackExpense"

// ── Custom Toast UI ───────────────────────────────────────────────────────────
function ToastBase({
  text1,
  text2,
  iconName,
  accentColor,
  bgColor,
  borderColor,
}: {
  text1?: string
  text2?: string
  iconName: keyof typeof Ionicons.glyphMap
  accentColor: string
  bgColor: string
  borderColor: string
}) {
  return (
    <View style={{
      marginHorizontal: 16,
      borderRadius: 18,
      backgroundColor: bgColor,
      borderWidth: 1,
      borderColor,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 14,
      shadowColor: accentColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 12,
      minHeight: 60,
    }}>
      {/* Icon circle */}
      <View style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: accentColor + "22",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <Ionicons name={iconName} size={20} color={accentColor} />
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        {text1 ? (
          <Text style={{ color: "#f1f5f9", fontWeight: "700", fontSize: 14, lineHeight: 19 }}
            numberOfLines={2}>
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text style={{ color: "#94a3b8", fontWeight: "400", fontSize: 12, marginTop: 2 }}
            numberOfLines={2}>
            {text2}
          </Text>
        ) : null}
      </View>

      {/* Right accent bar */}
      <View style={{
        position: "absolute",
        left: 0,
        top: 10,
        bottom: 10,
        width: 3,
        borderRadius: 4,
        backgroundColor: accentColor,
      }} />
    </View>
  )
}

const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <ToastBase
      text1={text1}
      text2={text2}
      iconName="checkmark-circle"
      accentColor="#4ade80"
      bgColor="#0f1f17"
      borderColor="rgba(74,222,128,0.25)"
    />
  ),
  error: ({ text1, text2 }: any) => (
    <ToastBase
      text1={text1}
      text2={text2}
      iconName="close-circle"
      accentColor="#f87171"
      bgColor="#1f0f0f"
      borderColor="rgba(248,113,113,0.25)"
    />
  ),
  info: ({ text1, text2 }: any) => (
    <ToastBase
      text1={text1}
      text2={text2}
      iconName="information-circle"
      accentColor="#818cf8"
      bgColor="#0f0f1f"
      borderColor="rgba(129,140,248,0.25)"
    />
  ),
}

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
  const scheme = useColorScheme()

  useEffect(() => {
    loadSession()
    // Auto-expiry check on app open (Step 8)
    getTrackConfig().then((cfg) => {
      if (cfg === null) {
        // getTrackConfig already cleared expired config from AsyncStorage
        syncTrackConfigToNative(null).catch(() => {})
      }
    })
  }, [])

  // Register push token once user is logged in
  useEffect(() => {
    if (user) {
      registerForPushNotifications()
    }
  }, [user?.id])

  // Handle notification tap — deep link to confirm-expense
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined
      if (url?.startsWith("splitease://confirm-expense")) {
        const params = new URL(url.replace("splitease://", "https://x.com/")).searchParams
        const suggestionId = params.get("suggestionId")
        const groupId = params.get("groupId")
        if (suggestionId && groupId) {
          router.push(`/confirm-expense?suggestionId=${suggestionId}&groupId=${groupId}`)
        }
      }
    })
    return () => sub.remove()
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
        <View style={{ flex: 1 }}>
          <StatusBar style={scheme === "light" ? "dark" : "light"} backgroundColor={scheme === "light" ? "#f8fafc" : "#0a0a1a"} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: scheme === "light" ? "#f8fafc" : "#0a0a1a" } }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="chat/[friendId]" options={{ headerShown: false }} />
            <Stack.Screen name="confirm-expense" options={{ headerShown: false, presentation: "modal" }} />
          </Stack>
          <Toast config={toastConfig} visibilityTime={3000} topOffset={56} />
        </View>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}

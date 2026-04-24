import "../global.css"
import { useEffect, useRef, useState } from "react"
import { Platform, View, Text, useColorScheme, AppState, AppStateStatus } from "react-native"
import NetInfo from "@react-native-community/netinfo"
import { Stack, router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { useSafeAreaInsets } from "react-native-safe-area-context"
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
import { LaunchIntro } from "@/components/LaunchIntro"

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

// ── Offline Banner ────────────────────────────────────────────────────────────
function OfflineBanner() {
  const { top } = useSafeAreaInsets()
  return (
    <View style={{
      backgroundColor: "#1a1020",
      borderBottomWidth: 1,
      borderBottomColor: "rgba(248,113,113,0.3)",
      paddingTop: top + 6,
      paddingBottom: 6,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    }}>
      <Ionicons name="cloud-offline-outline" size={14} color="#f87171" />
      <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "600" }}>
        No internet connection
      </Text>
    </View>
  )
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
  if (!Device.isDevice) return

  const { status: existing } = await Notifications.getPermissionsAsync()
  const { status } = existing === "granted"
    ? { status: existing }
    : await Notifications.requestPermissionsAsync()
  if (status !== "granted") return

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    })
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: "24eaff5b-d54f-4cd4-a865-867a1cb0cfcb",
  }).catch(() => null)
  if (!token?.data) return

  // Retry up to 3 times with 3s gaps — token save often fails on slow startup network
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await pushApi.saveToken(token.data)
      return // success
    } catch {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 3000))
    }
  }
}

function handleAppUrl(url?: string) {
  if (!url?.startsWith("splitit://")) return

  const parsed = new URL(url.replace("splitit://", "https://splitit.local/"))
  const path = parsed.pathname.replace(/^\/+/, "")

  if (path === "confirm-expense") {
    const suggestionId = parsed.searchParams.get("suggestionId")
    const groupId = parsed.searchParams.get("groupId")
    if (suggestionId && groupId) {
      router.push(`/confirm-expense?suggestionId=${suggestionId}&groupId=${groupId}` as any)
    }
    return
  }

  if (path.startsWith("group/")) {
    const groupId = path.split("/")[1]
    if (groupId) router.push(`/group/${groupId}` as any)
    return
  }

  if (path === "groups") {
    router.push("/(tabs)/groups" as any)
    return
  }

  if (path === "friends") {
    router.push("/(tabs)/friends" as any)
    return
  }

  if (path.startsWith("chat/")) {
    const friendId = path.split("/")[1]
    const name = parsed.searchParams.get("name") ?? ""
    if (friendId) {
      router.push({
        pathname: "/chat/[friendId]",
        params: { friendId, name },
      } as any)
    }
  }
}

export default function RootLayout() {
  const { loadSession, loading, user } = useAuthStore()
  const scheme = useColorScheme()
  const [isOnline, setIsOnline] = useState(true)
  const [showLaunchIntro, setShowLaunchIntro] = useState(true)
  const prevOnlineRef = useRef<boolean | null>(null)

  useEffect(() => {
    NetInfo.fetch().then((state) => setIsOnline(!!state.isConnected && !!state.isInternetReachable))
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && !!state.isInternetReachable)
    })
    return () => unsubscribe()
  }, [])

  // Refetch all active queries the moment connectivity is restored
  useEffect(() => {
    if (prevOnlineRef.current === false && isOnline) {
      queryClient.refetchQueries({ type: "active" })
    }
    prevOnlineRef.current = isOnline
  }, [isOnline])

  useEffect(() => {
    loadSession()
    getTrackConfig().then((cfg) => {
      if (cfg === null) {
        // getTrackConfig already cleared expired config from AsyncStorage
        syncTrackConfigToNative(null).catch(() => {})
      }
    })
  }, [])

  // Register push token on login and every time the app comes to foreground
  useEffect(() => {
    if (!user) return
    registerForPushNotifications()

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") registerForPushNotifications()
    })
    return () => sub.remove()
  }, [user?.id])

  // Handle notification tap — deep link to confirm-expense
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined
      handleAppUrl(url)
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!loading) {
      requestAnimationFrame(() => {
        SplashScreen.hideAsync().catch(() => {})
      })

      const timer = setTimeout(() => {
        setShowLaunchIntro(false)
      }, 4000)

      return () => clearTimeout(timer)
    }
  }, [loading])

  if (loading) return null

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <StatusBar style={scheme === "light" ? "dark" : "light"} backgroundColor={scheme === "light" ? "#f8fafc" : "#0a0a1a"} />
          {showLaunchIntro ? (
            <LaunchIntro />
          ) : (
            <>
              {!isOnline && <OfflineBanner />}
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: scheme === "light" ? "#f8fafc" : "#0a0a1a" } }}>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="chat/[friendId]" options={{ headerShown: false }} />
                <Stack.Screen name="confirm-expense" options={{ headerShown: false, presentation: "modal" }} />
              </Stack>
            </>
          )}
          <Toast config={toastConfig} visibilityTime={3000} topOffset={56} />
        </View>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}

import { useState, useRef } from "react"
import { Tabs, Redirect, router } from "expo-router"
import { useAuthStore } from "@/store/auth"
import {
  View, Text, ActivityIndicator, TouchableOpacity,
  Modal, Animated, Pressable, StyleSheet, PanResponder,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"

const MORE_ITEMS = [
  {
    key: "borrow-book",
    icon: "book-outline" as const,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    title: "The Borrow Book",
    subtitle: "Track personal IOUs with friends",
    route: "/borrow-book",
  },
  {
    key: "trip-planner",
    icon: "airplane-outline" as const,
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    title: "Pre-Trip Budget Planner",
    subtitle: "Plan & track trip budgets together",
    route: "/trip-planner",
  },
  {
    key: "timeline",
    icon: "images-outline" as const,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    title: "Your Timeline",
    subtitle: "Relive your shared experiences",
    route: "/timeline",
  },
  {
    key: "memories",
    icon: "sparkles-outline" as const,
    color: "#f43f5e",
    bg: "rgba(244,63,94,0.12)",
    title: "Memories",
    subtitle: "Your year in money — shareable recap",
    route: "/memories",
  },
]

export default function TabsLayout() {
  const { user, loading } = useAuthStore()
  const { bottom } = useSafeAreaInsets()
  const C = useTheme()

  const [moreVisible, setMoreVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(300)).current
  const panY = useRef(new Animated.Value(0)).current
  const overlayAnim = useRef(new Animated.Value(0)).current

  // Combined translateY: open/close slide + live drag offset (clamped ≥ 0)
  const translateY = Animated.add(slideAnim, panY.interpolate({
    inputRange: [-9999, 0, 9999],
    outputRange: [0, 0, 9999],   // block upward drag, allow downward
  }))

  function openMore() {
    panY.setValue(0)
    setMoreVisible(true)
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }

  function closeMore(onDone?: () => void) {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      panY.setValue(0)
      setMoreVisible(false)
      onDone?.()
    })
  }

  function handleItem(route: string) {
    closeMore(() => router.push(route as any))
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        panY.setValue(g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          // Swipe fast or far enough — close
          panY.setValue(0)
          closeMore()
        } else {
          // Snap back
          Animated.spring(panY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start()
        }
      },
    })
  ).current

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#6366f1" />
      </View>
    )
  }
  if (!user) return <Redirect href="/(auth)/signin" />

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: C.tabBar,
            borderTopColor: C.tabBorder,
            borderTopWidth: 1,
            height: 64 + bottom,
            paddingBottom: bottom > 0 ? bottom + 4 : 10,
            paddingTop: 8,
          },
          tabBarActiveTintColor: "#6366f1",
          tabBarInactiveTintColor: C.textSub,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="expenses"
          options={{
            title: "Expenses",
            tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: "Friends",
            tabBarIcon: ({ color, size }) => <Ionicons name="person-add" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "More",
            // Intercept the press — show modal, never navigate to the more screen
            tabBarButton: (props) => (
              <TouchableOpacity
                style={[props.style as any, { alignItems: "center", justifyContent: "center", gap: 4 }]}
                onPress={openMore}
                activeOpacity={0.7}
              >
                <Ionicons name="grid-outline" size={24} color={moreVisible ? "#6366f1" : C.textSub} />
                <Text style={{ color: moreVisible ? "#6366f1" : C.textSub, fontSize: 11, fontWeight: "600" }}>
                  More
                </Text>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
          }}
        />
      </Tabs>

      {/* More bottom sheet — renders above the tab screens, preserving the screen behind */}
      <Modal transparent visible={moreVisible} animationType="none" onRequestClose={() => closeMore()}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)", opacity: overlayAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMore()} />
        </Animated.View>

        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: C.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: bottom + 20,
            transform: [{ translateY }],
          }}
        >
          {/* Drag handle — attach PanResponder here so list items still scroll */}
          <View {...panResponder.panHandlers} style={{ paddingBottom: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center" }} />
          </View>

          <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 2 }}>More</Text>
          <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 20 }}>Explore more features</Text>

          {MORE_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => handleItem(item.route)}
              activeOpacity={0.75}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingVertical: 14,
                paddingHorizontal: 14,
                backgroundColor: C.bg,
                borderRadius: 16,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: item.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textSub} />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Modal>
    </>
  )
}

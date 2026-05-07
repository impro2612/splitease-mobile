import { useEffect, useRef } from "react"
import {
  View, Text, TouchableOpacity, Modal, Animated,
  Pressable, StyleSheet,
} from "react-native"
import { useFocusEffect, router } from "expo-router"
import { useCallback, useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"

const ITEMS = [
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
    title: "Your Timeline & Memories",
    subtitle: "Relive your shared experiences",
    route: "/timeline",
  },
]

export default function MoreTab() {
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState(false)
  const slideAnim = useRef(new Animated.Value(300)).current
  const overlayAnim = useRef(new Animated.Value(0)).current

  function openSheet() {
    setVisible(true)
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }

  function closeSheet(onDone?: () => void) {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false)
      onDone?.()
    })
  }

  useFocusEffect(
    useCallback(() => {
      openSheet()
    }, [])
  )

  function handleItem(route: string) {
    closeSheet(() => router.push(route as any))
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Modal transparent visible={visible} animationType="none" onRequestClose={() => closeSheet()}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)", opacity: overlayAnim }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet()} />
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
            paddingBottom: insets.bottom + 20,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Handle bar */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 20 }} />

          <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 4 }}>More</Text>
          <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 20 }}>Explore more features</Text>

          {ITEMS.map((item) => (
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
    </View>
  )
}

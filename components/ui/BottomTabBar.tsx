import { useRef, useState } from "react"
import {
  View, Text, TouchableOpacity, Modal, Animated,
  PanResponder, Pressable, StyleSheet, useWindowDimensions,
} from "react-native"
import { router, usePathname } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"

const TABS = [
  { name: "SplitBoard", route: "/(tabs)/dashboard", icon: "home" as const },
  { name: "Expenses",   route: "/(tabs)/expenses",  icon: "receipt-outline" as const },
  { name: "Friends",    route: "/(tabs)/friends",   icon: "person-add" as const },
  { name: "More",       route: "",                  icon: "grid-outline" as const },
  { name: "Profile",    route: "/(tabs)/profile",   icon: "person-circle" as const },
]

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
    key: "scrapbook",
    icon: "sparkles-outline" as const,
    color: "#f43f5e",
    bg: "rgba(244,63,94,0.12)",
    title: "Your ScrapBook",
    subtitle: "Your year in money — shareable recap",
    route: "/scrapbook",
  },
]

interface Props {
  activeTab?: string
}

export function BottomTabBar({ activeTab }: Props) {
  const { bottom } = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const C = useTheme()
  const pathname = usePathname()

  const [moreVisible, setMoreVisible] = useState(false)
  const hiddenY = Math.max(300, height)
  const slideAnim = useRef(new Animated.Value(hiddenY)).current
  const panY = useRef(new Animated.Value(0)).current
  const overlayAnim = useRef(new Animated.Value(0)).current

  const translateY = Animated.add(
    slideAnim,
    panY.interpolate({ inputRange: [-9999, 0, 9999], outputRange: [0, 0, 9999] })
  )

  function openMore() {
    panY.setValue(0)
    slideAnim.setValue(hiddenY)
    setMoreVisible(true)
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }

  function closeMore(onDone?: () => void) {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: hiddenY, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { panY.setValue(0); setMoreVisible(false); onDone?.() })
  }

  const shouldDrag = (_: any, g: any) => g.dy > 8 && g.dy > Math.abs(g.dx)
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: shouldDrag,
    onMoveShouldSetPanResponderCapture: shouldDrag,
    onPanResponderMove: (_: any, g: any) => { if (g.dy > 0) panY.setValue(g.dy) },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_: any, g: any) => {
      if (g.dy > 80 || g.vy > 0.5) { slideAnim.setValue(Math.max(0, g.dy)); panY.setValue(0); closeMore() }
      else Animated.spring(panY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start()
    },
  })).current

  const headerPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: shouldDrag,
    onMoveShouldSetPanResponderCapture: shouldDrag,
    onPanResponderMove: (_: any, g: any) => { if (g.dy > 0) panY.setValue(g.dy) },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_: any, g: any) => {
      if (g.dy > 80 || g.vy > 0.5) { slideAnim.setValue(Math.max(0, g.dy)); panY.setValue(0); closeMore() }
      else Animated.spring(panY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start()
    },
  })).current

  const paddingBottom = bottom > 0 ? bottom + 4 : 10
  const barHeight = 64 + (bottom > 0 ? bottom : 0)

  return (
    <>
      <View style={{ height: barHeight, backgroundColor: C.tabBar, borderTopWidth: 1, borderTopColor: C.tabBorder, flexDirection: "row", paddingBottom, paddingTop: 8, elevation: 8 }}>
        {TABS.map((tab) => {
          const isMore = tab.name === "More"
          const isActive = isMore
            ? moreVisible
            : activeTab
              ? tab.name === activeTab
              : pathname.startsWith(tab.route.replace("/(tabs)", ""))
          const color = isActive ? "#6366f1" : C.textSub
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => isMore ? openMore() : router.push(tab.route as any)}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}
            >
              <Ionicons name={tab.icon} size={24} color={color} />
              <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{tab.name}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <Modal transparent visible={moreVisible} animationType="none" onRequestClose={() => closeMore()}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)", opacity: overlayAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeMore()} />
        </Animated.View>
        <Animated.View
          {...pan.panHandlers}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: bottom + 20, transform: [{ translateY }] }}
        >
          <View {...headerPan.panHandlers}>
            <View style={{ paddingBottom: 12 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center" }} />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 2 }}>More</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 20 }}>Explore more features</Text>
          </View>
          {MORE_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => closeMore(() => router.push(item.route as any))}
              activeOpacity={0.75}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: C.bg, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border }}
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

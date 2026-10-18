import { useEffect, useRef, useState } from "react"
import { View, TouchableOpacity, Modal, Animated, PanResponder, Pressable, StyleSheet, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text } from "@/components/ui/Typography"
import { tokens, useTheme } from "@/lib/theme"
import { MORE_ITEMS } from "@/lib/navigation"
import { haptic } from "@/lib/haptics"
import { PLUS_FEATURES, usePlus } from "@/lib/plus"

/** The More menu, shared by the tab layout and the stacked-screen tab bar. */
export function MoreSheet({ visible, onClose, onSelect, disabled }: {
  visible: boolean
  onClose: () => void
  onSelect: (route: string) => void
  disabled?: boolean
}) {
  const C = useTheme()
  const { locked } = usePlus()
  const { bottom } = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const hiddenY = Math.max(300, height)
  const [mounted, setMounted] = useState(visible)
  const slide = useRef(new Animated.Value(hiddenY)).current
  const panY = useRef(new Animated.Value(0)).current
  const overlay = useRef(new Animated.Value(0)).current
  const translateY = Animated.add(slide, panY.interpolate({ inputRange: [-9999, 0, 9999], outputRange: [0, 0, 9999] }))

  useEffect(() => {
    if (visible) {
      setMounted(true)
      panY.setValue(0)
      slide.setValue(hiddenY)
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(overlay, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  function close(then?: () => void) {
    Animated.parallel([
      Animated.timing(slide, { toValue: hiddenY, duration: 220, useNativeDriver: true }),
      Animated.timing(overlay, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { panY.setValue(0); setMounted(false); onClose(); then?.() })
  }

  // A downward drag anywhere on the sheet closes it; menu rows still get taps first.
  const shouldDrag = (_: any, g: any) => g.dy > 8 && g.dy > Math.abs(g.dx)
  const drag = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: shouldDrag,
    onMoveShouldSetPanResponderCapture: shouldDrag,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy) },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) close()
      else Animated.spring(panY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start()
    },
  })).current

  if (!mounted) return null
  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close()}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.overlay, opacity: overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />
      </Animated.View>
      <Animated.View {...drag.panHandlers} style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopLeftRadius: tokens.radius.xl, borderTopRightRadius: tokens.radius.xl, paddingHorizontal: tokens.space.xl, paddingBottom: bottom + 16, transform: [{ translateY }] }}>
        <View style={{ paddingTop: 12, paddingBottom: 14 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, alignSelf: "center", marginBottom: 14 }} />
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>More</Text>
        </View>
        {locked && (
          <TouchableOpacity
            disabled={disabled}
            onPress={() => { haptic.tap(); close(() => onSelect("/plus")) }}
            activeOpacity={0.8}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginBottom: 6, borderRadius: tokens.radius.md, backgroundColor: tokens.accentSoft, borderWidth: 1, borderColor: tokens.accentBorder }}
          >
            <Ionicons name="sparkles" size={18} color={C.accentText} />
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "600", flex: 1 }}>Your free trial has ended. Get Plus to unlock all features.</Text>
            <Ionicons name="chevron-forward" size={16} color={C.accentText} />
          </TouchableOpacity>
        )}
        {MORE_ITEMS.map((item) => {
          const gated = locked && PLUS_FEATURES.has(item.key)
          // Borrow Book still opens view-only, so friends' IOUs can be seen and confirmed
          const route = gated && item.key !== "borrow-book" ? "/plus" : item.route
          return (
            <TouchableOpacity
              key={item.key}
              disabled={disabled}
              onPress={() => { haptic.tap(); close(() => onSelect(route)) }}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 11, opacity: disabled ? 0.4 : 1 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: gated ? C.iconBg : item.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={item.icon} size={20} color={gated ? C.textMuted : item.color} />
              </View>
              <View style={{ flex: 1, opacity: gated ? 0.5 : 1 }}>
                <Text style={{ color: C.text, fontSize: 15, fontWeight: "600" }}>{item.title}</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 1 }}>{item.subtitle}</Text>
              </View>
              {gated ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: tokens.accentSoft }}>
                  <Ionicons name="lock-closed" size={11} color={C.accentText} />
                  <Text style={{ color: C.accentText, fontSize: 11, fontWeight: "700" }}>Plus</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              )}
            </TouchableOpacity>
          )
        })}
      </Animated.View>
    </Modal>
  )
}

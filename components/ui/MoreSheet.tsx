import { useEffect, useRef, useState } from "react"
import { View, TouchableOpacity, Modal, Animated, PanResponder, Pressable, StyleSheet, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text } from "@/components/ui/Typography"
import { tokens, useTheme } from "@/lib/theme"
import { MORE_ITEMS } from "@/lib/navigation"
import { haptic } from "@/lib/haptics"

/** The More menu, shared by the tab layout and the stacked-screen tab bar. */
export function MoreSheet({ visible, onClose, onSelect, disabled }: {
  visible: boolean
  onClose: () => void
  onSelect: (route: string) => void
  disabled?: boolean
}) {
  const C = useTheme()
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

  // Only the handle/header area takes drag gestures; menu rows keep normal taps.
  const drag = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
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
      <Animated.View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopLeftRadius: tokens.radius.xl, borderTopRightRadius: tokens.radius.xl, paddingHorizontal: tokens.space.xl, paddingBottom: bottom + 16, transform: [{ translateY }] }}>
        <View {...drag.panHandlers} style={{ paddingTop: 12, paddingBottom: 14 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, alignSelf: "center", marginBottom: 14 }} />
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>More</Text>
        </View>
        {MORE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.key}
            disabled={disabled}
            onPress={() => { haptic.tap(); close(() => onSelect(item.route)) }}
            activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 11, opacity: disabled ? 0.4 : 1 }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: item.bg, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: "600" }}>{item.title}</Text>
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 1 }}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  )
}

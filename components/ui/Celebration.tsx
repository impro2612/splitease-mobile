import { useEffect, useMemo, useRef } from "react"
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native"
import { Text } from "@/components/ui/Typography"
import { tokens } from "@/lib/theme"

const PIECES = ["🎉", "✨", "🎊", "💸", "✨", "🎉"]

/**
 * A short confetti burst + "All settled up!" badge, shown when a debt is fully cleared.
 * Purely decorative: never blocks touches, removes itself after ~1.8 s via onDone.
 */
export function Celebration({ visible, onDone, message = "All settled up!" }: { visible: boolean; onDone: () => void; message?: string }) {
  const { width, height } = useWindowDimensions()
  const progress = useRef(new Animated.Value(0)).current
  const badge = useRef(new Animated.Value(0)).current

  // Random but stable flight paths for this burst
  const particles = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      emoji: PIECES[i % PIECES.length],
      dx: (Math.random() - 0.5) * width * 0.9,
      dy: -(height * 0.25 + Math.random() * height * 0.3),
      rotate: `${Math.round((Math.random() - 0.5) * 540)}deg`,
      size: 18 + Math.random() * 14,
    })),
    // new paths for every burst
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible]
  )

  useEffect(() => {
    if (!visible) return
    progress.setValue(0)
    badge.setValue(0)
    Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.spring(badge, { toValue: 1, tension: 120, friction: 7, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(badge, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
    ]).start(() => onDone())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  if (!visible) return null
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 2000, alignItems: "center", justifyContent: "center" }]}>
      {particles.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            top: height * 0.55,
            fontSize: p.size,
            opacity: progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, p.dy, p.dy + 80] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", p.rotate] }) },
            ],
          }}
        >
          {p.emoji}
        </Animated.Text>
      ))}
      <Animated.View
        style={{
          backgroundColor: tokens.positive,
          borderRadius: 999,
          paddingHorizontal: 22,
          paddingVertical: 12,
          opacity: badge,
          transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }}
      >
        <Text style={{ color: "#06240f", fontSize: 16, fontWeight: "800" }}>{message}</Text>
      </Animated.View>
    </View>
  )
}

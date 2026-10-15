import { useEffect, useRef } from "react"
import { Animated, View, type ViewStyle } from "react-native"
import { tokens, useTheme } from "@/lib/theme"

/** Pulsing placeholder block shown while data loads (instead of a lone spinner). */
export function Skeleton({ width = "100%", height = 16, radius = 8, style }: {
  width?: ViewStyle["width"]; height?: number; radius?: number; style?: ViewStyle
}) {
  const C = useTheme()
  const pulse = useRef(new Animated.Value(0.45)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: C.iconBg, opacity: pulse }, style]} />
}

/** A list-row shaped skeleton: avatar tile + two lines + trailing amount. */
export function SkeletonRow() {
  const C = useTheme()
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: tokens.space.lg, backgroundColor: C.card, borderRadius: tokens.radius.lg, marginBottom: 10 }}>
      <Skeleton width={42} height={42} radius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="60%" height={13} />
        <Skeleton width="35%" height={11} />
      </View>
      <Skeleton width={64} height={14} />
    </View>
  )
}

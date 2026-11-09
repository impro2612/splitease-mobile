import { useState, useEffect, useRef } from "react"
import { View, Animated } from "react-native"
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg"
import { Text } from "@/components/ui/Typography"
import { useTheme } from "@/lib/theme"
import { formatCurrency } from "@/lib/utils"

// Insights-tab charts for a group (pure presentational, animated on mount)

const AnimatedPath = Animated.createAnimatedComponent(Path)
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"

export const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#f87171", "#38bdf8", "#a78bfa", "#fb923c", "#34d399"]

export function AnimatedPieChart({ data, size = 240, symbol = "$", code = "USD" }: {
  data: { name: string; amount: number; color: string }[]
  size?: number
  symbol?: string
  code?: string
}) {
  const C = useTheme()
  const [selected, setSelected] = useState<number | null>(null)
  const mountAnim = useRef(new Animated.Value(0)).current
  const segAnims = useRef(data.map(() => new Animated.Value(0))).current

  useEffect(() => {
    Animated.spring(mountAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }).start()
    Animated.stagger(120, segAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true })
    )).start()
  }, [])

  const total = data.reduce((s, d) => s + d.amount, 0)
  if (total === 0) return null

  const cx = size / 2, cy = size / 2
  const outerR = size * 0.43, innerR = size * 0.265
  const explodeD = 12

  let angle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const frac = d.amount / total
    const sweep = frac * 2 * Math.PI
    const mid = angle + sweep / 2
    const end = angle + sweep
    const large = sweep > Math.PI ? 1 : 0
    const ox1 = cx + outerR * Math.cos(angle), oy1 = cy + outerR * Math.sin(angle)
    const ox2 = cx + outerR * Math.cos(end), oy2 = cy + outerR * Math.sin(end)
    const ix1 = cx + innerR * Math.cos(end), iy1 = cy + innerR * Math.sin(end)
    const ix2 = cx + innerR * Math.cos(angle), iy2 = cy + innerR * Math.sin(angle)
    const path = `M${ox1},${oy1} A${outerR},${outerR},0,${large},1,${ox2},${oy2} L${ix1},${iy1} A${innerR},${innerR},0,${large},0,${ix2},${iy2}Z`
    const tx = Math.cos(mid) * explodeD, ty = Math.sin(mid) * explodeD
    angle = end
    return { ...d, path, mid, tx, ty, frac, i }
  })

  const sel = selected !== null ? slices[selected] : null

  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View style={{ opacity: mountAnim, transform: [{ scale: mountAnim }] }}>
        <Svg width={size} height={size + 8}>
          <Defs>
            {slices.map((s, i) => (
              <LinearGradient key={i} id={`lg${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                <Stop offset="100%" stopColor={s.color} stopOpacity="1" />
              </LinearGradient>
            ))}
          </Defs>

          {/* 3D depth layers — two shadow offset copies per segment */}
          {slices.map((s, i) => {
            const isSel = selected === i
            const ox = isSel ? s.tx : 0, oy = isSel ? s.ty : 0
            return (
              <G key={`depth${i}`}>
                <Path d={s.path} fill={s.color} opacity={0.18} transform={`translate(${ox},${oy + 7})`} />
                <Path d={s.path} fill={s.color} opacity={0.12} transform={`translate(${ox},${oy + 12})`} />
              </G>
            )
          })}

          {/* Glow ring on selected */}
          {sel && (
            <Path
              d={sel.path}
              fill="none"
              stroke={sel.color}
              strokeWidth={8}
              opacity={0.25}
              transform={`translate(${sel.tx},${sel.ty})`}
            />
          )}

          {/* Main segments with stagger fade-in */}
          {slices.map((s, i) => {
            const isSel = selected === i
            return (
              <AnimatedPath
                key={`seg${i}`}
                d={s.path}
                fill={`url(#lg${i})`}
                stroke={isSel ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)"}
                strokeWidth={isSel ? 2.5 : 1.5}
                transform={isSel ? `translate(${s.tx},${s.ty})` : "translate(0,0)"}
                opacity={segAnims[i] as any}
                onPress={() => setSelected(selected === i ? null : i)}
              />
            )
          })}

          {/* Center hole */}
          <Circle cx={cx} cy={cy} r={innerR - 2} fill={C.card} />
          {/* Subtle inner ring */}
          <Circle cx={cx} cy={cy} r={innerR - 2} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />

          {/* Center content */}
          {sel ? (
            <G>
              <Circle cx={cx} cy={cy} r={innerR - 4} fill={sel.color} opacity={0.08} />
              <SvgText x={cx} y={cy - 10} textAnchor="middle" fill={sel.color} fontSize="9" fontWeight="bold" letterSpacing="1.5">
                {sel.name.slice(0, 12).toUpperCase()}
              </SvgText>
              <SvgText x={cx} y={cy + 10} textAnchor="middle" fill={C.text} fontSize="16" fontWeight="bold">
                {formatCurrency(sel.amount, symbol, code)}
              </SvgText>
            </G>
          ) : (
            <G>
              <SvgText x={cx} y={cy - 7} textAnchor="middle" fill="#64748b" fontSize="9" letterSpacing="2">
                TOTAL
              </SvgText>
              <SvgText x={cx} y={cy + 11} textAnchor="middle" fill={C.text} fontSize="15" fontWeight="bold">
                {formatCurrency(total, symbol, code)}
              </SvgText>
            </G>
          )}
        </Svg>
      </Animated.View>
      <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2, fontStyle: "italic" }}>Tap a slice to explore</Text>
    </View>
  )
}

export function BarChart({ data, maxAmt, barHeight, symbol, code }: {
  data: { name: string; amount: number; color: string }[]
  maxAmt: number
  barHeight: number
  symbol: string
  code: string
}) {
  const C = useTheme()
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current
  useEffect(() => {
    Animated.stagger(100, barAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 55, friction: 8, useNativeDriver: false })
    )).start()
  }, [])

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20 }}>
      <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 20 }}>Who Paid the Most</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: barHeight + 40 }}>
        {data.map((d, i) => {
          const heightPct = maxAmt > 0 ? d.amount / maxAmt : 0
          const barH = barAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, barHeight * heightPct] })
          return (
            <View key={i} style={{ alignItems: "center", flex: 1, gap: 6 }}>
              {/* Amount label */}
              <Animated.Text style={{ color: d.color, fontSize: 10, fontWeight: "700", opacity: barAnims[i] }}>
                {symbol}{d.amount >= 1000 ? `${(d.amount / 1000).toFixed(1)}k` : d.amount.toFixed(0)}
              </Animated.Text>
              {/* Bar */}
              <View style={{ width: "60%", height: barHeight, justifyContent: "flex-end" }}>
                <Animated.View style={{
                  height: barH,
                  backgroundColor: d.color,
                  borderRadius: 8,
                  width: "100%",
                  shadowColor: d.color,
                  shadowOpacity: 0.4,
                  shadowRadius: 6,
                }} />
              </View>
              {/* Name */}
              <Text style={{ color: C.textSub, fontSize: 10, fontWeight: "600", textAlign: "center" }} numberOfLines={1}>
                {d.name}
              </Text>
            </View>
          )
        })}
      </View>
      {/* Baseline */}
      <View style={{ height: 1, backgroundColor: C.iconBg, marginTop: 4 }} />
    </View>
  )
}

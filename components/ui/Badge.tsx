import { View, Text } from "react-native"
import { useTheme } from "@/lib/theme"

type Variant = "default" | "success" | "danger" | "warning" | "secondary"

const colorMap: Record<Variant, { bg: string; text: string }> = {
  default:   { bg: "rgba(99,102,241,0.2)",  text: "#a5b4fc" },
  success:   { bg: "rgba(34,197,94,0.2)",   text: "#86efac" },
  danger:    { bg: "rgba(244,63,94,0.2)",   text: "#fda4af" },
  warning:   { bg: "rgba(245,158,11,0.2)",  text: "#fcd34d" },
  secondary: { bg: "", text: "" }, // set dynamically from theme
}

export function Badge({ label, variant = "default" }: { label: string; variant?: Variant }) {
  const C = useTheme()
  const bg = variant === "secondary" ? C.iconBg : colorMap[variant].bg
  const color = variant === "secondary" ? C.textSub : colorMap[variant].text
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  )
}

import { View } from "react-native"
import { Text } from "@/components/ui/Typography"
import { useTheme } from "@/lib/theme"

type Variant = "default" | "success" | "danger" | "warning" | "secondary"

export function Badge({ label, variant = "default" }: { label: string; variant?: Variant }) {
  const C = useTheme()
  // Text colours come from the theme so badges stay readable on light cards too
  const colorMap: Record<Variant, { bg: string; text: string }> = {
    default:   { bg: "rgba(99,102,241,0.2)",  text: C.accentText },
    success:   { bg: "rgba(34,197,94,0.2)",   text: C.isDark ? "#86efac" : C.positive },
    danger:    { bg: "rgba(244,63,94,0.2)",   text: C.isDark ? "#fda4af" : C.negative },
    warning:   { bg: "rgba(245,158,11,0.2)",  text: C.isDark ? "#fcd34d" : "#b45309" },
    secondary: { bg: C.iconBg, text: C.textSub },
  }
  const { bg, text: color } = colorMap[variant]
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  )
}

import { View, Text } from "react-native"

type Variant = "default" | "success" | "danger" | "warning" | "secondary"

const styles: Record<Variant, { bg: string; text: string }> = {
  default:   { bg: "rgba(99,102,241,0.2)",  text: "#a5b4fc" },
  success:   { bg: "rgba(34,197,94,0.2)",   text: "#86efac" },
  danger:    { bg: "rgba(244,63,94,0.2)",   text: "#fda4af" },
  warning:   { bg: "rgba(245,158,11,0.2)",  text: "#fcd34d" },
  secondary: { bg: "rgba(255,255,255,0.1)", text: "#94a3b8" },
}

export function Badge({ label, variant = "default" }: { label: string; variant?: Variant }) {
  const s = styles[variant]
  return (
    <View style={{ backgroundColor: s.bg }} className="rounded-full px-2.5 py-0.5 self-start">
      <Text style={{ color: s.text }} className="text-xs font-semibold">{label}</Text>
    </View>
  )
}

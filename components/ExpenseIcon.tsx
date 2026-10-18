import { View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { getExpenseIcon, iconTint } from "@/lib/expense-icons"

/** Tinted line-icon tile for an expense (replaces the old per-expense emoji). */
export function ExpenseIcon({ description, size = 42, radius = 12 }: { description: string | null | undefined; size?: number; radius?: number }) {
  const { icon, color } = getExpenseIcon(description)
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: iconTint(color), alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={icon} size={Math.round(size * 0.47)} color={color} />
    </View>
  )
}

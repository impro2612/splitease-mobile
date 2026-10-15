import { View, type TextStyle } from "react-native"
import { Text } from "@/components/ui/Typography"
import { splitAmount } from "@/lib/utils"

/**
 * Hero amount: large whole part, small faded paise ("₹25,889.29" → "₹25,889" + ".29").
 * Tabular figures keep digits aligned. Shows the magnitude; callers add wording/sign.
 */
export function Money({ amount, symbol, code, size = 32, color, style }: {
  amount: number
  symbol: string
  code: string
  size?: number
  color: string
  style?: TextStyle
}) {
  const { whole, fraction } = splitAmount(amount, code)
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      <Text style={[{ color, fontSize: size, fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: -0.5 }, style]}>
        {symbol}{whole}
      </Text>
      {fraction ? (
        <Text style={{ color, opacity: 0.55, fontSize: Math.round(size * 0.5), fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          .{fraction}
        </Text>
      ) : null}
    </View>
  )
}

import { View, type ViewProps } from "react-native"
import { useTheme } from "@/lib/theme"

export function Card({ children, style, ...props }: ViewProps) {
  const C = useTheme()
  return (
    <View
      style={[{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16 }, style]}
      {...props}
    >
      {children}
    </View>
  )
}

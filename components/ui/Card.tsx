import { View, type ViewProps } from "react-native"

export function Card({ className, children, style, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      style={[{ backgroundColor: "#1a1a2e", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 16 }, style]}
      {...props}
    >
      {children}
    </View>
  )
}

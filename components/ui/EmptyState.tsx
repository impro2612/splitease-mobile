import { View, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "@/components/ui/Typography"
import { tokens, useTheme } from "@/lib/theme"

/** The one empty-state pattern: icon in a soft accent tile, title, one line, at most one action. */
export function EmptyState({ icon, title, subtitle, actionLabel, actionIcon, onAction, disabled }: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  actionLabel?: string
  actionIcon?: keyof typeof Ionicons.glyphMap
  onAction?: () => void
  disabled?: boolean
}) {
  const C = useTheme()
  return (
    <View style={{ alignItems: "center", paddingVertical: 56, paddingHorizontal: 32 }}>
      <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: tokens.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Ionicons name={icon} size={32} color={tokens.accentText} />
      </View>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 6 }}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          disabled={disabled}
          style={{ marginTop: 22, backgroundColor: tokens.accent, borderRadius: tokens.radius.md, paddingHorizontal: 22, height: 48, flexDirection: "row", alignItems: "center", gap: 8, opacity: disabled ? 0.4 : 1 }}
        >
          {actionIcon ? <Ionicons name={actionIcon} size={18} color="#fff" /> : null}
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

import { View, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "@/components/ui/Typography"
import { tokens, useTheme, type Accent } from "@/lib/theme"

/** The one empty-state pattern: icon in a soft accent tile, title, one line, at most one action. */
export function EmptyState({ icon, title, subtitle, actionLabel, actionIcon, onAction, disabled, accent }: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  actionLabel?: string
  actionIcon?: keyof typeof Ionicons.glyphMap
  onAction?: () => void
  disabled?: boolean
  /** Feature colour; defaults to the app accent */
  accent?: Accent
}) {
  const C = useTheme()
  const a = accent ?? { solid: tokens.accent, onSolid: "#fff", text: C.accentText, textLight: C.accentText, soft: tokens.accentSoft, border: tokens.accentBorder }
  return (
    <View style={{ alignItems: "center", paddingVertical: 56, paddingHorizontal: 32 }}>
      <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: a.soft, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Ionicons name={icon} size={32} color={a.text} />
      </View>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 6 }}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          disabled={disabled}
          style={{ marginTop: 22, backgroundColor: a.solid, borderRadius: tokens.radius.md, paddingHorizontal: 22, height: 48, flexDirection: "row", alignItems: "center", gap: 8, opacity: disabled ? 0.4 : 1 }}
        >
          {actionIcon ? <Ionicons name={actionIcon} size={18} color={a.onSolid} /> : null}
          <Text style={{ color: a.onSolid, fontWeight: "700", fontSize: 15 }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

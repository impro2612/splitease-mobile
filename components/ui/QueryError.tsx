import { View, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "@/components/ui/Typography"
import { tokens, useTheme } from "@/lib/theme"

/** Shown in place of a list when its query failed; one retry button. */
export function QueryError({ title = "Couldn't load", message = "Check your connection and try again.", onRetry, retrying }: {
  title?: string
  message?: string
  onRetry: () => void
  retrying?: boolean
}) {
  const C = useTheme()
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 32 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(248,113,113,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Ionicons name="cloud-offline-outline" size={28} color={C.negative} />
      </View>
      <Text style={{ color: C.text, fontSize: 17, fontWeight: "700", textAlign: "center" }}>{title}</Text>
      <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 }}>{message}</Text>
      <TouchableOpacity
        onPress={onRetry}
        disabled={retrying}
        style={{ marginTop: 18, backgroundColor: tokens.accent, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 10, opacity: retrying ? 0.6 : 1 }}
        accessibilityLabel="Retry"
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{retrying ? "Retrying…" : "Retry"}</Text>
      </TouchableOpacity>
    </View>
  )
}

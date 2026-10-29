import { useRef } from "react"
import { TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import Toast from "react-native-toast-message"
import { Text } from "@/components/ui/Typography"
import { useTheme } from "@/lib/theme"
import { haptic } from "@/lib/haptics"
import { suggestGroupIcons } from "@/lib/group-icon"

// "Auto generate" on the group icon picker: picks the emoji + colour that best fit the
// group's name and trip location. Tapping again cycles to the next-best match.
export function AutoIconButton({ name, location, onPick }: {
  name: string
  location?: string | null
  onPick: (emoji: string, color: string) => void
}) {
  const C = useTheme()
  const cycle = useRef<{ key: string; index: number }>({ key: "", index: -1 })

  function generate() {
    if (!name.trim() && !location?.trim()) {
      Toast.show({ type: "info", text1: "Type a group name first", text2: "We'll pick an icon that matches it." })
      return
    }
    const key = `${name.trim().toLowerCase()}|${(location ?? "").trim().toLowerCase()}`
    const options = suggestGroupIcons(name, location)
    const index = cycle.current.key === key ? (cycle.current.index + 1) % options.length : 0
    cycle.current = { key, index }
    haptic.tap()
    onPick(options[index].emoji, options[index].color)
  }

  return (
    <TouchableOpacity
      onPress={generate}
      accessibilityLabel="Auto generate icon"
      style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}
    >
      <Ionicons name="sparkles" size={13} color={C.accentText} />
      <Text style={{ color: C.accentText, fontSize: 12, fontWeight: "700" }}>Auto generate</Text>
    </TouchableOpacity>
  )
}

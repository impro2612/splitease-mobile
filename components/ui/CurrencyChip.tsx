import { useState } from "react"
import { View, TouchableOpacity, Modal, FlatList } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text, TextInput } from "@/components/ui/Typography"
import { CURRENCIES } from "@/lib/currencies"
import { tokens, useTheme } from "@/lib/theme"

/**
 * The one currency selector used by every form: a compact chip that opens a searchable,
 * full-screen list of all supported currencies. Uses its own Modal so it also works from
 * inside bottom sheets.
 */
export function CurrencyChip({ value, onChange, height = 52 }: { value: string; onChange: (code: string) => void; height?: number }) {
  const C = useTheme()
  const { top, bottom } = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const info = CURRENCIES.find((c) => c.code === value)
  const query = q.trim().toLowerCase()
  const list = CURRENCIES.filter((c) => !query || c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query))

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        accessibilityLabel={`Currency ${value}, change`}
        style={{ height, paddingHorizontal: 12, borderRadius: tokens.radius.md, backgroundColor: C.iconBg, flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Text style={{ fontSize: 16 }}>{info?.flag ?? ""}</Text>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: "700" }}>{value}</Text>
        <Ionicons name="chevron-down" size={13} color={C.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: top + 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>Currency</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }} accessibilityLabel="Close">
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={{ marginHorizontal: 20, marginBottom: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.md, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 46 }}>
            <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
            <TextInput style={{ flex: 1, color: C.text, fontSize: 15 }} placeholder="Search currency" placeholderTextColor={C.textMuted} value={q} onChangeText={setQ} autoCapitalize="none" />
          </View>
          <FlatList
            data={list}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom + 24 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { onChange(item.code); setOpen(false); setQ("") }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border }}
              >
                <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600" }}>{item.code}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>{item.name}</Text>
                </View>
                <Text style={{ color: C.textSub, fontSize: 15, fontWeight: "600", marginRight: 6 }}>{item.symbol}</Text>
                {item.code === value && <Ionicons name="checkmark-circle" size={20} color={tokens.accent} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  )
}

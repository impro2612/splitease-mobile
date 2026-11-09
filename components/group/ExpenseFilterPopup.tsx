import { View, ScrollView, TouchableOpacity, Modal, Pressable, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "@/components/ui/Typography"
import { tokens, useTheme } from "@/lib/theme"
import { haptic } from "@/lib/haptics"

export type FilterPane = "member" | "date"

/** Two-pane popup under the Expenses-tab filter button: who paid, and which day. */
export function ExpenseFilterPopup({ visible, onClose, anchor, pane, onPane, members, userId, expenseDays, filterMembers, filterDays, onToggleMember, onToggleDay, onClear, filterCount }: {
  visible: boolean
  onClose: () => void
  anchor: { top: number; right: number } | null
  pane: FilterPane
  onPane: (p: FilterPane) => void
  members: any[]
  userId: string | undefined
  expenseDays: { key: string; label: string; count: number }[]
  filterMembers: string[]
  filterDays: string[]
  onToggleMember: (userId: string) => void
  onToggleDay: (dayKey: string) => void
  onClear: () => void
  filterCount: number
}) {
  const C = useTheme()
  const { width: windowW, height: windowH } = useWindowDimensions()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onClose()}>
      <Pressable onPress={() => onClose()} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }}>
        {anchor && (
          <Pressable
            onPress={() => {}}
            style={{ position: "absolute", top: Math.min(anchor.top, windowH - 320), right: anchor.right, width: Math.min(330, windowW - 24), height: 300, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden", elevation: 10, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}
          >
            <View style={{ flex: 1, flexDirection: "row" }}>
              {/* Left: what to filter by */}
              <View style={{ width: 142, backgroundColor: C.iconBg, paddingVertical: 8 }}>
                {([["member", "Member", "people-outline", filterMembers.length], ["date", "Date", "calendar-outline", filterDays.length]] as const).map(([key, label, icon, n]) => {
                  const active = pane === key
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => onPane(key)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: active ? C.card : "transparent", borderLeftWidth: 3, borderLeftColor: active ? tokens.accent : "transparent" }}
                    >
                      <Ionicons name={icon} size={16} color={active ? C.accentText : C.textSub} />
                      <Text style={{ flex: 1, color: active ? C.text : C.textSub, fontWeight: active ? "700" : "500", fontSize: 13 }} numberOfLines={1}>{label}</Text>
                      {n > 0 && (
                        <View style={{ backgroundColor: tokens.accent, borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{n}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
              {/* Right: the choices for the selected filter */}
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6 }}>
                {(pane === "member"
                  ? members.map((m: any) => ({ key: m.userId as string, label: m.userId === userId ? "You" : (m.user?.name ?? "Unknown"), sub: undefined as string | undefined }))
                  : expenseDays.map((d) => ({ key: d.key, label: d.label, sub: `${d.count} expense${d.count === 1 ? "" : "s"}` }))
                ).map((o) => {
                  const list = pane === "member" ? filterMembers : filterDays
                  const on = list.includes(o.key)
                  return (
                    <TouchableOpacity
                      key={o.key}
                      onPress={() => { haptic.tap(); pane === "member" ? onToggleMember(o.key) : onToggleDay(o.key) }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                    >
                      <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? tokens.accent : C.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: on ? "700" : "500" }} numberOfLines={1}>{o.label}</Text>
                        {o.sub ? <Text style={{ color: C.textMuted, fontSize: 11 }}>{o.sub}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 14, paddingVertical: 10 }}>
              <TouchableOpacity onPress={onClear} disabled={!filterCount}>
                <Text style={{ color: filterCount ? C.negative : C.textMuted, fontWeight: "600", fontSize: 13 }}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onClose()} style={{ backgroundColor: tokens.accent, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 7 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>OK</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  )
}

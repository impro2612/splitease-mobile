import { View, ScrollView, TouchableOpacity, Pressable, StyleSheet } from "react-native"
import { BlurView } from "expo-blur"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "@/components/ui/Typography"
import { Avatar } from "@/components/ui/Avatar"
import { useTheme } from "@/lib/theme"

/** Group members, floating over the current tab with the screen blurred behind. */
export function MembersPopup({ visible, onClose, members, groupName, isAdmin, userId, onAddMembers, onRemove, onToggleAdmin, removing, updatingRole }: {
  visible: boolean
  onClose: () => void
  members: any[]
  groupName: string | undefined
  isAdmin: boolean
  userId: string | undefined
  onAddMembers: () => void
  onRemove: (member: any) => void
  onToggleAdmin: (member: any) => void
  removing: boolean
  updatingRole: boolean
}) {
  const C = useTheme()
  return (
    <>
      {visible && (
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={40} tint={C.isDark ? "dark" : "light"} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
          <Pressable onPress={() => onClose()} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.3)" }]} accessibilityLabel="Close members" />
          <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20 }}>
            <View style={{ maxHeight: "78%", backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.border, paddingTop: 20, paddingBottom: 12, shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>Members</Text>
                  <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{members.length} in {groupName}</Text>
                </View>
                <TouchableOpacity onPress={() => onClose()} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Close">
                  <Ionicons name="close" size={18} color={C.text} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
            {/* Add members — admin only */}
            {isAdmin && (
              <TouchableOpacity
                onPress={onAddMembers}
                style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="person-add" size={20} color={C.accentText} />
                </View>
                <Text style={{ color: C.accentText, fontWeight: "600" }}>Add members</Text>
              </TouchableOpacity>
            )}

            {members.map((m: any) => {
              const isMemberAdmin = m.role === "ADMIN"
              const isMe = m.userId === userId
              return (
                <View
                  key={m.id}
                  style={{ backgroundColor: C.bg, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: C.text, fontWeight: "600" }}>{m.user?.name ?? "Unknown"}</Text>
                      {isMe && <Text style={{ color: C.accentText, fontSize: 10, fontWeight: "600" }}>(you)</Text>}
                    </View>
                    <Text style={{ color: C.textSub, fontSize: 12 }}>{m.user?.email}</Text>
                  </View>
                  {/* Admin badge */}
                  {isMemberAdmin && (
                    <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "600" }}>Admin</Text>
                    </View>
                  )}
                  {/* Admin-only actions */}
                  {isAdmin && !isMe && (
                    <View style={{ flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => onRemove(m)}
                        disabled={removing}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="person-remove-outline" size={18} color={C.negative} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => onToggleAdmin(m)}
                        disabled={updatingRole}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name={isMemberAdmin ? "shield" : "shield-outline"} size={16} color={isMemberAdmin ? "#fbbf24" : "#64748b"} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
            })}
              </ScrollView>
            </View>
          </View>
        </View>
      )}
    </>
  )
}

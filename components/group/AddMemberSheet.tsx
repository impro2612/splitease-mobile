import { useState } from "react"
import { View, TouchableOpacity, FlatList, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text, TextInput } from "@/components/ui/Typography"
import { InAppFullScreenModal } from "@/components/ui/InAppModal"
import { Avatar } from "@/components/ui/Avatar"
import { useTheme } from "@/lib/theme"

/** Full-screen friends picker for adding people to a group. */
export function AddMemberSheet({ visible, onClose, groupName, members, friends, friendsLoaded, userId, onAdd, adding }: {
  visible: boolean
  onClose: () => void
  groupName: string | undefined
  members: any[]
  friends: any[]
  friendsLoaded: boolean
  userId: string | undefined
  onAdd: (friendUser: any) => void
  adding: boolean
}) {
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const [friendSearch, setFriendSearch] = useState("")
  const handleClose = () => { setFriendSearch(""); onClose() }
  return (
    <InAppFullScreenModal visible={visible} onRequestClose={() => handleClose()}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingBottom: insets.bottom, paddingTop: insets.top + 16 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Add to {groupName}</Text>
          <TouchableOpacity onPress={() => handleClose()} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
            <Ionicons name="close" size={18} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 46 }}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, color: C.text, fontSize: 14 }}
            placeholder="Search friends..."
            placeholderTextColor={C.textMuted}
            value={friendSearch}
            onChangeText={setFriendSearch}
            autoCapitalize="none"
          />
          {friendSearch.length > 0 && (
            <TouchableOpacity onPress={() => setFriendSearch("")}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Friends list */}
        {(() => {
          const memberIds = new Set(members.map((m: any) => m.userId))
          const filtered = friends
            .filter((f: any) => {
              const other = f.requesterId === userId ? f.addressee : f.requester
              if (!other) return false
              if (memberIds.has(other.id)) return false
              if (!friendSearch.trim()) return true
              const q = friendSearch.toLowerCase()
              return other.name?.toLowerCase().includes(q) || other.email?.toLowerCase().includes(q)
            })

          if (!friendsLoaded) {
            return (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color="#6366f1" />
              </View>
            )
          }

          if (filtered.length === 0) {
            return (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
                <Ionicons name="people-outline" size={48} color={C.textMuted} style={{ marginBottom: 12 }} />
                <Text style={{ color: C.textSub, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
                  {friendSearch.trim() ? "No friends match your search" : "All your friends are already in this group"}
                </Text>
                <Text style={{ color: C.textMuted, fontSize: 13, textAlign: "center", marginTop: 6 }}>
                  {!friendSearch.trim() && "Add friends from the Friends tab first."}
                </Text>
              </View>
            )
          }

          return (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              renderItem={({ item }) => {
                const other = item.requesterId === userId ? item.addressee : item.requester
                if (!other) return null
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Avatar name={other.name} image={other.image} size={42} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }}>{other.name}</Text>
                      <Text style={{ color: C.textMuted, fontSize: 12 }}>{other.email}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onAdd(other)}
                      disabled={adding}
                      style={{ backgroundColor: "#6366f1", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 }}
                    >
                      <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )
              }}
            />
          )
        })()}
      </View>
    </InAppFullScreenModal>
  )
}

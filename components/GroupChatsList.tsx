import { View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { Text } from "@/components/ui/Typography"
import { useTheme } from "@/lib/theme"
import { decrypt } from "@/components/chat/ChatShared"

export type GroupChatRow = {
  groupId: string
  name: string
  emoji: string
  color: string
  memberCount: number
  muted: boolean
  left: boolean
  unread: number
  lastMessage: { content: string; createdAt: string; senderId: string; senderName: string } | null
}

function shortTime(iso: string) {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString([], { day: "numeric", month: "short" })
}

// Friends → Group Chats tab: one chat per group the user is in
export function GroupChatsList({ chats, loading, locked, myId }: { chats: GroupChatRow[]; loading: boolean; locked: boolean; myId: string }) {
  const C = useTheme()

  if (locked) {
    return (
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 32, paddingTop: 60 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Ionicons name="lock-closed" size={30} color={C.accentText} />
        </View>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Group chats are part of Plus</Text>
        <Text style={{ color: C.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19, marginBottom: 20 }}>
          Every group gets its own chat with everyone in it. Get SplitIT Plus to chat with your groups.
        </Text>
        <TouchableOpacity onPress={() => router.push("/plus" as any)} style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingHorizontal: 22, paddingVertical: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>See SplitIT Plus</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading && chats.length === 0) {
    return <View style={{ paddingTop: 60, alignItems: "center" }}><ActivityIndicator color="#6366f1" /></View>
  }

  if (chats.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 32, paddingTop: 60 }}>
        <Text style={{ fontSize: 44, marginBottom: 12 }}>👥</Text>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: "800", marginBottom: 6 }}>No group chats yet</Text>
        <Text style={{ color: C.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
          Every group you create or join gets its own chat automatically.
        </Text>
      </View>
    )
  }

  const active = chats.filter((c) => !c.left)
  const leftChats = chats.filter((c) => c.left)

  const row = (c: GroupChatRow) => {
    const last = c.lastMessage
    const preview = last
      ? `${last.senderId === myId ? "You" : last.senderName.split(" ")[0]}: ${decrypt(last.content, `group-${c.groupId}`)}`
      : `${c.memberCount} member${c.memberCount !== 1 ? "s" : ""} · Say hi 👋`
    return (
      <TouchableOpacity
        key={c.groupId}
        onPress={() => router.push({ pathname: "/group-chat/[groupId]", params: { groupId: c.groupId, name: c.name } } as any)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 10, opacity: c.left ? 0.6 : 1 }}
      >
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: `${c.color}33`, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, flexShrink: 1 }} numberOfLines={1}>{c.name}</Text>
            {c.muted && <Ionicons name="notifications-off" size={12} color={C.textMuted} />}
          </View>
          <Text style={{ color: c.unread > 0 ? C.text : C.textMuted, fontSize: 13, marginTop: 2, fontWeight: c.unread > 0 ? "600" : "400" }} numberOfLines={1}>
            {c.left ? "You left this chat" : preview}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          {last && <Text style={{ color: C.textMuted, fontSize: 11 }}>{shortTime(last.createdAt)}</Text>}
          {c.unread > 0 && (
            <View style={{ backgroundColor: c.muted ? C.textMuted : "#22c55e", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{c.unread > 99 ? "99+" : c.unread}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {active.map(row)}
      {leftChats.length > 0 && (
        <>
          <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginTop: 10, marginBottom: 8 }}>CHATS YOU LEFT</Text>
          {leftChats.map(row)}
        </>
      )}
    </ScrollView>
  )
}

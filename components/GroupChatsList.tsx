import { useState } from "react"
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native"
import { GroupAvatar } from "@/components/GroupAvatar"
import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { Text, TextInput } from "@/components/ui/Typography"
import { useTheme } from "@/lib/theme"
import { decrypt } from "@/components/chat/ChatShared"

export type GroupChatRow = {
  groupId: string
  name: string
  emoji: string
  imageUrl?: string | null
  color: string
  memberCount: number
  muted: boolean
  left: boolean
  unread: number
  lastMessage: { content: string; createdAt: string; senderId: string; senderName: string } | null
  activityAt?: string
}

// "10:30 AM" today, then "Yesterday", "3 days ago", "1 week ago", then the date
function relativeTime(iso: string) {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000)
  if (days <= 0) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toUpperCase()
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 28) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`
  return d.toLocaleDateString([], { day: "numeric", month: "short" })
}

// Friends → Group Chats tab: one chat per group the user is in
export function GroupChatsList({ chats, loading, locked, myId }: { chats: GroupChatRow[]; loading: boolean; locked: boolean; myId: string }) {
  const C = useTheme()
  const [query, setQuery] = useState("")

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

  const q = query.trim().toLowerCase()
  const visible = q ? chats.filter((c) => c.name.toLowerCase().includes(q)) : chats
  const active = visible.filter((c) => !c.left)
  const leftChats = visible.filter((c) => c.left)

  const row = (c: GroupChatRow) => {
    const last = c.lastMessage
    const preview = c.left
      ? "You left this chat"
      : last
        ? `${last.senderId === myId ? "You" : last.senderName.split(" ")[0]}: ${decrypt(last.content, `group-${c.groupId}`)}`
        : "Say hi 👋"
    const when = last?.createdAt ?? c.activityAt
    return (
      <TouchableOpacity
        key={c.groupId}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: "/group-chat/[groupId]", params: { groupId: c.groupId, name: c.name } } as any)}
        style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 12, opacity: c.left ? 0.6 : 1 }}
      >
        <GroupAvatar emoji={c.emoji} imageUrl={c.imageUrl} color={c.color} size={56} radius={28} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, flexShrink: 1 }} numberOfLines={1}>{c.name}</Text>
                {c.muted && <Ionicons name="notifications-off" size={12} color={C.textMuted} />}
              </View>
              <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>{c.memberCount} member{c.memberCount !== 1 ? "s" : ""}</Text>
              <Text style={{ color: c.unread > 0 ? C.text : C.textSub, fontSize: 13, marginTop: 1, fontWeight: c.unread > 0 ? "600" : "400" }} numberOfLines={1}>{preview}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 8, minWidth: 56 }}>
              {when ? <Text style={{ color: c.unread > 0 ? C.accentText : C.textMuted, fontSize: 12 }}>{relativeTime(when)}</Text> : null}
              {c.unread > 0 ? (
                <View style={{ backgroundColor: c.muted ? C.textMuted : "#6366f1", borderRadius: 12, minWidth: 24, height: 24, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{c.unread > 99 ? "99+" : c.unread}</Text>
                </View>
              ) : <View style={{ height: 24 }} />}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const card = (list: GroupChatRow[]) => (
    <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
      {list.map((c, i) => (
        <View key={c.groupId}>
          {i > 0 && <View style={{ height: 1, backgroundColor: C.border, marginLeft: 84 }} />}
          {row(c)}
        </View>
      ))}
    </View>
  )

  return (
    <View style={{ flex: 1, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 48, marginBottom: 12 }}>
        <Ionicons name="search" size={18} color={C.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search group chats..."
          placeholderTextColor={C.textMuted}
          style={{ flex: 1, color: C.text, fontSize: 15, padding: 0 }}
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={17} color={C.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {visible.length === 0 ? (
          <Text style={{ color: C.textMuted, fontSize: 14, textAlign: "center", marginTop: 30 }}>No group chats match "{query.trim()}"</Text>
        ) : null}
        {active.length > 0 && card(active)}
        {leftChats.length > 0 && (
          <>
            <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginTop: 18, marginBottom: 8 }}>CHATS YOU LEFT</Text>
            {card(leftChats)}
          </>
        )}
      </ScrollView>
    </View>
  )
}

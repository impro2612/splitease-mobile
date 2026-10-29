import { useState, useEffect, useRef, useCallback } from "react"
import { View, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Pressable, Modal, Keyboard, Animated, ScrollView } from "react-native"
import { Text, TextInput } from "@/components/ui/Typography"
import FloatingContextMenu, { MenuAnchor } from "@/components/ui/FloatingContextMenu"
import * as Clipboard from "expo-clipboard"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useQueryClient } from "@tanstack/react-query"
import { createPusher } from "@/lib/pusher"
import { useAuthStore } from "@/store/auth"
import { groupChatsApi } from "@/lib/api"
import Toast from "react-native-toast-message"
import { withPlus } from "@/components/PlusGate"
import { uuidv4, QUICK_EMOJIS, EmojiReactionSheet, encrypt, decrypt } from "@/components/chat/ChatShared"

// ─── Types ───────────────────────────────────────────────────────────────────
type MsgReaction = { id: string; userId: string; emoji: string }
type Message = {
  id?: string
  clientId: string
  senderId: string
  senderName?: string
  content: string
  createdAt: string
  pending?: boolean
  reactions?: MsgReaction[]
}
type ChatInfo = {
  groupId: string
  name: string
  emoji: string
  color: string
  muted: boolean
  left: boolean
  members: { id: string; name: string | null; email: string; role: string; left: boolean }[]
}

// NOTE: derived from the group ID, which the server also knows — NOT end-to-end encryption.
const groupKey = (groupId: string) => `group-${groupId}`
const cacheKey = (groupId: string) => `group_chat_cache_${groupId}`

async function loadCache(key: string): Promise<Message[]> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
async function saveCache(key: string, messages: Message[]) {
  await AsyncStorage.setItem(key, JSON.stringify(messages.slice(-200))).catch(() => {})
}

// Each sender gets a stable name colour so a busy group chat is easy to follow
const NAME_COLORS = ["#f472b6", "#22c55e", "#f59e0b", "#38bdf8", "#a78bfa", "#fb7185", "#2dd4bf", "#facc15"]
function nameColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return NAME_COLORS[h % NAME_COLORS.length]
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  const map = new Map(existing.map((m) => [m.clientId, m]))
  for (const m of incoming) map.set(m.clientId, { ...map.get(m.clientId), ...m, pending: false })
  return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
function formatDateHeader(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
}

// ─── Component ────────────────────────────────────────────────────────────────
function GroupChatScreen() {
  const insets = useSafeAreaInsets()
  const C = useTheme()
  const queryClient = useQueryClient()
  const { groupId, name } = useLocalSearchParams<{ groupId: string; name?: string }>()
  const { user } = useAuthStore()
  const myId = user?.id ?? ""
  const key = groupKey(groupId)
  const ck = cacheKey(groupId)

  const [info, setInfo] = useState<ChatInfo | null>(null)
  const [removed, setRemoved] = useState(false) // no longer in the group (removed, or group deleted)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [actionState, setActionState] = useState<{ msg: Message; anchor: MenuAnchor } | null>(null)
  const actionMsg = actionState?.msg ?? null
  const reactionTargetRef = useRef<Message | null>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmText: string; icon: keyof typeof Ionicons.glyphMap; onConfirm: () => void
  } | null>(null)
  // Android: the screen doesn't resize for the keyboard (edge-to-edge), so we lift the
  // whole chat by the keyboard's height — the list shrinks and the last message stays visible
  const [kbHeight, setKbHeight] = useState(0)
  const listRef = useRef<FlatList>(null)
  const nearBottomRef = useRef(true)

  const msgRefs = useRef<Record<string, any>>({})
  const lastFetchRef = useRef<string | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const left = info?.left ?? false
  const title = info?.name ?? decodeURIComponent(name ?? "Group chat")
  const activeMembers = info ? info.members.filter((m) => !m.left).length : null

  function handleError(err: any) {
    if (err?.response?.status === 403 || err?.response?.status === 404) setRemoved(true)
  }

  const loadInfo = useCallback(async () => {
    try {
      const res = await groupChatsApi.info(groupId)
      setInfo(res.data)
    } catch (err) {
      handleError(err)
    }
  }, [groupId])

  const fetchDelta = useCallback(async () => {
    try {
      const res = await groupChatsApi.history(groupId, { after: lastFetchRef.current ?? undefined, limit: 50 })
      const { messages: raw, hasMore: more } = res.data
      const decrypted: Message[] = raw.map((m: any) => ({ ...m, content: decrypt(m.content, key) }))
      const firstPage = !lastFetchRef.current
      if (firstPage) setHasMore(more) // first page decides whether older ones exist
      if (firstPage) {
        // The server's latest page is the truth: drop cached messages in that window it no
        // longer has (deleted by their sender while this chat was closed)
        const oldest = decrypted.length ? decrypted[decrypted.length - 1].createdAt : null
        setMessages((prev) => {
          const kept = prev.filter((m) => m.pending || (more && oldest && m.createdAt < oldest))
          const merged = mergeMessages(kept, decrypted)
          saveCache(ck, merged)
          return merged
        })
      } else if (decrypted.length > 0) {
        setMessages((prev) => {
          const merged = mergeMessages(prev, decrypted)
          saveCache(ck, merged)
          return merged
        })
      }
      if (decrypted.length > 0) {
        lastFetchRef.current = decrypted[0].createdAt // newest first
      }
    } catch (err) {
      handleError(err)
    }
  }, [groupId, key, ck])

  async function loadOlderMessages() {
    if (loadingOlder || !hasMore || messages.length === 0) return
    setLoadingOlder(true)
    try {
      const res = await groupChatsApi.history(groupId, { before: messages[0].clientId, limit: 50 })
      const { messages: raw, hasMore: more } = res.data
      const decrypted: Message[] = raw.map((m: any) => ({ ...m, content: decrypt(m.content, key) }))
      setMessages((prev) => {
        const merged = mergeMessages(prev, decrypted)
        saveCache(ck, merged)
        return merged
      })
      setHasMore(more)
    } catch (err) {
      handleError(err)
    } finally {
      setLoadingOlder(false)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      const cached = await loadCache(ck)
      if (mounted && cached.length > 0) setMessages(cached)
      await Promise.all([loadInfo(), fetchDelta()])
      if (mounted) setLoading(false)
    })()
    return () => {
      mounted = false
      // Unread counts on the Group Chats tab are stale once we've read the chat
      queryClient.invalidateQueries({ queryKey: ["group-chats"] })
    }
  }, [groupId])

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myId) return
    const pusher = createPusher()
    const startPolling = () => {
      if (!pollIntervalRef.current) pollIntervalRef.current = setInterval(() => { fetchDelta() }, 8000)
    }
    const stopPolling = () => {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
    }
    pusher.connection.bind("connected", stopPolling)
    pusher.connection.bind("disconnected", startPolling)
    pusher.connection.bind("failed", startPolling)
    pusher.connection.bind("error", startPolling)

    const channel = pusher.subscribe(`private-user-${myId}`)
    channel.bind("pusher:subscription_error", startPolling)
    channel.bind("group-message", (data: { groupId: string }) => {
      if (data.groupId === groupId) fetchDelta()
    })
    channel.bind("group-message-deleted", (data: { groupId: string; ids: string[] }) => {
      if (data.groupId !== groupId) return
      setMessages((prev) => {
        const updated = prev.filter((m) => !m.id || !data.ids.includes(m.id))
        saveCache(ck, updated)
        return updated
      })
    })
    channel.bind("group-message-reaction", (data: { groupId: string; messageId: string; emoji: string; userId: string; action: "added" | "removed" }) => {
      if (data.groupId !== groupId || data.userId === myId) return // our own taps are applied optimistically
      setMessages((prev) => {
        const updated = prev.map((m) => {
          if (m.id !== data.messageId) return m
          const reactions = (m.reactions ?? []).filter((r) => !(r.userId === data.userId && r.emoji === data.emoji))
          return { ...m, reactions: data.action === "added" ? [...reactions, { id: `${data.userId}-${data.emoji}`, userId: data.userId, emoji: data.emoji }] : reactions }
        })
        saveCache(ck, updated)
        return updated
      })
    })

    return () => {
      stopPolling()
      channel.unbind_all()
      pusher.unsubscribe(`private-user-${myId}`)
      pusher.disconnect()
    }
  }, [myId, groupId, fetchDelta])

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      if (Platform.OS === "android") setKbHeight(Math.max(0, e.endCoordinates?.height ?? 0))
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    })
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0))
    return () => { showSub.remove(); hideSub.remove() }
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setSending(true)
    const clientId = uuidv4()
    try {
      setMessages((prev) => mergeMessages(prev, [{
        clientId, senderId: myId, senderName: user?.name ?? "", content: text,
        createdAt: new Date().toISOString(), pending: true, reactions: [],
      }]))
      const res = await groupChatsApi.send(groupId, { content: encrypt(text, key), clientId })
      setMessages((prev) => {
        const merged = mergeMessages(prev, [{ ...res.data, content: text, reactions: [] }])
        saveCache(ck, merged)
        return merged
      })
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId))
      setInput(text)
      handleError(err)
      Toast.show({ type: "error", text1: "Message not sent", text2: err?.response?.data?.error ?? "Please try again" })
    } finally {
      setSending(false)
    }
  }

  async function toggleReaction(msg: Message, emoji: string) {
    if (!msg.id) return
    setActionState(null)
    setEmojiPickerOpen(false)
    setMessages((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== msg.id) return m
        const reactions = m.reactions ?? []
        const mine = reactions.some((r) => r.userId === myId && r.emoji === emoji)
        return {
          ...m,
          reactions: mine
            ? reactions.filter((r) => !(r.userId === myId && r.emoji === emoji))
            : [...reactions, { id: `opt-${myId}-${emoji}`, userId: myId, emoji }],
        }
      })
      saveCache(ck, updated)
      return updated
    })
    try {
      await groupChatsApi.react(groupId, msg.id, emoji)
    } catch {
      lastFetchRef.current = null
      fetchDelta()
    }
  }

  async function deleteMessage(msg: Message) {
    if (!msg.id) return
    const id = msg.id
    try {
      await groupChatsApi.delete(groupId, [id])
      setMessages((prev) => {
        const updated = prev.filter((m) => m.id !== id)
        saveCache(ck, updated)
        return updated
      })
    } catch {
      Toast.show({ type: "error", text1: "Delete failed", text2: "Could not delete the message" })
    }
  }

  async function updateSettings(data: { muted?: boolean; left?: boolean }) {
    try {
      const res = await groupChatsApi.update(groupId, data)
      setInfo((prev) => prev ? { ...prev, ...res.data } : prev)
      queryClient.invalidateQueries({ queryKey: ["group-chats"] })
      if (data.muted !== undefined) Toast.show({ type: "success", text1: data.muted ? "Chat muted" : "Chat unmuted" })
      if (data.left === true) {
        Toast.show({ type: "success", text1: "You left the chat", text2: "You're still in the group." })
        router.back()
      }
      if (data.left === false) Toast.show({ type: "success", text1: "You're back in the chat" })
    } catch (err: any) {
      handleError(err)
      Toast.show({ type: "error", text1: "Couldn't update the chat", text2: err?.response?.data?.error ?? "Please try again" })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  type ListItem = Message | { type: "date"; label: string; key: string }
  const listItems: ListItem[] = []
  let lastDate = ""
  for (const m of messages) {
    const dateStr = new Date(m.createdAt).toDateString()
    if (dateStr !== lastDate) {
      lastDate = dateStr
      listItems.push({ type: "date", label: formatDateHeader(m.createdAt), key: `date-${m.createdAt}` })
    }
    listItems.push(m)
  }

  function groupReactions(reactions: MsgReaction[] | undefined) {
    const map = new Map<string, { count: number; mine: boolean }>()
    for (const r of reactions ?? []) {
      const e = map.get(r.emoji)
      map.set(r.emoji, { count: (e?.count ?? 0) + 1, mine: (e?.mine ?? false) || r.userId === myId })
    }
    return Array.from(map.entries()).map(([emoji, v]) => ({ emoji, ...v }))
  }

  const composerStyle = {
    flexDirection: "row" as const, alignItems: "flex-end" as const, paddingHorizontal: 16, paddingTop: 12,
    paddingBottom: 12 + (insets.bottom > 0 ? insets.bottom : 0), gap: 10,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg,
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${info?.color ?? "#6366f1"}33`, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 19 }}>{info?.emoji ?? "👥"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }} numberOfLines={1}>{title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {activeMembers != null && <Text style={{ color: C.textMuted, fontSize: 11 }}>{activeMembers} member{activeMembers !== 1 ? "s" : ""} ·</Text>}
            <Text style={{ color: C.positive, fontSize: 11, fontWeight: "500" }}>Encrypted</Text>
            {info?.muted ? <Ionicons name="notifications-off" size={11} color={C.textMuted} /> : null}
          </View>
        </View>
        {!removed && info && (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="Chat options"
          >
            <Ionicons name="ellipsis-vertical" size={18} color={C.textSub} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1, paddingBottom: kbHeight }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {loading && messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#6366f1" size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            onContentSizeChange={() => { if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: false }) }}
            data={listItems}
            keyExtractor={(item) => ("clientId" in item ? item.clientId : item.key)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1, justifyContent: "flex-end" }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={loadingOlder ? (
              <View style={{ paddingVertical: 12, alignItems: "center" }}><ActivityIndicator color="#6366f1" size="small" /></View>
            ) : null}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>{info?.emoji ?? "👥"}</Text>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 6 }}>No messages yet</Text>
                <Text style={{ color: C.textMuted, fontSize: 13, textAlign: "center" }}>Say hi to everyone in {title}!</Text>
              </View>
            }
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
              nearBottomRef.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 120
              if (contentOffset.y <= 80) loadOlderMessages()
            }}
            scrollEventThrottle={300}
            renderItem={({ item, index }) => {
              if ("type" in item && item.type === "date") {
                return (
                  <View style={{ alignItems: "center", marginVertical: 12 }}>
                    <View style={{ backgroundColor: C.iconBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}>
                      <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600" }}>{item.label}</Text>
                    </View>
                  </View>
                )
              }
              const msg = item as Message
              const isMine = msg.senderId === myId
              const msgId = msg.id ?? msg.clientId
              const prev = listItems[index - 1]
              // Show the sender's name on the first of their consecutive messages
              const showName = !isMine && !(prev && "clientId" in prev && prev.senderId === msg.senderId)
              const grouped = groupReactions(msg.reactions)

              return (
                <Pressable
                  ref={(r) => { msgRefs.current[msgId] = r }}
                  onLongPress={() => {
                    if (msg.pending) return
                    msgRefs.current[msgId]?.measure((_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
                      setActionState({ msg, anchor: { pageX, pageY, width: w, height: h } })
                    })
                  }}
                  delayLongPress={350}
                  style={{ marginBottom: grouped.length > 0 ? 2 : 6, marginTop: showName ? 6 : 0 }}
                >
                  <View style={{ flexDirection: "row", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                    <View style={{
                      maxWidth: "78%",
                      backgroundColor: isMine ? "#6366f1" : C.card,
                      borderRadius: 18,
                      borderBottomRightRadius: isMine ? 4 : 18,
                      borderBottomLeftRadius: isMine ? 18 : 4,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderWidth: isMine ? 0 : 1,
                      borderColor: C.border,
                      opacity: msg.pending ? 0.65 : 1,
                    }}>
                      {showName && (
                        <Text style={{ color: nameColor(msg.senderId), fontSize: 12, fontWeight: "700", marginBottom: 2 }} numberOfLines={1}>
                          {msg.senderName ?? "Member"}
                        </Text>
                      )}
                      <Text style={{ color: isMine ? "#fff" : C.text, fontSize: 15, lineHeight: 21 }}>{msg.content}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, justifyContent: "flex-end" }}>
                        <Text style={{ color: isMine ? "rgba(255,255,255,0.55)" : C.textMuted, fontSize: 10 }}>{formatTime(msg.createdAt)}</Text>
                        {isMine && (
                          <Ionicons name={msg.pending ? "time-outline" : "checkmark"} size={11} color="rgba(255,255,255,0.55)" />
                        )}
                      </View>
                    </View>
                  </View>
                  {grouped.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: isMine ? "flex-end" : "flex-start", marginTop: 3, marginBottom: 4, gap: 4 }}>
                      {grouped.map(({ emoji, count, mine }) => (
                        <TouchableOpacity
                          key={emoji}
                          onPress={() => !left && toggleReaction(msg, emoji)}
                          style={{
                            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                            minWidth: count > 1 ? 54 : 42, minHeight: 32, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 5,
                            backgroundColor: mine ? "#f5f3ff" : "#ffffff", borderWidth: 1.5, borderColor: mine ? "#6366f1" : "#c7d2fe",
                          }}
                        >
                          <Text style={{ fontSize: 18, lineHeight: 22 }}>{emoji}</Text>
                          {count > 1 && <Text style={{ color: mine ? "#4f46e5" : "#475569", fontSize: 13, fontWeight: "800", lineHeight: 18 }}>{count}</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </Pressable>
              )
            }}
          />
        )}

        {/* Composer — or why you can't send */}
        {removed ? (
          <Animated.View style={[composerStyle, { alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: C.textMuted, fontSize: 13, textAlign: "center", flex: 1 }}>
              You're no longer in this group, so you can't send messages.
            </Text>
          </Animated.View>
        ) : left ? (
          <Animated.View style={[composerStyle, { alignItems: "center" }]}>
            <Text style={{ color: C.textMuted, fontSize: 13, flex: 1 }}>You left this chat.</Text>
            <TouchableOpacity
              onPress={() => updateSettings({ left: false })}
              style={{ backgroundColor: "#6366f1", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Rejoin chat</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View style={composerStyle}>
            <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.inputBorder, paddingHorizontal: 16, paddingVertical: 10, minHeight: 46, maxHeight: 120, justifyContent: "center" }}>
              <TextInput
                style={{ color: C.text, fontSize: 15, lineHeight: 20 }}
                placeholder="Message…"
                placeholderTextColor={C.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
              />
            </View>
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!input.trim() || sending}
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: input.trim() ? "#6366f1" : "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center" }}
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color={input.trim() ? "#fff" : C.textMuted} />}
            </TouchableOpacity>
          </Animated.View>
        )}
      </KeyboardAvoidingView>

      {/* Long-press menu on a message */}
      <FloatingContextMenu
        visible={!!actionState}
        anchor={actionState?.anchor ?? null}
        emojis={left || removed ? [] : QUICK_EMOJIS}
        reactedEmojis={(actionMsg?.reactions ?? []).filter((r) => r.userId === myId).map((r) => r.emoji)}
        onEmojiPress={(emoji) => actionMsg && toggleReaction(actionMsg, emoji)}
        onMoreEmoji={left || removed ? undefined : () => { reactionTargetRef.current = actionMsg; setActionState(null); setEmojiPickerOpen(true) }}
        actions={[
          {
            label: "Copy Text",
            icon: "copy-outline",
            onPress: async () => {
              if (!actionMsg) return
              await Clipboard.setStringAsync(actionMsg.content)
              Toast.show({ type: "success", text1: "Copied to clipboard" })
            },
          },
          ...(actionMsg?.id && actionMsg.senderId === myId && !removed ? [{
            label: "Delete for everyone",
            icon: "trash-outline",
            color: C.negative,
            bgColor: "rgba(239,68,68,0.15)",
            onPress: () => {
              const target = actionMsg
              setConfirmDialog({
                title: "Delete message",
                message: "Delete this message for everyone in the group?",
                confirmText: "Delete",
                icon: "trash-outline",
                onConfirm: () => deleteMessage(target),
              })
            },
          }] : []),
        ]}
        onDismiss={() => { setActionState(null); setEmojiPickerOpen(false) }}
      />

      <EmojiReactionSheet
        visible={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        C={C}
        onSelect={(emoji) => {
          const target = reactionTargetRef.current ?? actionState?.msg
          if (target) toggleReaction(target, emoji)
          setEmojiPickerOpen(false)
        }}
      />

      {/* 3-dot chat settings */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable onPress={() => setMenuOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View style={{ position: "absolute", top: insets.top + 56, right: 16, minWidth: 220, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingVertical: 6, elevation: 8, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <MenuRow
              icon="people-outline" label="View group" color={C.text}
              onPress={() => { setMenuOpen(false); router.push(`/group/${groupId}` as any) }}
            />
            <MenuRow
              icon="person-circle-outline" label="View members" color={C.text}
              onPress={() => { setMenuOpen(false); setMembersOpen(true) }}
            />
            <MenuRow
              icon={info?.muted ? "notifications-outline" : "notifications-off-outline"}
              label={info?.muted ? "Unmute notifications" : "Mute notifications"}
              color={C.text}
              onPress={() => { setMenuOpen(false); updateSettings({ muted: !info?.muted }) }}
            />
            {left ? (
              <MenuRow
                icon="enter-outline" label="Rejoin chat" color={C.text}
                onPress={() => { setMenuOpen(false); updateSettings({ left: false }) }}
              />
            ) : (
              <MenuRow
                icon="exit-outline" label="Exit chat" color={C.negative}
                onPress={() => {
                  setMenuOpen(false)
                  setConfirmDialog({
                    title: "Exit chat?",
                    message: `You'll stop getting messages from ${title}. You stay in the group and its expenses, and you can rejoin the chat any time.`,
                    confirmText: "Exit",
                    icon: "exit-outline",
                    onConfirm: () => updateSettings({ left: true }),
                  })
                }}
              />
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Members of the group (= members of the chat) */}
      <Modal visible={membersOpen} transparent animationType="fade" onRequestClose={() => setMembersOpen(false)}>
        <Pressable onPress={() => setMembersOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.border, paddingVertical: 20, maxHeight: "75%" }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>Members</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{info?.members.length ?? 0} in {title}</Text>
              </View>
              <TouchableOpacity onPress={() => setMembersOpen(false)} style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color={C.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }}>
              {[...(info?.members ?? [])]
                .sort((a, b) => (a.id === myId ? -1 : b.id === myId ? 1 : (a.role === "ADMIN" ? 0 : 1) - (b.role === "ADMIN" ? 0 : 1)))
                .map((m) => {
                  const display = m.name || m.email
                  return (
                    <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: nameColor(m.id), alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>{display.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>{m.id === myId ? `${display} (You)` : display}</Text>
                        <Text style={{ color: C.textMuted, fontSize: 12 }} numberOfLines={1}>{m.left ? "Left the chat" : m.email}</Text>
                      </View>
                      {m.role === "ADMIN" && (
                        <View style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: C.accentText, fontSize: 11, fontWeight: "700" }}>Admin</Text>
                        </View>
                      )}
                    </View>
                  )
                })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm dialog */}
      <Modal visible={!!confirmDialog} transparent animationType="fade" onRequestClose={() => setConfirmDialog(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name={confirmDialog?.icon ?? "warning-outline"} size={26} color={C.negative} />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>{confirmDialog?.title}</Text>
            <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>{confirmDialog?.message}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setConfirmDialog(null)} style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { confirmDialog?.onConfirm(); setConfirmDialog(null) }}
                style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{confirmDialog?.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function MenuRow({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 13 }}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ color, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  )
}

export default withPlus(GroupChatScreen, "Group chat")

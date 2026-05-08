import { useState, useEffect, useRef, useCallback } from "react"
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Pressable, Modal, Alert,
  ScrollView,
} from "react-native"
import * as Clipboard from "expo-clipboard"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Pusher from "pusher-js/react-native"
import CryptoJS from "crypto-js"
import * as ExpoCrypto from "expo-crypto"
import * as SecureStore from "expo-secure-store"
import { useAuthStore } from "@/store/auth"
import EmojiKeyboard from "rn-emoji-keyboard"

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}
import { API_BASE_URL, messagesApi, messageReactionsApi } from "@/lib/api"
import Toast from "react-native-toast-message"

// ─── Types ───────────────────────────────────────────────────────────────────
type MsgReaction = { id: string; userId: string; emoji: string }
type Message = {
  id?: string
  clientId: string
  senderId: string
  receiverId: string
  content: string
  createdAt: string
  pending?: boolean
  reactions?: MsgReaction[]
}

const PusherCtor = ((Pusher as any)?.Pusher ?? Pusher) as typeof Pusher

// Quick-react emojis shown in the action sheet bar
const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"]

// ─── Encryption helpers ───────────────────────────────────────────────────────
function sharedKey(idA: string, idB: string) {
  return [idA, idB].sort().join("-")
}
function randomWordArray(size: number) {
  const bytes = ExpoCrypto.getRandomBytes(size)
  return CryptoJS.lib.WordArray.create(Array.from(bytes) as number[])
}
function encrypt(text: string, sharedKey: string) {
  const key = CryptoJS.SHA256(sharedKey)
  const iv = randomWordArray(16)
  const ciphertext = CryptoJS.AES.encrypt(text, key, { iv }).toString()
  return `${iv.toString(CryptoJS.enc.Base64)}:${ciphertext}`
}
function decrypt(cipher: string, sharedKey: string) {
  try {
    const key = CryptoJS.SHA256(sharedKey)
    if (cipher.includes(":")) {
      const sep = cipher.indexOf(":")
      const iv = CryptoJS.enc.Base64.parse(cipher.slice(0, sep))
      const ct = cipher.slice(sep + 1)
      return CryptoJS.AES.decrypt(ct, key, { iv }).toString(CryptoJS.enc.Utf8) || cipher
    }
    const iv = CryptoJS.MD5(sharedKey)
    return CryptoJS.AES.decrypt(cipher, key, { iv }).toString(CryptoJS.enc.Utf8) || cipher
  } catch {
    return cipher
  }
}

// ─── Cache helpers ────────────────────────────────────────────────────────────
function cacheKey(myId: string, friendId: string) {
  return `chat_cache_${[myId, friendId].sort().join("_")}`
}
async function loadCache(key: string): Promise<Message[]> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
async function saveCache(key: string, messages: Message[]) {
  const trimmed = messages.slice(-200)
  await AsyncStorage.setItem(key, JSON.stringify(trimmed)).catch(() => {})
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const C = useTheme()
  const { friendId, name } = useLocalSearchParams<{ friendId: string; name?: string }>()
  const { user } = useAuthStore()
  const myId = user?.id ?? ""
  const key = sharedKey(myId, friendId)
  const ck = cacheKey(myId, friendId)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [actionMsg, setActionMsg] = useState<Message | null>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const isSelecting = selectedIds.size > 0

  const flatListRef = useRef<FlatList>(null)
  const lastFetchRef = useRef<string | null>(null)
  const pusherRef = useRef<Pusher | null>(null)
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pusherConnectedRef = useRef(true)

  function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
    const map = new Map(existing.map((m) => [m.clientId, m]))
    for (const m of incoming) {
      map.set(m.clientId, { ...map.get(m.clientId), ...m, pending: false })
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }

  const fetchDelta = useCallback(async () => {
    try {
      const res = await messagesApi.history(friendId, {
        after: lastFetchRef.current ?? undefined,
        limit: 50,
      })
      const { messages: raw, hasMore: more } = res.data
      const decrypted: Message[] = raw.map((m: any) => ({
        ...m,
        content: decrypt(m.content, key),
        createdAt: m.createdAt,
      }))

      if (decrypted.length > 0) {
        setMessages((prev) => {
          const merged = mergeMessages(prev, decrypted)
          saveCache(ck, merged)
          return merged
        })
        const newest = decrypted[decrypted.length - 1]
        lastFetchRef.current = newest.createdAt
      }
      setHasMore(more)
    } catch {
      // silently fail
    }
  }, [friendId, key, ck])

  async function loadOlderMessages() {
    if (loadingOlder || !hasMore || messages.length === 0) return
    setLoadingOlder(true)
    try {
      const oldest = messages[0]
      const res = await messagesApi.history(friendId, {
        before: oldest.clientId,
        limit: 50,
      })
      const { messages: raw, hasMore: more } = res.data
      const decrypted: Message[] = raw.map((m: any) => ({
        ...m,
        content: decrypt(m.content, key),
      }))
      setMessages((prev) => {
        const merged = mergeMessages(prev, decrypted)
        saveCache(ck, merged)
        return merged
      })
      setHasMore(more)
    } finally {
      setLoadingOlder(false)
    }
  }

  function scheduleMarkRead() {
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current)
    markReadTimerRef.current = setTimeout(() => { fetchDelta() }, 1500)
  }

  useEffect(() => {
    let mounted = true
    async function init() {
      setLoading(true)
      const cached = await loadCache(ck)
      if (mounted && cached.length > 0) {
        setMessages(cached)
        const newest = cached[cached.length - 1]
        lastFetchRef.current = newest.createdAt
      }
      await fetchDelta()
      if (mounted) setLoading(false)
    }
    init()
    return () => { mounted = false }
  }, [friendId])

  // ── Pusher subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!myId) return

    const pusher = new PusherCtor(process.env.EXPO_PUBLIC_PUSHER_KEY ?? "", {
      cluster: process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? "ap2",
      channelAuthorization: {
        customHandler: async ({ socketId, channelName }, callback) => {
          try {
            const token = await SecureStore.getItemAsync("session_token")
            const res = await fetch(`${API_BASE_URL}/api/pusher/auth`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ socket_id: socketId, channel_name: channelName }),
            })
            if (!res.ok) { callback(new Error("Pusher auth failed"), null); return }
            callback(null, await res.json())
          } catch (error) {
            callback(error as Error, null)
          }
        },
      },
    })
    pusherRef.current = pusher

    function startPolling() {
      if (pollIntervalRef.current) return
      pollIntervalRef.current = setInterval(() => { fetchDelta() }, 8000)
    }
    function stopPolling() {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null }
    }

    pusher.connection.bind("connected", () => { pusherConnectedRef.current = true; stopPolling() })
    pusher.connection.bind("disconnected", () => { pusherConnectedRef.current = false; startPolling() })
    pusher.connection.bind("failed", () => { pusherConnectedRef.current = false; startPolling() })
    pusher.connection.bind("error", (err: unknown) => { pusherConnectedRef.current = false; startPolling(); console.warn("Pusher error", err) })

    const channel = pusher.subscribe(`private-user-${myId}`)
    channel.bind("pusher:subscription_error", (err: unknown) => { console.warn("Pusher subscription error", err); startPolling() })
    channel.bind("new-message", (data: { senderId: string }) => {
      if (data.senderId === friendId) fetchDelta()
    })
    channel.bind("message-reaction", (data: { messageId: string; emoji: string; userId: string; action: "added" | "removed" }) => {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== data.messageId) return m
        const reactions = m.reactions ?? []
        if (data.action === "removed") {
          return { ...m, reactions: reactions.filter((r) => !(r.userId === data.userId && r.emoji === data.emoji)) }
        }
        // added — avoid duplicates
        const exists = reactions.some((r) => r.userId === data.userId && r.emoji === data.emoji)
        if (exists) return m
        return { ...m, reactions: [...reactions, { id: `${data.userId}-${data.emoji}`, userId: data.userId, emoji: data.emoji }] }
      }))
    })

    return () => {
      stopPolling()
      channel.unbind_all()
      pusher.unsubscribe(`private-user-${myId}`)
      pusher.disconnect()
    }
  }, [myId, friendId, fetchDelta])

  useEffect(() => {
    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  // ── Send message ─────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setSending(true)
    try {
      const clientId = uuidv4()
      const encrypted = encrypt(text, key)
      const optimistic: Message = {
        clientId,
        senderId: myId,
        receiverId: friendId,
        content: text,
        createdAt: new Date().toISOString(),
        pending: true,
        reactions: [],
      }
      setMessages((prev) => mergeMessages(prev, [optimistic]))
      const res = await messagesApi.send({ receiverId: friendId, content: encrypted, clientId })
      const saved: Message = { ...res.data, content: text, pending: false }
      setMessages((prev) => {
        const merged = mergeMessages(prev, [saved])
        saveCache(ck, merged)
        return merged
      })
      lastFetchRef.current = saved.createdAt
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed to send"
      Toast.show({ type: "error", text1: "Message not sent", text2: msg })
    } finally {
      setSending(false)
    }
  }

  // ── Reactions ─────────────────────────────────────────────────────────────────
  async function toggleReaction(msg: Message, emoji: string) {
    if (!msg.id) return
    setActionMsg(null)
    setEmojiPickerOpen(false)
    // Optimistic update
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msg.id) return m
      const reactions = m.reactions ?? []
      const exists = reactions.some((r) => r.userId === myId && r.emoji === emoji)
      return {
        ...m,
        reactions: exists
          ? reactions.filter((r) => !(r.userId === myId && r.emoji === emoji))
          : [...reactions, { id: `opt-${myId}-${emoji}`, userId: myId, emoji }],
      }
    }))
    try {
      await messageReactionsApi.toggle(msg.id, emoji)
    } catch {
      // revert on error
      fetchDelta()
    }
  }

  // ── Selection helpers ─────────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function cancelSelection() { setSelectedIds(new Set()) }

  async function deleteSelected() {
    const ids = Array.from(selectedIds)
    setDeleting(true)
    try {
      await messagesApi.delete(ids)
      setMessages((prev) => {
        const updated = prev.filter((m) => !m.id || !ids.includes(m.id))
        saveCache(ck, updated)
        return updated
      })
      setSelectedIds(new Set())
    } catch {
      Toast.show({ type: "error", text1: "Delete failed", text2: "Could not delete messages" })
    } finally {
      setDeleting(false)
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────
  const friendName = decodeURIComponent(name ?? "Chat")

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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

  type ListItem = Message | { type: "date"; label: string; key: string }
  function buildListItems(): ListItem[] {
    const items: ListItem[] = []
    let lastDate = ""
    for (const m of messages) {
      const dateStr = new Date(m.createdAt).toDateString()
      if (dateStr !== lastDate) {
        lastDate = dateStr
        items.push({ type: "date", label: formatDateHeader(m.createdAt), key: `date-${m.createdAt}` })
      }
      items.push(m)
    }
    return items
  }

  // Group reactions by emoji for display: { emoji: { count, mine } }
  function groupReactions(reactions: MsgReaction[] | undefined) {
    if (!reactions || reactions.length === 0) return []
    const map = new Map<string, { count: number; mine: boolean }>()
    for (const r of reactions) {
      const existing = map.get(r.emoji)
      map.set(r.emoji, {
        count: (existing?.count ?? 0) + 1,
        mine: (existing?.mine ?? false) || r.userId === myId,
      })
    }
    return Array.from(map.entries()).map(([emoji, v]) => ({ emoji, ...v }))
  }

  const listItems = buildListItems()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 }}>
        <TouchableOpacity
          onPress={() => isSelecting ? cancelSelection() : router.back()}
          style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name={isSelecting ? "close" : "arrow-back"} size={18} color="#fff" />
        </TouchableOpacity>
        {isSelecting ? (
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }}>{selectedIds.size} selected</Text>
          </View>
        ) : (
          <>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{friendName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }}>{friendName}</Text>
              <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "500" }}>End-to-end encrypted</Text>
            </View>
          </>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#6366f1" size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={listItems}
            keyExtractor={(item) => ("clientId" in item ? item.clientId : item.key)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1, justifyContent: "flex-end" }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              loadingOlder ? (
                <View style={{ paddingVertical: 12, alignItems: "center" }}>
                  <ActivityIndicator color="#6366f1" size="small" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 6 }}>No messages yet</Text>
                <Text style={{ color: C.textMuted, fontSize: 13, textAlign: "center" }}>Say hi to {friendName}!</Text>
              </View>
            }
            onScroll={(e) => {
              scheduleMarkRead()
              if (e.nativeEvent.contentOffset.y <= 80) loadOlderMessages()
            }}
            scrollEventThrottle={300}
            renderItem={({ item }) => {
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
              const isSelected = selectedIds.has(msgId)
              const grouped = groupReactions(msg.reactions)

              return (
                <Pressable
                  onLongPress={() => {
                    if (msg.pending || isSelecting) return
                    setActionMsg(msg)
                  }}
                  onPress={() => {
                    if (isSelecting && msg.id) toggleSelect(msgId)
                  }}
                  delayLongPress={350}
                  style={{ marginBottom: grouped.length > 0 ? 2 : 6 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {isSelecting ? (
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: isSelected ? "#6366f1" : "transparent",
                        borderWidth: 2, borderColor: isSelected ? "#6366f1" : C.textMuted,
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                    ) : null}
                    <View style={{ flex: 1, flexDirection: "row", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                      <View style={{
                        maxWidth: "78%",
                        backgroundColor: isSelected ? "rgba(99,102,241,0.35)" : isMine ? "#6366f1" : "#1a1a2e",
                        borderRadius: 18,
                        borderBottomRightRadius: isMine ? 4 : 18,
                        borderBottomLeftRadius: isMine ? 18 : 4,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderWidth: isMine ? 0 : 1,
                        borderColor: isSelected ? "#6366f1" : C.border,
                        opacity: msg.pending ? 0.65 : 1,
                      }}>
                        <Text style={{ color: C.text, fontSize: 15, lineHeight: 21 }}>{msg.content}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, justifyContent: "flex-end" }}>
                          <Text style={{ color: isMine ? "rgba(255,255,255,0.55)" : C.textMuted, fontSize: 10 }}>
                            {formatTime(msg.createdAt)}
                          </Text>
                          {isMine && (
                            <Ionicons
                              name={msg.pending ? "time-outline" : "checkmark-done"}
                              size={11}
                              color={msg.pending ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.55)"}
                            />
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Reaction pills below the bubble */}
                  {grouped.length > 0 && (
                    <View style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      justifyContent: isMine ? "flex-end" : "flex-start",
                      marginTop: 3,
                      marginBottom: 4,
                      gap: 4,
                      paddingHorizontal: isSelecting ? 30 : 0,
                    }}>
                      {grouped.map(({ emoji, count, mine }) => (
                        <TouchableOpacity
                          key={emoji}
                          onPress={() => msg.id && toggleReaction(msg, emoji)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: C.card,
                            borderRadius: 20,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderWidth: mine ? 1.5 : 1,
                            borderColor: mine ? "#6366f1" : C.border,
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>{emoji}</Text>
                          {count > 1 && <Text style={{ color: mine ? "#a5b4fc" : C.textSub, fontSize: 12, fontWeight: "600" }}>{count}</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </Pressable>
              )
            }}
          />
        )}

        {/* Input / Selection action bar */}
        {isSelecting ? (
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 + (insets.bottom > 0 ? insets.bottom : 0), gap: 12, borderTopWidth: 1, borderTopColor: C.border }}>
            <TouchableOpacity
              onPress={cancelSelection}
              style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const count = selectedIds.size
                Alert.alert("Delete Messages", `Delete ${count} message${count > 1 ? "s" : ""}? This cannot be undone.`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: deleteSelected },
                ])
              }}
              disabled={deleting}
              style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}
            >
              {deleting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Delete ({selectedIds.size})</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 + (insets.bottom > 0 ? insets.bottom : 0), gap: 10, borderTopWidth: 1, borderTopColor: C.border }}>
            <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.inputBorder, paddingHorizontal: 16, paddingVertical: 10, minHeight: 46, maxHeight: 120, justifyContent: "center" }}>
              <TextInput
                style={{ color: C.text, fontSize: 15, lineHeight: 20 }}
                placeholder="Message…"
                placeholderTextColor={C.textMuted}
                value={input}
                onChangeText={setInput}
                multiline
                returnKeyType="default"
              />
            </View>
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!input.trim() || sending}
              style={{
                width: 46, height: 46, borderRadius: 23,
                backgroundColor: input.trim() ? "#6366f1" : "rgba(99,102,241,0.2)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {sending
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="send" size={18} color={input.trim() ? "#fff" : C.textMuted} />}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Message action bottom sheet */}
      <Modal
        visible={!!actionMsg}
        transparent
        animationType="fade"
        onRequestClose={() => { setActionMsg(null); setEmojiPickerOpen(false) }}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={() => { setActionMsg(null); setEmojiPickerOpen(false) }}
        >
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 8, paddingTop: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 12 }} />

              {/* Quick-react bar */}
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginHorizontal: 20,
                marginBottom: 12,
                backgroundColor: C.bg,
                borderRadius: 32,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: C.border,
              }}>
                {QUICK_EMOJIS.map((emoji) => {
                  const alreadyReacted = actionMsg?.reactions?.some((r) => r.userId === myId && r.emoji === emoji)
                  return (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => actionMsg && toggleReaction(actionMsg, emoji)}
                      style={{
                        width: 40, height: 40, borderRadius: 20,
                        alignItems: "center", justifyContent: "center",
                        backgroundColor: alreadyReacted ? "rgba(99,102,241,0.2)" : "transparent",
                        borderWidth: alreadyReacted ? 1.5 : 0,
                        borderColor: "#6366f1",
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  )
                })}
                {/* + button */}
                <TouchableOpacity
                  onPress={() => setEmojiPickerOpen(true)}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    alignItems: "center", justifyContent: "center",
                    backgroundColor: C.iconBg,
                  }}
                >
                  <Ionicons name="add" size={22} color={C.textSub} />
                </TouchableOpacity>
              </View>

              <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 20, marginBottom: 4 }} />

              {/* Copy */}
              <TouchableOpacity
                onPress={async () => {
                  if (!actionMsg) return
                  await Clipboard.setStringAsync(actionMsg.content)
                  setActionMsg(null)
                  Toast.show({ type: "success", text1: "Copied to clipboard" })
                }}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14, gap: 16 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="copy-outline" size={20} color="#a5b4fc" />
                </View>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: "500" }}>Copy Text</Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 24 }} />

              {/* Delete */}
              <TouchableOpacity
                onPress={() => {
                  if (!actionMsg?.id) return
                  const msgId = actionMsg.id
                  setActionMsg(null)
                  setSelectedIds(new Set([msgId]))
                }}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14, gap: 16 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="trash-outline" size={20} color="#f87171" />
                </View>
                <Text style={{ color: "#f87171", fontSize: 16, fontWeight: "500" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full emoji picker */}
      <EmojiKeyboard
        onEmojiSelected={(e) => {
          if (actionMsg) toggleReaction(actionMsg, e.emoji)
        }}
        open={emojiPickerOpen}
        onClose={() => setEmojiPickerOpen(false)}
        theme={{
          backdrop: "rgba(0,0,0,0.5)",
          knob: C.border,
          container: C.card,
          header: C.text,
          skinTonesContainer: C.card,
          category: {
            icon: C.textSub,
            iconActive: "#6366f1",
            container: C.card,
            containerActive: "rgba(99,102,241,0.15)",
          },
          search: {
            text: C.text,
            placeholder: C.textMuted,
            icon: C.textSub,
            background: C.bg,
          },
          emoji: { selected: "rgba(99,102,241,0.2)" },
        }}
      />
    </SafeAreaView>
  )
}

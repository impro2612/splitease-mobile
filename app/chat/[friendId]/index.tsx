import { useState, useEffect, useRef, useCallback } from "react"
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Pressable, Modal,
  ScrollView, Animated, PanResponder,
} from "react-native"
import FloatingContextMenu, { MenuAnchor } from "@/components/ui/FloatingContextMenu"
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
import { EmojiKeyboard } from "rn-emoji-keyboard"

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
  const [actionState, setActionState] = useState<{ msg: Message; anchor: MenuAnchor } | null>(null)
  const actionMsg = actionState?.msg ?? null
  const reactionTargetRef = useRef<Message | null>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmText: string; onConfirm: () => void
  } | null>(null)
  const isSelecting = selectedIds.size > 0

  // ── Emoji sheet animation ────────────────────────────────────────────────────
  const [emojiMounted, setEmojiMounted] = useState(false)
  const emojiSlideAnim = useRef(new Animated.Value(600)).current
  const emojiPanY = useRef(new Animated.Value(0)).current
  const emojiOverlayAnim = useRef(new Animated.Value(0)).current
  const emojiTranslateY = Animated.add(
    emojiSlideAnim,
    emojiPanY.interpolate({ inputRange: [-9999, 0, 9999], outputRange: [0, 0, 9999] }),
  )

  const emojiPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx),
    onMoveShouldSetPanResponderCapture: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) emojiPanY.setValue(g.dy) },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) {
        Animated.parallel([
          Animated.timing(emojiSlideAnim, { toValue: 600, duration: 200, useNativeDriver: true }),
          Animated.timing(emojiOverlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => { emojiPanY.setValue(0); setEmojiMounted(false); setEmojiPickerOpen(false) })
      } else {
        Animated.spring(emojiPanY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start()
      }
    },
  })).current

  useEffect(() => {
    if (emojiPickerOpen) {
      setEmojiMounted(true)
      emojiPanY.setValue(0)
      emojiSlideAnim.setValue(600)
      emojiOverlayAnim.setValue(0)
      Animated.parallel([
        Animated.spring(emojiSlideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(emojiOverlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(emojiSlideAnim, { toValue: 600, duration: 220, useNativeDriver: true }),
        Animated.timing(emojiOverlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => { emojiPanY.setValue(0); setEmojiMounted(false) })
    }
  }, [emojiPickerOpen])

  const flatListRef = useRef<FlatList>(null)
  const msgRefs = useRef<Record<string, any>>({})
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
        // Don't set lastFetchRef from cache — always do a fresh fetch so
        // reactions on existing messages are up-to-date from the server.
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
      setMessages((prev) => {
        const updated = prev.map((m) => {
          if (m.id !== data.messageId) return m
          const reactions = m.reactions ?? []
          if (data.action === "removed") {
            return { ...m, reactions: reactions.filter((r) => !(r.userId === data.userId && r.emoji === data.emoji)) }
          }
          const exists = reactions.some((r) => r.userId === data.userId && r.emoji === data.emoji)
          if (exists) return m
          return { ...m, reactions: [...reactions, { id: `${data.userId}-${data.emoji}`, userId: data.userId, emoji: data.emoji }] }
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
    setActionState(null)
    setEmojiPickerOpen(false)
    // Optimistic update — persist to cache immediately so reactions survive navigation
    setMessages((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== msg.id) return m
        const reactions = m.reactions ?? []
        const exists = reactions.some((r) => r.userId === myId && r.emoji === emoji)
        return {
          ...m,
          reactions: exists
            ? reactions.filter((r) => !(r.userId === myId && r.emoji === emoji))
            : [...reactions, { id: `opt-${myId}-${emoji}`, userId: myId, emoji }],
        }
      })
      saveCache(ck, updated)
      return updated
    })
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
        behavior="padding"
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
                  ref={(r) => { msgRefs.current[msgId] = r }}
                  onLongPress={() => {
                    if (msg.pending || isSelecting) return
                    msgRefs.current[msgId]?.measure((_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
                      setActionState({ msg, anchor: { pageX, pageY, width: w, height: h } })
                    })
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
                            justifyContent: "center",
                            gap: 5,
                            minWidth: count > 1 ? 54 : 42,
                            minHeight: 32,
                            backgroundColor: mine ? "#f5f3ff" : "#ffffff",
                            borderRadius: 18,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderWidth: 1.5,
                            borderColor: mine ? "#6366f1" : "#c7d2fe",
                            shadowColor: "#6366f1",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: mine ? 0.22 : 0.12,
                            shadowRadius: 4,
                            elevation: mine ? 3 : 2,
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
                setConfirmDialog({
                  title: "Delete Messages",
                  message: `Delete ${count} message${count > 1 ? "s" : ""}? This cannot be undone.`,
                  confirmText: "Delete",
                  onConfirm: deleteSelected,
                })
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

      {/* Message action — floating context menu */}
      <FloatingContextMenu
        visible={!!actionState}
        anchor={actionState?.anchor ?? null}
        emojis={QUICK_EMOJIS}
        reactedEmojis={(actionMsg?.reactions ?? []).filter((r) => r.userId === myId).map((r) => r.emoji)}
        onEmojiPress={(emoji) => actionMsg && toggleReaction(actionMsg, emoji)}
        onMoreEmoji={() => { reactionTargetRef.current = actionMsg; setActionState(null); setEmojiPickerOpen(true) }}
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
          ...(actionMsg?.id ? [{
            label: "Delete",
            icon: "trash-outline",
            color: "#f87171",
            bgColor: "rgba(239,68,68,0.15)",
            onPress: () => {
              if (!actionMsg?.id) return
              const id = actionMsg.id
              setSelectedIds(new Set([id]))
            },
          }] : []),
        ]}
        onDismiss={() => { setActionState(null); setEmojiPickerOpen(false) }}
      />

      {/* Full emoji picker — swipe-down-to-close bottom sheet */}
      {emojiMounted && (
        <Modal transparent visible={emojiMounted} animationType="none" onRequestClose={() => setEmojiPickerOpen(false)} statusBarTranslucent>
          <Animated.View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", opacity: emojiOverlayAnim }}>
            <Pressable style={{ flex: 1 }} onPress={() => setEmojiPickerOpen(false)} />
          </Animated.View>
          <Animated.View
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              backgroundColor: C.card,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              overflow: "hidden",
              transform: [{ translateY: emojiTranslateY }],
            }}
          >
            {/* Drag handle — pan responder lives only here so EmojiKeyboard scrolls freely */}
            <View
              {...emojiPanResponder.panHandlers}
              style={{ width: "100%", alignItems: "center", paddingTop: 10, paddingBottom: 10 }}
            >
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
            </View>
            <EmojiKeyboard
              onEmojiSelected={(e) => {
                const target = reactionTargetRef.current ?? actionState?.msg
                if (target) toggleReaction(target, e.emoji)
              }}
              theme={{
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
          </Animated.View>
        </Modal>
      )}
      {/* Delete confirmation dialog */}
      <Modal visible={!!confirmDialog} transparent animationType="fade" onRequestClose={() => setConfirmDialog(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name="warning-outline" size={26} color="#f87171" />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>{confirmDialog?.title}</Text>
            <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>{confirmDialog?.message}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setConfirmDialog(null)}
                style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
              >
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

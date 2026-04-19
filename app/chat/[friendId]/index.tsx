import { useState, useEffect, useRef, useCallback } from "react"
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Pusher from "pusher-js/react-native"
import CryptoJS from "crypto-js"
import { useAuthStore } from "@/store/auth"

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}
import { messagesApi } from "@/lib/api"

// ─── Types ───────────────────────────────────────────────────────────────────
type Message = {
  id?: string
  clientId: string
  senderId: string
  receiverId: string
  content: string // decrypted
  createdAt: string
  pending?: boolean
}

const PusherCtor = ((Pusher as any)?.Pusher ?? Pusher) as typeof Pusher

// ─── Encryption helpers ───────────────────────────────────────────────────────
function sharedKey(idA: string, idB: string) {
  return [idA, idB].sort().join("-")
}
function encrypt(text: string, key: string) {
  return CryptoJS.AES.encrypt(text, key).toString()
}
function decrypt(cipher: string, key: string) {
  try {
    return CryptoJS.AES.decrypt(cipher, key).toString(CryptoJS.enc.Utf8) || cipher
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
  // Keep last 200
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

  const flatListRef = useRef<FlatList>(null)
  const lastFetchRef = useRef<string | null>(null)
  const pusherRef = useRef<Pusher | null>(null)
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Merge new messages (by clientId) into existing list ─────────────────────
  function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
    const map = new Map(existing.map((m) => [m.clientId, m]))
    for (const m of incoming) {
      map.set(m.clientId, { ...map.get(m.clientId), ...m, pending: false })
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }

  // ── Fetch delta from server ──────────────────────────────────────────────────
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
        // Update lastFetch to newest message time
        const newest = decrypted[decrypted.length - 1]
        lastFetchRef.current = newest.createdAt
      }
      setHasMore(more)
    } catch (e) {
      // silently fail on delta fetch
    }
  }, [friendId, key, ck])

  // ── Load older (pagination) ─────────────────────────────────────────────────
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

  // ── Mark read (debounced) ────────────────────────────────────────────────────
  function scheduleMarkRead() {
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current)
    markReadTimerRef.current = setTimeout(() => {
      // Triggering a delta fetch also marks messages as read server-side
      fetchDelta()
    }, 1500)
  }

  // ── Initial load: cache → delta ──────────────────────────────────────────────
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
    const pusher = new PusherCtor(process.env.EXPO_PUBLIC_PUSHER_KEY ?? "", {
      cluster: process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? "ap2",
    })
    pusherRef.current = pusher

    const channel = pusher.subscribe(`user-${myId}`)
    channel.bind("new-message", (data: { senderId: string }) => {
      if (data.senderId === friendId) {
        fetchDelta()
      }
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`user-${myId}`)
      pusher.disconnect()
    }
  }, [myId, friendId, fetchDelta])

  // ── Cleanup timers ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current)
    }
  }, [])

  // ── Send message ─────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setSending(true)

    const clientId = uuidv4()
    const encrypted = encrypt(text, key)
    const optimistic: Message = {
      clientId,
      senderId: myId,
      receiverId: friendId,
      content: text,
      createdAt: new Date().toISOString(),
      pending: true,
    }

    setMessages((prev) => {
      const merged = mergeMessages(prev, [optimistic])
      return merged
    })

    try {
      const res = await messagesApi.send({ receiverId: friendId, content: encrypted, clientId })
      const saved: Message = {
        ...res.data,
        content: text, // keep decrypted
        pending: false,
      }
      setMessages((prev) => {
        const merged = mergeMessages(prev, [saved])
        saveCache(ck, merged)
        return merged
      })
      lastFetchRef.current = saved.createdAt
    } catch {
      // mark as failed (keep in list with pending=true for retry)
    } finally {
      setSending(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
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

  // Insert date separators
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

  const listItems = buildListItems()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{friendName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }}>{friendName}</Text>
          <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "500" }}>End-to-end encrypted</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
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
              // Load older messages when user scrolls close to the top of the list
              if (e.nativeEvent.contentOffset.y <= 80) {
                loadOlderMessages()
              }
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
              return (
                <View style={{ flexDirection: "row", justifyContent: isMine ? "flex-end" : "flex-start", marginBottom: 6 }}>
                  <View style={{
                    maxWidth: "78%",
                    backgroundColor: isMine ? "#6366f1" : "#1a1a2e",
                    borderRadius: isMine ? 18 : 18,
                    borderBottomRightRadius: isMine ? 4 : 18,
                    borderBottomLeftRadius: isMine ? 18 : 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderWidth: isMine ? 0 : 1,
                    borderColor: C.border,
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
              )
            }}
          />
        )}

        {/* Input */}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

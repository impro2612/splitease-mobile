import { useState, useEffect, useCallback, useRef } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, Linking, Platform, FlatList,
  AppState, AppStateStatus,
} from "react-native"
import * as Contacts from "expo-contacts"
import * as SecureStore from "expo-secure-store"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { router, type Href, useFocusEffect } from "expo-router"
import Pusher from "pusher-js/react-native"
import { friendsApi, usersApi, blocksApi, API_BASE_URL } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"
import { useTheme } from "@/lib/theme"

const SIGNUP_URL = "https://splitwithease.vercel.app/register"

type Tab = "friends" | "requests" | "search"

type Contact = {
  id: string
  name: string
  phone: string
  initials: string
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "").replace(/^00/, "+")
}

type ConfirmDialog = { title: string; message: string; onConfirm: () => void }

export default function Friends() {
  const { user } = useAuthStore()
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>("friends")
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)

  // Search on Add tab
  const [searchQ, setSearchQ] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // Contacts state
  const [contactsPermission, setContactsPermission] = useState<"undetermined" | "granted" | "denied">("undetermined")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)
  // Map: normalizedPhone -> SplitIT user { id, name, email, image }
  const [phoneUserMap, setPhoneUserMap] = useState<Record<string, any>>({})

  // Invite bottom sheet
  const [inviteTarget, setInviteTarget] = useState<Contact | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  // Friend action menu (3-dot)
  const [actionFriend, setActionFriend] = useState<{ friendshipId: string; userId: string; name: string } | null>(null)

  // Search auto-focus
  const searchInputRef = useRef<any>(null)

  // Track AppState for auto-sync
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  const { data: friendsData, isLoading, refetch } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      await friendsApi.sync().catch(() => {})
      const r = await friendsApi.list()
      return r.data && typeof r.data === "object" && !Array.isArray(r.data) ? r.data : {}
    },
  })

  const friends: any[] = friendsData?.friends ?? []
  const incoming: any[] = friendsData?.incoming ?? []
  const outgoing: any[] = friendsData?.outgoing ?? []
  const unreadByFriend: Record<string, number> = friendsData?.unreadByFriend ?? {}

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch])
  )

  // Real-time unread badge updates via Pusher
  useEffect(() => {
    const myId = user?.id
    if (!myId) return
    const PusherCtor = ((Pusher as any)?.Pusher ?? Pusher) as typeof Pusher
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
          } catch (err) { callback(err as Error, null) }
        },
      },
    })
    const channel = pusher.subscribe(`private-user-${myId}`)
    channel.bind("new-message", () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] })
    })
    channel.bind("friend-request", () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] })
    })
    channel.bind("friend-update", () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] })
    })
    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`private-user-${myId}`)
      pusher.disconnect()
    }
  }, [user?.id, queryClient])

  const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours

  async function maybeSyncContacts() {
    const perm = await Contacts.getPermissionsAsync()
    if (perm.status !== "granted") return
    const lastSyncStr = await SecureStore.getItemAsync("contacts_last_sync")
    const lastSync = lastSyncStr ? parseInt(lastSyncStr) : 0
    if (Date.now() - lastSync >= SYNC_INTERVAL_MS) {
      await loadContacts()
    }
  }

  // On mount: check permission + do initial/daily sync
  useEffect(() => {
    Contacts.getPermissionsAsync().then((res) => {
      if (res.status === "granted") {
        setContactsPermission("granted")
        loadContacts()
      } else if (res.status === "denied") {
        setContactsPermission("denied")
      }
    })

    // Auto-sync when app comes to foreground after 24h gap
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        maybeSyncContacts()
      }
      appStateRef.current = nextState
    })

    return () => sub.remove()
  }, [])

  const loadContacts = useCallback(async () => {
    setContactsLoading(true)
    try {
      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        sort: Contacts.SortTypes.FirstName,
      })
      const parsed: Contact[] = []
      for (const c of result.data) {
        if (!c.name || !c.phoneNumbers?.length) continue
        const phone = c.phoneNumbers[0].number ?? ""
        if (!phone) continue
        parsed.push({
          id: c.id ?? Math.random().toString(),
          name: c.name,
          phone,
          initials: getInitials(c.name),
        })
      }
      setContacts(parsed)

      // Lookup which contacts are on SplitEase — batch in 100s to match backend cap
      if (parsed.length > 0) {
        const normalized = parsed.map((c) => normalizePhone(c.phone))
        const BATCH = 100
        const merged: Record<string, unknown> = {}
        for (let i = 0; i < normalized.length; i += BATCH) {
          const res = await usersApi.lookupPhones(normalized.slice(i, i + BATCH)).catch(() => null)
          if (res?.data) Object.assign(merged, res.data)
        }
        setPhoneUserMap(merged)
      }

      // Save last sync timestamp
      await SecureStore.setItemAsync("contacts_last_sync", Date.now().toString())
    } catch {
      Toast.show({ type: "error", text1: "Failed to load contacts" })
    } finally {
      setContactsLoading(false)
    }
  }, [])

  async function requestContactsPermission() {
    const { status } = await Contacts.requestPermissionsAsync()
    if (status === "granted") {
      setContactsPermission("granted")
      await loadContacts()
    } else {
      setContactsPermission("denied")
      Toast.show({ type: "error", text1: "Contacts permission denied" })
    }
  }

  const sendMutation = useMutation({
    mutationFn: (addresseeId: string) => friendsApi.send(addresseeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] })
      queryClient.invalidateQueries({ queryKey: ["activity"] })
      Toast.show({ type: "success", text1: "Friend request sent!" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to send request" }),
  })

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" }) =>
      friendsApi.respond(id, action),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["friends"] })
      if (vars.action === "accept") queryClient.invalidateQueries({ queryKey: ["activity"] })
      Toast.show({ type: "success", text1: vars.action === "accept" ? "Friend added!" : "Request rejected" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to respond" }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => friendsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] })
      Toast.show({ type: "success", text1: "Friend removed" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to remove friend" }),
  })

  const blockMutation = useMutation({
    mutationFn: (blockedId: string) => blocksApi.block(blockedId),
    onSuccess: () => {
      refetch()
      queryClient.invalidateQueries({ queryKey: ["friends"] })
      Toast.show({ type: "success", text1: "User blocked" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to block user" }),
  })

  function confirmRemove(friendId: string, name: string) {
    setConfirmDialog({
      title: "Remove Friend",
      message: `Remove ${name} from your friends? You can always add them back later.`,
      onConfirm: () => removeMutation.mutate(friendId),
    })
  }

  function confirmBlock(userId: string, name: string) {
    setConfirmDialog({
      title: "Block User",
      message: `Block ${name}? They won't be able to message or find you. Their group data remains unchanged.`,
      onConfirm: () => blockMutation.mutate(userId),
    })
  }

  async function doSearch() {
    if (!searchQ.trim() || searchQ.trim().length < 2) return
    setSearching(true)
    try {
      const res = await usersApi.search(searchQ.trim())
      setSearchResults(res.data)
    } catch {
      Toast.show({ type: "error", text1: "Search failed" })
    } finally {
      setSearching(false)
    }
  }

  function openInvite(contact: Contact) {
    const normalized = normalizePhone(contact.phone)
    const splitEaseUser = phoneUserMap[normalized]
    if (splitEaseUser) {
      // Already on SplitIT — send friend request directly
      const alreadyFriend = friends.some((f: any) => f.requesterId === splitEaseUser.id || f.addresseeId === splitEaseUser.id)
      const sentRequest = outgoing.some((r: any) => r.addresseeId === splitEaseUser.id)
      if (alreadyFriend) { Toast.show({ type: "info", text1: `${contact.name} is already your friend` }); return }
      if (sentRequest) { Toast.show({ type: "info", text1: "Friend request already sent" }); return }
      sendMutation.mutate(splitEaseUser.id)
    } else {
      // Not on SplitIT — show invite sheet
      setInviteTarget(contact)
      setShowInvite(true)
    }
  }

  function buildMessage(name: string) {
    return encodeURIComponent(
      `Hey ${name.split(" ")[0]}! 👋 I'm using SplitIT to split bills and track expenses with friends. Join me here:\n${SIGNUP_URL}`
    )
  }

  async function inviteViaWhatsApp() {
    if (!inviteTarget) return
    const phone = normalizePhone(inviteTarget.phone)
    const msg = buildMessage(inviteTarget.name)
    const url = `whatsapp://send?phone=${phone}&text=${msg}`
    const fallback = `https://wa.me/${phone.replace("+", "")}?text=${msg}`
    setShowInvite(false)
    const canOpen = await Linking.canOpenURL(url).catch(() => false)
    Linking.openURL(canOpen ? url : fallback).catch(() =>
      Toast.show({ type: "error", text1: "WhatsApp not installed" })
    )
  }

  async function inviteViaSMS() {
    if (!inviteTarget) return
    const phone = normalizePhone(inviteTarget.phone)
    const msg = buildMessage(inviteTarget.name)
    // Android uses ?body=, iOS uses &body=
    const separator = Platform.OS === "android" ? "?" : "&"
    const url = `sms:${phone}${separator}body=${msg}`
    setShowInvite(false)
    Linking.openURL(url).catch(() =>
      Toast.show({ type: "error", text1: "Could not open SMS" })
    )
  }

  const filteredContacts = searchQ.trim().length > 0
    ? contacts.filter((c) => c.name.toLowerCase().includes(searchQ.toLowerCase()) || c.phone.includes(searchQ))
    : contacts

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "friends", label: "Friends", badge: friends.length },
    { key: "requests", label: "Requests", badge: incoming.length || undefined },
    { key: "search", label: "Add" },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: "800" }}>Friends</Text>
          <Text style={{ color: C.textMuted, fontSize: 13 }}>{friends.length} friend{friends.length !== 1 ? "s" : ""}</Text>
        </View>
        {tab === "search" && contactsPermission === "granted" && (
          <TouchableOpacity
            onPress={loadContacts}
            disabled={contactsLoading}
            style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            {contactsLoading
              ? <ActivityIndicator size="small" color="#a5b4fc" />
              : <Ionicons name="sync" size={16} color="#a5b4fc" />}
            <Text style={{ color: "#a5b4fc", fontSize: 12, fontWeight: "600" }}>Sync</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 16 }}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => {
              setTab(t.key)
            }}
            style={{
              flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
              backgroundColor: tab === t.key ? "#6366f1" : "rgba(255,255,255,0.06)",
              borderRadius: 12, paddingVertical: 9, gap: 6,
            }}
          >
            <Text style={{ color: tab === t.key ? "#fff" : C.textSub, fontWeight: "600", fontSize: 13 }}>{t.label}</Text>
            {t.badge ? (
              <View style={{ backgroundColor: tab === t.key ? "rgba(255,255,255,0.3)" : "#6366f1", borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                <Text style={{ color: C.text, fontSize: 10, fontWeight: "700" }}>{t.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* Friends Tab */}
      {tab === "friends" && (
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
          ) : friends.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🤝</Text>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>No friends yet</Text>
              <Text style={{ color: C.textMuted, fontSize: 14, textAlign: "center", marginBottom: 24 }}>Search for people or invite from your contacts</Text>
              <TouchableOpacity onPress={() => setTab("search")} style={{ backgroundColor: "#6366f1", borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 }}>
                <Text style={{ color: C.text, fontWeight: "600" }}>Find friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 8, paddingBottom: 32 }}>
              {friends.map((f: any) => {
                const other = f.requesterId === user?.id ? f.addressee : f.requester
                const hasUnread = !!(other?.id && unreadByFriend[other.id])
                return (
                  <View key={f.id} style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Avatar name={other?.name} email={other?.email} image={other?.image} size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{other?.name ?? "Unknown"}</Text>
                      <Text style={{ color: C.textMuted, fontSize: 12 }} numberOfLines={1}>{other?.email}</Text>
                    </View>
                    {/* Chat icon */}
                    <TouchableOpacity
                      onPress={() => {
                        if (!other?.id) return
                        router.push({
                          pathname: "/chat/[friendId]",
                          params: { friendId: other.id, name: other.name ?? "" },
                        } as unknown as Href)
                      }}
                      style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(34,197,94,0.15)", alignItems: "center", justifyContent: "center", position: "relative" }}
                    >
                      <Ionicons name="chatbubble-ellipses" size={17} color="#4ade80" />
                      {hasUnread && (
                        <View style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: C.card, paddingHorizontal: 3 }}>
                          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", lineHeight: 10 }}>1</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {/* 3-dot menu */}
                    <TouchableOpacity
                      onPress={() => setActionFriend({ friendshipId: f.id, userId: other?.id, name: other?.name ?? "this user" })}
                      style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={C.textSub} />
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Requests Tab */}
      {tab === "requests" && (
        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16, paddingBottom: 32 }}>
            {incoming.length > 0 && (
              <View>
                <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Incoming ({incoming.length})</Text>
                <View style={{ gap: 8 }}>
                  {incoming.map((r: any) => (
                    <View key={r.id} style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Avatar name={r.requester?.name} email={r.requester?.email} image={r.requester?.image} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: C.text, fontWeight: "600" }} numberOfLines={1}>{r.requester?.name}</Text>
                        <Text style={{ color: C.textMuted, fontSize: 12 }} numberOfLines={1}>{r.requester?.email}</Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity onPress={() => respondMutation.mutate({ id: r.id, action: "accept" })} disabled={respondMutation.isPending} style={{ backgroundColor: "#6366f1", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => respondMutation.mutate({ id: r.id, action: "reject" })} disabled={respondMutation.isPending} style={{ backgroundColor: "rgba(244,63,94,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                          <Ionicons name="close" size={16} color="#f87171" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmBlock(r.requester?.id, r.requester?.name ?? "this user")} style={{ backgroundColor: "rgba(239,68,68,0.18)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
                          <Ionicons name="ban" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {outgoing.length > 0 && (
              <View>
                <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Sent ({outgoing.length})</Text>
                <View style={{ gap: 8 }}>
                  {outgoing.map((r: any) => (
                    <View key={r.id} style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Avatar name={r.addressee?.name} email={r.addressee?.email} image={r.addressee?.image} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: C.text, fontWeight: "600" }} numberOfLines={1}>{r.addressee?.name}</Text>
                        <Text style={{ color: C.textMuted, fontSize: 12 }} numberOfLines={1}>{r.addressee?.email}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "600" }}>Pending</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setConfirmDialog({
                            title: "Cancel Request",
                            message: `Cancel your friend request to ${r.addressee?.name ?? "this person"}?`,
                            onConfirm: () => removeMutation.mutate(r.id),
                          })}
                          disabled={removeMutation.isPending}
                          style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(244,63,94,0.15)", alignItems: "center", justifyContent: "center" }}
                        >
                          <Ionicons name="close" size={16} color="#f87171" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {incoming.length === 0 && outgoing.length === 0 && (
              <View style={{ alignItems: "center", paddingTop: 80 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>📬</Text>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>No requests</Text>
                <Text style={{ color: C.textMuted, fontSize: 14, textAlign: "center" }}>Friend requests will appear here</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Add / Search Tab */}
      {tab === "search" && (
        <View style={{ flex: 1 }}>
          {/* Single unified search bar */}
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 14 }}>
            <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 50 }}>
              <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                ref={searchInputRef}
                style={{ color: C.text, flex: 1, fontSize: 15 }}
                placeholder="Search by name or email…"
                placeholderTextColor={C.textMuted}
                value={searchQ}
                onChangeText={(t) => { setSearchQ(t); if (!t) setSearchResults([]) }}
                onSubmitEditing={doSearch}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {searchQ.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQ(""); setSearchResults([]) }}>
                  <Ionicons name="close-circle" size={16} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={doSearch} style={{ backgroundColor: "#6366f1", borderRadius: 14, width: 50, alignItems: "center", justifyContent: "center" }}>
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="search" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>

          {/* Content area */}
          {contactsPermission === "undetermined" && !searchQ ? (
            /* First-time: center sync prompt */
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
              <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <Ionicons name="people" size={38} color="#a5b4fc" />
              </View>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: "700", marginBottom: 10, textAlign: "center" }}>Sync Phone Contacts</Text>
              <Text style={{ color: C.textMuted, fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 32 }}>
                Find friends already on SplitIT or invite your contacts to join you.
              </Text>
              <TouchableOpacity onPress={requestContactsPermission} style={{ backgroundColor: "#6366f1", borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="sync" size={18} color="#fff" />
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Sync Contacts</Text>
              </TouchableOpacity>
            </View>

          ) : contactsPermission === "denied" && !searchQ ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Contacts access denied</Text>
              <Text style={{ color: C.textMuted, fontSize: 14, textAlign: "center", marginBottom: 24 }}>Enable contacts access in Settings to invite friends.</Text>
              <TouchableOpacity onPress={() => Linking.openSettings()} style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
                <Text style={{ color: C.text, fontWeight: "600" }}>Open Settings</Text>
              </TouchableOpacity>
            </View>

          ) : contactsLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
              <ActivityIndicator color="#6366f1" size="large" />
              <Text style={{ color: C.textMuted, fontSize: 14 }}>Loading contacts…</Text>
            </View>

          ) : (
            /* Unified list: SplitIT results (if searched) + phone contacts (filtered live) */
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <>
                  {/* SplitIT search results section */}
                  {searchResults.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>On SplitIT</Text>
                      {searchResults.map((u: any) => {
                        const alreadyFriend = friends.some((f: any) => f.requesterId === u.id || f.addresseeId === u.id)
                        const sentRequest = outgoing.some((r: any) => r.addresseeId === u.id)
                        const isMe = u.id === user?.id
                        return (
                          <View key={u.id} style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
                            <Avatar name={u.name} email={u.email} image={u.image} size={44} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ color: C.text, fontWeight: "600" }} numberOfLines={1}>{u.name}</Text>
                              <Text style={{ color: C.textMuted, fontSize: 12 }} numberOfLines={1}>{u.email}</Text>
                            </View>
                            {isMe ? (
                              <Text style={{ color: C.textMuted, fontSize: 12 }}>You</Text>
                            ) : alreadyFriend ? (
                              <View style={{ backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                                <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "600" }}>Friends</Text>
                              </View>
                            ) : sentRequest ? (
                              <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                                <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "600" }}>Sent</Text>
                              </View>
                            ) : (
                              <TouchableOpacity onPress={() => sendMutation.mutate(u.id)} disabled={sendMutation.isPending} style={{ backgroundColor: "#6366f1", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4 }}>
                                <Ionicons name="person-add" size={13} color="#fff" />
                                <Text style={{ color: C.text, fontSize: 12, fontWeight: "600" }}>Add</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )
                      })}
                    </View>
                  )}
                  {/* Contacts section header */}
                  {filteredContacts.length > 0 && (
                    <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                      {searchQ ? `${filteredContacts.length} matching contact${filteredContacts.length !== 1 ? "s" : ""}` : `${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`}
                    </Text>
                  )}
                  {searchQ.length >= 2 && filteredContacts.length === 0 && searchResults.length === 0 && !searching && (
                    <View style={{ alignItems: "center", paddingTop: 40 }}>
                      <Text style={{ fontSize: 36, marginBottom: 10 }}>🔍</Text>
                      <Text style={{ color: C.text, fontWeight: "600", marginBottom: 4 }}>No results for "{searchQ}"</Text>
                      <Text style={{ color: C.textMuted, fontSize: 13, textAlign: "center" }}>Try a different name, email, or phone number</Text>
                    </View>
                  )}
                </>
              }
              renderItem={({ item }) => {
                const normalized = normalizePhone(item.phone)
                const splitEaseUser = phoneUserMap[normalized]
                const alreadyFriend = splitEaseUser && friends.some((f: any) => f.requesterId === splitEaseUser.id || f.addresseeId === splitEaseUser.id)
                const sentRequest = splitEaseUser && outgoing.some((r: any) => r.addresseeId === splitEaseUser.id)
                return (
                  <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: splitEaseUser ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)", padding: 12, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: splitEaseUser ? "rgba(99,102,241,0.15)" : "#6366f122", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#a5b4fc", fontWeight: "700", fontSize: 15 }}>{item.initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                        {splitEaseUser && (
                          <View style={{ backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                            <Text style={{ color: "#a5b4fc", fontSize: 9, fontWeight: "700" }}>ON APP</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: C.textMuted, fontSize: 12 }}>{item.phone}</Text>
                    </View>
                    {alreadyFriend ? (
                      <View style={{ backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "600" }}>Friends</Text>
                      </View>
                    ) : sentRequest ? (
                      <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "600" }}>Sent</Text>
                      </View>
                    ) : splitEaseUser ? (
                      <TouchableOpacity onPress={() => openInvite(item)} style={{ backgroundColor: "#6366f1", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Ionicons name="person-add-outline" size={13} color="#fff" />
                        <Text style={{ color: C.text, fontSize: 12, fontWeight: "600" }}>Add</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => openInvite(item)} style={{ backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Ionicons name="paper-plane-outline" size={13} color="#a5b4fc" />
                        <Text style={{ color: "#a5b4fc", fontSize: 12, fontWeight: "600" }}>Invite</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              }}
            />
          )}
        </View>
      )}

      {/* Friend action bottom sheet (3-dot) */}
      <Modal visible={!!actionFriend} transparent animationType="slide" onRequestClose={() => setActionFriend(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} activeOpacity={1} onPress={() => setActionFriend(null)} />
        <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Math.max(40, insets.bottom + 24), borderTopWidth: 1, borderColor: C.border }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 20 }} />
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 16, textAlign: "center" }}>{actionFriend?.name}</Text>
          <TouchableOpacity
            onPress={() => { setActionFriend(null); if (actionFriend) confirmRemove(actionFriend.friendshipId, actionFriend.name) }}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: "rgba(244,63,94,0.08)", borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: "rgba(244,63,94,0.15)" }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(244,63,94,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="person-remove" size={18} color="#f87171" />
            </View>
            <View>
              <Text style={{ color: "#f87171", fontWeight: "600", fontSize: 15 }}>Remove Friend</Text>
              <Text style={{ color: C.textMuted, fontSize: 12 }}>Remove from your friends list</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setActionFriend(null); if (actionFriend) confirmBlock(actionFriend.userId, actionFriend.name) }}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(239,68,68,0.15)" }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="ban" size={18} color="#ef4444" />
            </View>
            <View>
              <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 15 }}>Block User</Text>
              <Text style={{ color: C.textMuted, fontSize: 12 }}>Block and remove from friends</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Remove Friend Confirm Dialog */}
      <Modal visible={!!confirmDialog} transparent animationType="fade" onRequestClose={() => setConfirmDialog(null)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name="person-remove-outline" size={26} color="#f87171" />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>{confirmDialog?.title}</Text>
            <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>{confirmDialog?.message}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setConfirmDialog(null)}
                style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.borderStrong, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { confirmDialog?.onConfirm(); setConfirmDialog(null) }}
                style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Bottom Sheet */}
      <Modal visible={showInvite} transparent animationType="fade" onRequestClose={() => setShowInvite(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setShowInvite(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 20 }} />
              <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>Invite {inviteTarget?.name?.split(" ")[0]}</Text>
              <Text style={{ color: C.textMuted, fontSize: 13, marginBottom: 24 }}>{inviteTarget?.phone}</Text>

              <TouchableOpacity
                onPress={inviteViaWhatsApp}
                style={{ backgroundColor: "rgba(37,211,102,0.12)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(37,211,102,0.25)", padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(37,211,102,0.15)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 22 }}>💬</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>WhatsApp</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>Send invite via WhatsApp</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={inviteViaSMS}
                style={{ backgroundColor: "rgba(99,102,241,0.1)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 22 }}>✉️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>SMS</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>Send invite via text message</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

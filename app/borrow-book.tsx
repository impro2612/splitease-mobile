import { useState } from "react"
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, ActivityIndicator, Pressable, Alert, RefreshControl,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { borrowBookApi, friendsApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import Toast from "react-native-toast-message"

const ACCENT = "#f59e0b"
const ACCENT_BG = "rgba(245,158,11,0.12)"
const ACCENT_BORDER = "rgba(245,158,11,0.3)"

type Entry = {
  id: string
  lenderId: string
  borrowerId: string
  amount: number
  currency: string
  note?: string
  status: "PENDING" | "SETTLED"
  createdAt: string
  settledAt?: string
  lender: { id: string; name?: string; email: string }
  borrower: { id: string; name?: string; email: string }
}

type FriendSummary = {
  friend: { id: string; name?: string; email: string }
  net: number
  pendingCount: number
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.4 }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  )
}

function fmt(amount: number, currency = "INR") {
  const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }
  const sym = symbols[currency] ?? currency
  return `${sym}${Math.abs(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default function BorrowBook() {
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const [selectedFriend, setSelectedFriend] = useState<FriendSummary | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addFriendId, setAddFriendId] = useState("")
  const [addAmount, setAddAmount] = useState("")
  const [addNote, setAddNote] = useState("")
  const [addIAmLender, setAddIAmLender] = useState(true)
  const [addCurrency, setAddCurrency] = useState("INR")

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["borrow-book"],
    queryFn: async () => {
      const res = await borrowBookApi.list()
      return res.data as { entries: Entry[]; friends: FriendSummary[] }
    },
  })

  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => { const res = await friendsApi.list(); return res.data },
  })

  const acceptedFriends: any[] = (friendsData?.accepted ?? []).map((f: any) => {
    return f.requesterId === user?.id ? f.addressee : f.requester
  })

  const createMutation = useMutation({
    mutationFn: () => borrowBookApi.create({
      friendId: addFriendId,
      amount: parseFloat(addAmount),
      note: addNote.trim() || undefined,
      iAmLender: addIAmLender,
      currency: addCurrency,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borrow-book"] })
      setShowAdd(false); resetAddForm()
      Toast.show({ type: "success", text1: "IOU recorded" })
    },
    onError: (e: any) => Toast.show({ type: "error", text1: e?.response?.data?.error ?? "Failed to create" }),
  })

  const settleMutation = useMutation({
    mutationFn: (id: string) => borrowBookApi.settle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["borrow-book"] }); Toast.show({ type: "success", text1: "Marked as settled ✓" }) },
    onError: () => Toast.show({ type: "error", text1: "Failed to settle" }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => borrowBookApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["borrow-book"] }); Toast.show({ type: "success", text1: "Entry deleted" }) },
    onError: () => Toast.show({ type: "error", text1: "Failed to delete" }),
  })

  function resetAddForm() {
    setAddFriendId(""); setAddAmount(""); setAddNote(""); setAddIAmLender(true); setAddCurrency("INR")
  }

  const entries = data?.entries ?? []
  const friends = data?.friends ?? []

  const friendEntries = selectedFriend
    ? entries.filter((e) => e.lenderId === selectedFriend.friend.id || e.borrowerId === selectedFriend.friend.id)
    : []
  const pendingEntries = friendEntries.filter((e) => e.status === "PENDING")
  const settledEntries = friendEntries.filter((e) => e.status === "SETTLED")

  const totalLent = entries.filter((e) => e.lenderId === user?.id && e.status === "PENDING").reduce((s, e) => s + e.amount, 0)
  const totalBorrowed = entries.filter((e) => e.borrowerId === user?.id && e.status === "PENDING").reduce((s, e) => s + e.amount, 0)

  const theyOweMe = friends.filter((f) => f.net > 0)
  const iOweThem = friends.filter((f) => f.net < 0)
  const allSettled = friends.filter((f) => f.net === 0 && f.pendingCount === 0)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="book-outline" size={20} color={ACCENT} />
        </View>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", flex: 1 }}>The Borrow Book</Text>
        <TouchableOpacity
          onPress={() => { resetAddForm(); setShowAdd(true) }}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="add" size={22} color={ACCENT} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={ACCENT} />}
        >
          {/* Summary cards */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8, marginBottom: 20 }}>
            <View style={{ flex: 1, backgroundColor: "rgba(74,222,128,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(74,222,128,0.25)", padding: 16 }}>
              <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "600", marginBottom: 6 }}>THEY OWE YOU</Text>
              <Text style={{ color: "#4ade80", fontSize: 20, fontWeight: "800" }}>{fmt(totalLent / 100)}</Text>
              <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{theyOweMe.length} {theyOweMe.length === 1 ? "person" : "people"}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(248,113,113,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(248,113,113,0.25)", padding: 16 }}>
              <Text style={{ color: "#6b7280", fontSize: 11, fontWeight: "600", marginBottom: 6 }}>YOU OWE</Text>
              <Text style={{ color: "#f87171", fontSize: 20, fontWeight: "800" }}>{fmt(totalBorrowed / 100)}</Text>
              <Text style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{iOweThem.length} {iOweThem.length === 1 ? "person" : "people"}</Text>
            </View>
          </View>

          {/* Empty state */}
          {friends.length === 0 && (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Ionicons name="book-outline" size={36} color={ACCENT} />
              </View>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8 }}>No IOUs yet</Text>
              <Text style={{ color: C.textSub, fontSize: 14, textAlign: "center", lineHeight: 22 }}>Tap + to record a lend or borrow with a friend</Text>
            </View>
          )}

          {/* They owe you */}
          {theyOweMe.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: "#4ade80", fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 0.5 }}>THEY OWE YOU</Text>
              <View style={{ gap: 8 }}>
                {theyOweMe.map((f) => (
                  <TouchableOpacity key={f.friend.id} onPress={() => setSelectedFriend(f)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}
                  >
                    <Avatar name={f.friend.name ?? f.friend.email} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{f.friend.name ?? f.friend.email}</Text>
                      <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{f.pendingCount} pending {f.pendingCount === 1 ? "entry" : "entries"}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: "#4ade80", fontWeight: "800", fontSize: 16 }}>+{fmt(f.net)}</Text>
                      <Ionicons name="chevron-forward" size={14} color={C.textSub} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* You owe them */}
          {iOweThem.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 0.5 }}>YOU OWE</Text>
              <View style={{ gap: 8 }}>
                {iOweThem.map((f) => (
                  <TouchableOpacity key={f.friend.id} onPress={() => setSelectedFriend(f)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}
                  >
                    <Avatar name={f.friend.name ?? f.friend.email} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{f.friend.name ?? f.friend.email}</Text>
                      <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{f.pendingCount} pending {f.pendingCount === 1 ? "entry" : "entries"}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: "#f87171", fontWeight: "800", fontSize: 16 }}>{fmt(f.net)}</Text>
                      <Ionicons name="chevron-forward" size={14} color={C.textSub} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* All settled */}
          {allSettled.length > 0 && (
            <View>
              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 0.5 }}>ALL SETTLED</Text>
              <View style={{ gap: 8 }}>
                {allSettled.map((f) => (
                  <TouchableOpacity key={f.friend.id} onPress={() => setSelectedFriend(f)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}
                  >
                    <Avatar name={f.friend.name ?? f.friend.email} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{f.friend.name ?? f.friend.email}</Text>
                      <Text style={{ color: "#4ade80", fontSize: 12, marginTop: 2 }}>All settled ✓</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={C.textSub} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Friend Detail Sheet ─────────────────────────────────────────────── */}
      <Modal visible={!!selectedFriend} transparent animationType="slide" onRequestClose={() => setSelectedFriend(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelectedFriend(null)} />
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%", paddingBottom: insets.bottom + 16 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
            {selectedFriend && (
              <>
                {/* Friend header */}
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 12, marginBottom: 16 }}>
                  <Avatar name={selectedFriend.friend.name ?? selectedFriend.friend.email} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 17, fontWeight: "800" }}>{selectedFriend.friend.name ?? selectedFriend.friend.email}</Text>
                    {selectedFriend.net > 0 && <Text style={{ color: "#4ade80", fontSize: 13, fontWeight: "600", marginTop: 2 }}>Owes you {fmt(selectedFriend.net)}</Text>}
                    {selectedFriend.net < 0 && <Text style={{ color: "#f87171", fontSize: 13, fontWeight: "600", marginTop: 2 }}>You owe {fmt(Math.abs(selectedFriend.net))}</Text>}
                    {selectedFriend.net === 0 && <Text style={{ color: "#4ade80", fontSize: 13, fontWeight: "600", marginTop: 2 }}>All settled ✓</Text>}
                  </View>
                  <TouchableOpacity
                    onPress={() => { setSelectedFriend(null); setAddFriendId(selectedFriend.friend.id); setShowAdd(true) }}
                    style={{ backgroundColor: ACCENT_BG, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: ACCENT_BORDER }}
                  >
                    <Text style={{ color: ACCENT, fontWeight: "700", fontSize: 13 }}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                  {/* Pending entries */}
                  {pendingEntries.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>PENDING</Text>
                      <View style={{ gap: 8 }}>
                        {pendingEntries.map((e) => {
                          const iAmLender = e.lenderId === user?.id
                          return (
                            <View key={e.id} style={{ backgroundColor: C.bg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, gap: 10 }}>
                              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: iAmLender ? "#4ade80" : "#f87171", fontWeight: "800", fontSize: 17 }}>
                                    {iAmLender ? "+" : "-"}{fmt(e.amount, e.currency)}
                                  </Text>
                                  {e.note ? <Text style={{ color: C.text, fontSize: 13, marginTop: 3 }}>{e.note}</Text> : null}
                                  <Text style={{ color: C.textSub, fontSize: 11, marginTop: 3 }}>
                                    {iAmLender ? "You lent" : "You borrowed"} · {new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                  </Text>
                                </View>
                              </View>
                              <View style={{ flexDirection: "row", gap: 8 }}>
                                <TouchableOpacity
                                  onPress={() => Alert.alert("Mark as Settled", "Confirm this amount has been paid back?", [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Yes, Settle", onPress: () => settleMutation.mutate(e.id) },
                                  ])}
                                  style={{ flex: 1, height: 36, borderRadius: 10, backgroundColor: "rgba(74,222,128,0.1)", borderWidth: 1, borderColor: "rgba(74,222,128,0.3)", alignItems: "center", justifyContent: "center" }}
                                >
                                  <Text style={{ color: "#4ade80", fontWeight: "700", fontSize: 13 }}>✓ Mark Settled</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => Alert.alert("Delete Entry", "Remove this IOU record permanently?", [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(e.id) },
                                  ])}
                                  style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", alignItems: "center", justifyContent: "center" }}
                                >
                                  <Ionicons name="trash-outline" size={15} color="#f87171" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                  )}

                  {/* Settled history */}
                  {settledEntries.length > 0 && (
                    <View>
                      <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 }}>HISTORY</Text>
                      <View style={{ gap: 6 }}>
                        {settledEntries.map((e) => {
                          const iAmLender = e.lenderId === user?.id
                          return (
                            <View key={e.id} style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", opacity: 0.6 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>{fmt(e.amount, e.currency)} {iAmLender ? "lent" : "borrowed"}</Text>
                                {e.note ? <Text style={{ color: C.textSub, fontSize: 12 }}>{e.note}</Text> : null}
                                <Text style={{ color: C.textSub, fontSize: 11, marginTop: 2 }}>
                                  Settled {e.settledAt ? new Date(e.settledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                                </Text>
                              </View>
                              <View style={{ backgroundColor: "rgba(74,222,128,0.1)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "700" }}>SETTLED</Text>
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    </View>
                  )}

                  {pendingEntries.length === 0 && settledEntries.length === 0 && (
                    <Text style={{ color: C.textSub, textAlign: "center", marginTop: 40 }}>No entries yet</Text>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Add IOU Sheet ───────────────────────────────────────────────────── */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => { setShowAdd(false); resetAddForm() }}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => { setShowAdd(false); resetAddForm() }} />
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 20, paddingHorizontal: 20 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginTop: 12, marginBottom: 20 }} />
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 20 }}>Record an IOU</Text>

            {/* Friend picker */}
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>WITH FRIEND</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {acceptedFriends.map((f: any) => {
                  const selected = addFriendId === f.id
                  return (
                    <TouchableOpacity key={f.id} onPress={() => setAddFriendId(f.id)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: selected ? ACCENT_BG : C.bg, borderWidth: selected ? 1.5 : 1, borderColor: selected ? ACCENT : C.border, flexDirection: "row", alignItems: "center", gap: 8 }}
                    >
                      <Avatar name={f.name ?? f.email} size={24} />
                      <Text style={{ color: selected ? ACCENT : C.text, fontWeight: selected ? "700" : "500", fontSize: 14 }}>{f.name ?? f.email}</Text>
                    </TouchableOpacity>
                  )
                })}
                {acceptedFriends.length === 0 && (
                  <Text style={{ color: C.textSub, fontSize: 13, paddingVertical: 8 }}>Add friends first to record IOUs</Text>
                )}
              </View>
            </ScrollView>

            {/* Direction */}
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>DIRECTION</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <TouchableOpacity onPress={() => setAddIAmLender(true)}
                style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: addIAmLender ? "rgba(74,222,128,0.12)" : C.bg, borderWidth: addIAmLender ? 1.5 : 1, borderColor: addIAmLender ? "#4ade80" : C.border }}
              >
                <Text style={{ color: addIAmLender ? "#4ade80" : C.textSub, fontWeight: "700", fontSize: 14 }}>I Lent</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddIAmLender(false)}
                style={{ flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: !addIAmLender ? "rgba(248,113,113,0.12)" : C.bg, borderWidth: !addIAmLender ? 1.5 : 1, borderColor: !addIAmLender ? "#f87171" : C.border }}
              >
                <Text style={{ color: !addIAmLender ? "#f87171" : C.textSub, fontWeight: "700", fontSize: 14 }}>I Borrowed</Text>
              </TouchableOpacity>
            </View>

            {/* Amount + currency */}
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>AMOUNT</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              <View style={{ flex: 1, height: 48, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }}>
                <Text style={{ color: C.textSub, fontSize: 16, marginRight: 4 }}>
                  {addCurrency === "INR" ? "₹" : addCurrency === "USD" ? "$" : addCurrency === "EUR" ? "€" : "£"}
                </Text>
                <TextInput
                  style={{ flex: 1, color: C.text, fontSize: 17, fontWeight: "700" }}
                  placeholder="0.00"
                  placeholderTextColor={C.textMuted}
                  keyboardType="decimal-pad"
                  value={addAmount}
                  onChangeText={setAddAmount}
                />
              </View>
              {(["INR", "USD", "EUR", "GBP"] as const).map((cur) => (
                <TouchableOpacity key={cur} onPress={() => setAddCurrency(cur)}
                  style={{ paddingHorizontal: 10, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: addCurrency === cur ? ACCENT_BG : C.bg, borderWidth: addCurrency === cur ? 1.5 : 1, borderColor: addCurrency === cur ? ACCENT : C.border }}
                >
                  <Text style={{ color: addCurrency === cur ? ACCENT : C.textSub, fontWeight: "700", fontSize: 12 }}>{cur}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Note */}
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>NOTE (optional)</Text>
            <View style={{ height: 44, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, justifyContent: "center", marginBottom: 20 }}>
              <TextInput
                style={{ color: C.text, fontSize: 14 }}
                placeholder="e.g. dinner, auto fare, chai…"
                placeholderTextColor={C.textMuted}
                value={addNote}
                onChangeText={setAddNote}
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={() => createMutation.mutate()}
              disabled={!addFriendId || !addAmount || parseFloat(addAmount || "0") <= 0 || createMutation.isPending}
              style={{ height: 52, borderRadius: 16, backgroundColor: (!addFriendId || !addAmount || parseFloat(addAmount || "0") <= 0) ? "rgba(245,158,11,0.3)" : ACCENT, alignItems: "center", justifyContent: "center" }}
            >
              {createMutation.isPending
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Save IOU</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

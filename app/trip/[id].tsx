import { useRef, useState } from "react"
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, ActivityIndicator, RefreshControl, Alert,
  Animated, PanResponder, useWindowDimensions, Pressable,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { tripsApi, groupsApi } from "@/lib/api"
import Toast from "react-native-toast-message"

const TEAL = "#10b981"
const TEAL_BG = "rgba(16,185,129,0.12)"
const TEAL_BORDER = "rgba(16,185,129,0.3)"

const TRIP_CATEGORIES = [
  { key: "accommodation", label: "Stay", emoji: "🏨", color: "#6366f1" },
  { key: "food", label: "Food", emoji: "🍔", color: "#f59e0b" },
  { key: "transport", label: "Transport", emoji: "🚗", color: "#10b981" },
  { key: "entertainment", label: "Activities", emoji: "🎯", color: "#ec4899" },
  { key: "shopping", label: "Shopping", emoji: "🛍️", color: "#8b5cf6" },
  { key: "health", label: "Medical", emoji: "💊", color: "#ef4444" },
  { key: "travel", label: "Flights", emoji: "✈️", color: "#06b6d4" },
  { key: "general", label: "Other", emoji: "💸", color: "#6b7280" },
]

type TripDetail = {
  id: string; name: string; emoji: string
  startDate: string; endDate: string
  totalBudget: number; currency: string; status: string
  actualSpent: number; groupId?: string | null
  group?: { id: string; name: string; emoji: string; color: string } | null
  categories: { id: string; category: string; amount: number }[]
  categoryActuals: Record<string, number>
  memberSpending: { user: { id: string; name?: string; email: string }; paid: number }[]
  recentExpenses: { id: string; description: string; amount: number; category: string; date: string; paidBy: { name?: string; email: string } }[]
}

const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }

function fmt(amount: number, currency = "INR") {
  return `${symbols[currency] ?? currency}${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.38 }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  )
}

function SwipeSheet({
  visible, onClose, children, sheetStyle,
}: { visible: boolean; onClose: () => void; children: React.ReactNode; sheetStyle?: object }) {
  const { height } = useWindowDimensions()
  const hidden = Math.max(300, height)
  const [mounted, setMounted] = useState(visible)
  const slideAnim = useRef(new Animated.Value(hidden)).current
  const panY = useRef(new Animated.Value(0)).current
  const overlayAnim = useRef(new Animated.Value(0)).current
  const translateY = Animated.add(slideAnim, panY.interpolate({ inputRange: [-9999, 0, 9999], outputRange: [0, 0, 9999] }))

  function close() {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: hidden, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { panY.setValue(0); setMounted(false); onClose() })
  }

  const prevVisible = useRef(visible)
  if (prevVisible.current !== visible) {
    prevVisible.current = visible
    if (visible) {
      setMounted(true); panY.setValue(0); slideAnim.setValue(hidden); overlayAnim.setValue(0)
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      close()
    }
  }

  const shouldDrag = (_: any, g: any) => g.dy > 8 && g.dy > Math.abs(g.dx)
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: shouldDrag,
    onMoveShouldSetPanResponderCapture: shouldDrag,
    onPanResponderMove: (_: any, g: any) => { if (g.dy > 0) panY.setValue(g.dy) },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_: any, g: any) => {
      if (g.dy > 80 || g.vy > 0.5) { slideAnim.setValue(Math.max(0, g.dy)); panY.setValue(0); close() }
      else Animated.spring(panY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start()
    },
  })).current

  if (!mounted) return null
  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={close}>
      <Animated.View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", opacity: overlayAnim }}>
        <Pressable style={{ flex: 1 }} onPress={close} />
      </Animated.View>
      <Animated.View {...pan.panHandlers} style={[{ position: "absolute", left: 0, right: 0, bottom: 0, transform: [{ translateY }] }, sheetStyle]}>
        {children}
      </Animated.View>
    </Modal>
  )
}

export default function TripDetail() {
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [catAmount, setCatAmount] = useState("")
  const [showLinkGroup, setShowLinkGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: trip, isLoading, refetch } = useQuery<TripDetail>({
    queryKey: ["trip", id],
    queryFn: async () => { const r = await tripsApi.get(id); return r.data },
    enabled: !!id,
  })

  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ["groups"],
    queryFn: async () => { const r = await groupsApi.list(); return r.data },
  })

  const saveCatMutation = useMutation({
    mutationFn: (amount: number) => tripsApi.update(id, {
      categories: [{ category: editingCategory!, amount }],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trip", id] }); setEditingCategory(null); setCatAmount("") },
    onError: () => Toast.show({ type: "error", text1: "Failed to save" }),
  })

  const linkGroupMutation = useMutation({
    mutationFn: (gid: string | null) => tripsApi.update(id, { groupId: gid }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trip", id] }); setShowLinkGroup(false); Toast.show({ type: "success", text1: "Group linked!" }) },
  })

  const deleteMutation = useMutation({
    mutationFn: () => tripsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); router.back() },
  })

  if (isLoading || !trip) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }} edges={["top"]}>
        <ActivityIndicator color={TEAL} size="large" />
      </SafeAreaView>
    )
  }

  const pct = trip.totalBudget > 0 ? Math.min(1, trip.actualSpent / trip.totalBudget) : 0
  const remaining = trip.totalBudget - trip.actualSpent
  const barColor = pct > 0.9 ? "#ef4444" : pct > 0.7 ? "#f59e0b" : TEAL

  const allocatedTotal = trip.categories.reduce((s, c) => s + c.amount, 0)
  const unallocated = trip.totalBudget - allocatedTotal

  const categoryMap = new Map(trip.categories.map(c => [c.category, c]))

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: TEAL_BG, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20 }}>{trip.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>{trip.name}</Text>
          <Text style={{ color: C.textSub, fontSize: 11 }}>{fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}</Text>
        </View>
        <TouchableOpacity onPress={() => setConfirmDelete(true)} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="trash-outline" size={18} color="#f87171" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={TEAL} />}>

        {/* Budget overview cards */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: "center" }}>
            <Text style={{ color: C.textSub, fontSize: 10, fontWeight: "700", marginBottom: 4 }}>BUDGET</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>{fmt(trip.totalBudget, trip.currency)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: "center" }}>
            <Text style={{ color: C.textSub, fontSize: 10, fontWeight: "700", marginBottom: 4 }}>SPENT</Text>
            <Text style={{ color: barColor, fontSize: 18, fontWeight: "800" }}>{fmt(trip.actualSpent, trip.currency)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: "center" }}>
            <Text style={{ color: C.textSub, fontSize: 10, fontWeight: "700", marginBottom: 4 }}>LEFT</Text>
            <Text style={{ color: remaining >= 0 ? TEAL : "#f87171", fontSize: 18, fontWeight: "800" }}>{remaining < 0 ? "-" : ""}{fmt(Math.abs(remaining), trip.currency)}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
            <View style={{ height: "100%", width: `${Math.round(pct * 100)}%`, backgroundColor: barColor, borderRadius: 4 }} />
          </View>
          <Text style={{ color: C.textSub, fontSize: 11, textAlign: "right" }}>{Math.round(pct * 100)}% of budget used</Text>
        </View>

        {/* Linked group */}
        <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: TEAL_BG, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={trip.group ? "people" : "link-outline"} size={20} color={TEAL} />
          </View>
          <View style={{ flex: 1 }}>
            {trip.group ? (
              <>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: "700" }}>{trip.group.emoji} {trip.group.name}</Text>
                <Text style={{ color: C.textSub, fontSize: 11, marginTop: 1 }}>Expenses synced from this group</Text>
              </>
            ) : (
              <>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: "700" }}>No group linked</Text>
                <Text style={{ color: C.textSub, fontSize: 11, marginTop: 1 }}>Link a group to track actual spending</Text>
              </>
            )}
          </View>
          <TouchableOpacity onPress={() => setShowLinkGroup(true)}
            style={{ backgroundColor: TEAL_BG, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: TEAL_BORDER }}>
            <Text style={{ color: TEAL, fontWeight: "700", fontSize: 12 }}>{trip.group ? "Change" : "Link"}</Text>
          </TouchableOpacity>
        </View>

        {/* Category budgets */}
        <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 }}>CATEGORY BUDGETS</Text>
        <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden", marginBottom: 16 }}>
          {TRIP_CATEGORIES.map((cat, idx) => {
            const planned = categoryMap.get(cat.key)?.amount ?? 0
            const actual = trip.categoryActuals?.[cat.key] ?? 0
            const catPct = planned > 0 ? Math.min(1, actual / planned) : 0
            const catBar = catPct > 0.9 ? "#ef4444" : catPct > 0.7 ? "#f59e0b" : cat.color
            const hasActual = trip.group && actual > 0
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => { setEditingCategory(cat.key); setCatAmount(planned > 0 ? String(planned) : "") }}
                style={{ padding: 14, borderBottomWidth: idx < TRIP_CATEGORIES.length - 1 ? 1 : 0, borderBottomColor: C.border }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: (planned > 0 || hasActual) ? 6 : 0 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${cat.color}22`, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                  </View>
                  <Text style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: "600" }}>{cat.label}</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: planned > 0 ? C.text : C.textMuted, fontSize: 14, fontWeight: "700" }}>
                      {planned > 0 ? fmt(planned, trip.currency) : "Set budget"}
                    </Text>
                    {hasActual && (
                      <Text style={{ color: planned > 0 ? catBar : "#f59e0b", fontSize: 11, marginTop: 1 }}>
                        {fmt(actual, trip.currency)} spent
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.textSub} />
                </View>
                {hasActual && planned > 0 && (
                  <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${Math.round(catPct * 100)}%`, backgroundColor: catBar, borderRadius: 2 }} />
                  </View>
                )}
                {hasActual && planned === 0 && (
                  <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: "100%", backgroundColor: "#f59e0b33", borderRadius: 2 }} />
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {allocatedTotal > 0 && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20, paddingHorizontal: 4 }}>
            <Text style={{ color: C.textSub, fontSize: 12 }}>Allocated: {fmt(allocatedTotal, trip.currency)}</Text>
            <Text style={{ color: unallocated >= 0 ? TEAL : "#f87171", fontSize: 12, fontWeight: "600" }}>
              {unallocated >= 0 ? `${fmt(unallocated, trip.currency)} unallocated` : `${fmt(Math.abs(unallocated), trip.currency)} over budget`}
            </Text>
          </View>
        )}

        {/* Member spending */}
        {trip.memberSpending.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 }}>MEMBER SPENDING</Text>
            <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
              {trip.memberSpending.map((m, idx) => {
                const memberPct = trip.actualSpent > 0 ? m.paid / trip.actualSpent : 0
                return (
                  <View key={m.user.id} style={{ padding: 14, borderBottomWidth: idx < trip.memberSpending.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <Avatar name={m.user.name ?? m.user.email} size={32} />
                      <Text style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: "600" }}>{m.user.name ?? m.user.email}</Text>
                      <Text style={{ color: TEAL, fontSize: 14, fontWeight: "800" }}>{fmt(m.paid, trip.currency)}</Text>
                      <Text style={{ color: C.textSub, fontSize: 12 }}>{Math.round(memberPct * 100)}%</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, overflow: "hidden" }}>
                      <View style={{ height: "100%", width: `${Math.round(memberPct * 100)}%`, backgroundColor: "#6366f1", borderRadius: 2 }} />
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* Recent expenses from group */}
        {trip.recentExpenses.length > 0 && (
          <View>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 }}>EXPENSES FROM GROUP</Text>
            <View style={{ gap: 6 }}>
              {trip.recentExpenses.map((e) => {
                const cat = TRIP_CATEGORIES.find(c => c.key === e.category)
                return (
                  <View key={e.id} style={{ backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${cat?.color ?? "#6b7280"}22`, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 18 }}>{cat?.emoji ?? "💸"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: "600" }}>{e.description}</Text>
                      <Text style={{ color: C.textSub, fontSize: 11, marginTop: 1 }}>
                        {e.paidBy.name ?? e.paidBy.email} · {fmtDate(e.date)}
                      </Text>
                    </View>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: "700" }}>{fmt(e.amount, trip.currency)}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Category budget edit sheet */}
      <SwipeSheet
        visible={!!editingCategory}
        onClose={() => { setEditingCategory(null); setCatAmount("") }}
        sheetStyle={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 20, paddingHorizontal: 20 }}
      >
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginTop: 12, marginBottom: 20 }} />
        {editingCategory && (() => {
          const cat = TRIP_CATEGORIES.find(c => c.key === editingCategory)!
          const currentAmount = categoryMap.get(editingCategory)?.amount ?? 0
          // headroom = total budget minus every OTHER category's allocation
          const otherAllocated = allocatedTotal - currentAmount
          const maxAllowed = trip.totalBudget - otherAllocated
          const entered = parseFloat(catAmount || "0")
          const isOverLimit = entered > maxAllowed
          const inputBorderColor = isOverLimit ? "#ef4444" : C.border
          return (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: `${cat.color}22`, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 24 }}>{cat.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>{cat.label} Budget</Text>
                  <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
                    Max {fmt(maxAllowed, trip.currency)} available
                  </Text>
                </View>
              </View>
              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>PLANNED AMOUNT</Text>
              <View style={{ height: 52, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: inputBorderColor, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, marginBottom: isOverLimit ? 6 : 20 }}>
                <Text style={{ color: C.textSub, fontSize: 18, marginRight: 4 }}>{symbols[trip.currency] ?? "₹"}</Text>
                <TextInput
                  style={{ flex: 1, color: C.text, fontSize: 20, fontWeight: "700" }}
                  placeholder="0"
                  placeholderTextColor={C.textMuted}
                  keyboardType="decimal-pad"
                  value={catAmount}
                  onChangeText={setCatAmount}
                  autoFocus
                />
              </View>
              {isOverLimit && (
                <Text style={{ color: "#ef4444", fontSize: 12, marginBottom: 14 }}>
                  Exceeds remaining budget
                </Text>
              )}
              <TouchableOpacity
                onPress={() => saveCatMutation.mutate(entered)}
                disabled={saveCatMutation.isPending || isOverLimit || entered <= 0}
                style={{ height: 52, borderRadius: 16, backgroundColor: isOverLimit || entered <= 0 ? `${TEAL}55` : TEAL, alignItems: "center", justifyContent: "center" }}>
                {saveCatMutation.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Save Budget</Text>
                }
              </TouchableOpacity>
            </>
          )
        })()}
      </SwipeSheet>

      {/* Link group sheet */}
      <SwipeSheet
        visible={showLinkGroup}
        onClose={() => setShowLinkGroup(false)}
        sheetStyle={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 20, paddingHorizontal: 20 }}
      >
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginTop: 12, marginBottom: 20 }} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 16 }}>Link a Group</Text>
        <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 20, lineHeight: 20 }}>
          Group expenses within your trip dates will be tracked automatically against your budget.
        </Text>
        <View style={{ gap: 8 }}>
          {trip.groupId && (
            <TouchableOpacity onPress={() => linkGroupMutation.mutate(null)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" }}>
              <Ionicons name="unlink-outline" size={20} color="#f87171" />
              <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 14 }}>Unlink group</Text>
            </TouchableOpacity>
          )}
          {groups.map((g: any) => (
            <TouchableOpacity key={g.id} onPress={() => linkGroupMutation.mutate(g.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: trip.groupId === g.id ? TEAL_BG : C.bg, borderRadius: 14, borderWidth: 1, borderColor: trip.groupId === g.id ? TEAL : C.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: g.color + "33", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 20 }}>{g.emoji}</Text>
              </View>
              <Text style={{ flex: 1, color: C.text, fontSize: 14, fontWeight: "700" }}>{g.name}</Text>
              {trip.groupId === g.id && <Ionicons name="checkmark-circle" size={20} color={TEAL} />}
            </TouchableOpacity>
          ))}
        </View>
      </SwipeSheet>

      {/* Delete confirm */}
      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name="warning-outline" size={26} color="#f87171" />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>Delete Trip?</Text>
            <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>
              This will permanently remove "{trip.name}" and all its category budgets.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setConfirmDelete(false)}
                style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setConfirmDelete(false); deleteMutation.mutate() }}
                style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}>
                {deleteMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

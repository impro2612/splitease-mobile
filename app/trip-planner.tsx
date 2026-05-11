import { useEffect, useRef, useState } from "react"
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, ActivityIndicator, Pressable, RefreshControl, Platform,
  Animated, PanResponder, useWindowDimensions,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { tripsApi, groupsApi } from "@/lib/api"
import Toast from "react-native-toast-message"

const TEAL = "#10b981"
const TEAL_BG = "rgba(16,185,129,0.12)"
const TEAL_BORDER = "rgba(16,185,129,0.3)"

const TRIP_EMOJIS = ["✈️", "🏖️", "🏔️", "🗺️", "🌍", "🏕️", "🚢", "🏛️", "🎪", "🌄", "🏝️", "🗼", "🎡", "🌋", "🏜️", "🛳️"]
const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const

type Trip = {
  id: string; name: string; emoji: string
  startDate: string; endDate: string
  totalBudget: number; currency: string; status: string
  actualSpent: number
  group?: { id: string; name: string; emoji: string; color: string } | null
  categories: { id: string; category: string; amount: number }[]
}

function tripStatus(trip: Trip): "PLANNING" | "ACTIVE" | "COMPLETED" {
  const now = Date.now()
  const start = new Date(trip.startDate).getTime()
  const end = new Date(trip.endDate).getTime()
  if (now < start) return "PLANNING"
  if (now > end) return "COMPLETED"
  return "ACTIVE"
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function openDatePicker(current: Date, onChange: (d: Date) => void, max?: Date) {
  if (Platform.OS === "android") {
    DateTimePickerAndroid.open({
      value: current,
      mode: "date",
      maximumDate: max,
      onChange: (_, d) => { if (d) onChange(d) },
    })
  }
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

  useEffect(() => {
    if (visible) {
      setMounted(true); panY.setValue(0); slideAnim.setValue(hidden); overlayAnim.setValue(0)
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      setMounted(false); panY.setValue(0); slideAnim.setValue(hidden); overlayAnim.setValue(0)
    }
  }, [hidden, overlayAnim, panY, slideAnim, visible])

  function close() {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: hidden, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { panY.setValue(0); setMounted(false); onClose() })
  }

  const shouldDrag = (_: any, g: any) => g.dy > 8 && g.dy > Math.abs(g.dx)
  const onMove = (_: any, g: any) => { if (g.dy > 0) panY.setValue(g.dy) }
  const onRelease = (_: any, g: any) => {
    if (g.dy > 80 || g.vy > 0.5) { slideAnim.setValue(Math.max(0, g.dy)); panY.setValue(0); close() }
    else Animated.spring(panY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start()
  }

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: shouldDrag,
    onMoveShouldSetPanResponderCapture: shouldDrag,
    onPanResponderMove: onMove,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: onRelease,
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

export default function TripPlanner() {
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const qc = useQueryClient()

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("✈️")
  const [startDate, setStartDate] = useState(new Date())
  const [endDate, setEndDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })
  const [budget, setBudget] = useState("")
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>("INR")
  const [groupId, setGroupId] = useState("")

  const { data: trips = [], isLoading, refetch } = useQuery<Trip[]>({
    queryKey: ["trips"],
    queryFn: async () => { const r = await tripsApi.list(); return r.data },
  })

  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ["groups"],
    queryFn: async () => { const r = await groupsApi.list(); return r.data },
  })

  const createMutation = useMutation({
    mutationFn: () => tripsApi.create({
      name: name.trim(),
      emoji,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalBudget: parseFloat(budget),
      currency,
      groupId: groupId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trips"] })
      setShowCreate(false); resetForm()
      Toast.show({ type: "success", text1: "Trip created!" })
    },
    onError: (e: any) => Toast.show({ type: "error", text1: e?.response?.data?.error ?? "Failed to create" }),
  })

  function resetForm() {
    setName(""); setEmoji("✈️"); setBudget(""); setCurrency("INR"); setGroupId("")
    setStartDate(new Date()); const d = new Date(); d.setDate(d.getDate() + 7); setEndDate(d)
  }

  const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }

  const planning = trips.filter(t => tripStatus(t) === "PLANNING")
  const active = trips.filter(t => tripStatus(t) === "ACTIVE")
  const completed = trips.filter(t => tripStatus(t) === "COMPLETED")

  function TripCard({ trip }: { trip: Trip }) {
    const status = tripStatus(trip)
    const pct = trip.totalBudget > 0 ? Math.min(1, (trip.actualSpent ?? 0) / trip.totalBudget) : 0
    const barColor = pct > 0.9 ? "#ef4444" : pct > 0.7 ? "#f59e0b" : TEAL
    const statusColors = { PLANNING: "#a78bfa", ACTIVE: TEAL, COMPLETED: "#6b7280" }
    const statusLabels = { PLANNING: "Planning", ACTIVE: "Active", COMPLETED: "Completed" }

    return (
      <TouchableOpacity
        onPress={() => router.push(`/trip/${trip.id}` as any)}
        style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 10 }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: TEAL_BG, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 24 }}>{trip.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: "800", flex: 1 }}>{trip.name}</Text>
              <View style={{ backgroundColor: `${statusColors[status]}22`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: statusColors[status], fontSize: 10, fontWeight: "700" }}>{statusLabels[status].toUpperCase()}</Text>
              </View>
            </View>
            <Text style={{ color: C.textSub, fontSize: 12 }}>{fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}</Text>
            {trip.group && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                <Text style={{ fontSize: 12 }}>{trip.group.emoji}</Text>
                <Text style={{ color: C.textSub, fontSize: 11 }}>{trip.group.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Budget progress */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ color: C.textSub, fontSize: 12 }}>
            {symbols[trip.currency]}{(trip.actualSpent ?? 0).toLocaleString("en-IN")} spent
          </Text>
          <Text style={{ color: C.textSub, fontSize: 12 }}>
            of {symbols[trip.currency]}{trip.totalBudget.toLocaleString("en-IN")}
          </Text>
        </View>
        <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${Math.round(pct * 100)}%`, backgroundColor: barColor, borderRadius: 3 }} />
        </View>
        {trip.totalBudget > 0 && (
          <Text style={{ color: barColor, fontSize: 11, fontWeight: "700", marginTop: 4, textAlign: "right" }}>
            {symbols[trip.currency]}{Math.max(0, trip.totalBudget - (trip.actualSpent ?? 0)).toLocaleString("en-IN")} left · {Math.round(pct * 100)}%
          </Text>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: TEAL_BG, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="airplane-outline" size={20} color={TEAL} />
        </View>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", flex: 1 }}>Pre-Trip Planner</Text>
        <TouchableOpacity onPress={() => { resetForm(); setShowCreate(true) }}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: TEAL_BG, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={22} color={TEAL} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={TEAL} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={TEAL} />}>

          {trips.length === 0 && (
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: TEAL_BG, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <Text style={{ fontSize: 40 }}>✈️</Text>
              </View>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", marginBottom: 8 }}>No trips yet</Text>
              <Text style={{ color: C.textSub, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
                Tap + to plan your first trip budget
              </Text>
            </View>
          )}

          {active.length > 0 && (
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <Text style={{ color: TEAL, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 }}>HAPPENING NOW</Text>
              {active.map(t => <TripCard key={t.id} trip={t} />)}
            </View>
          )}

          {planning.length > 0 && (
            <View style={{ marginTop: active.length > 0 ? 8 : 8, marginBottom: 4 }}>
              <Text style={{ color: "#a78bfa", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 }}>UPCOMING</Text>
              {planning.map(t => <TripCard key={t.id} trip={t} />)}
            </View>
          )}

          {completed.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 10 }}>PAST TRIPS</Text>
              {completed.map(t => <TripCard key={t.id} trip={t} />)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Create Trip Sheet */}
      <SwipeSheet
        visible={showCreate}
        onClose={() => { setShowCreate(false); resetForm() }}
        sheetStyle={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 20, paddingHorizontal: 20, maxHeight: "92%" }}
      >
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginTop: 12, marginBottom: 20 }} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 20 }}>Plan a Trip</Text>

        {/* Emoji row */}
        <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>CHOOSE ICON</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {TRIP_EMOJIS.map(e => (
              <TouchableOpacity key={e} onPress={() => setEmoji(e)}
                style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
                  backgroundColor: emoji === e ? TEAL_BG : C.bg,
                  borderWidth: emoji === e ? 1.5 : 1,
                  borderColor: emoji === e ? TEAL : C.border }}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Trip name */}
        <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>TRIP NAME</Text>
        <View style={{ height: 48, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, justifyContent: "center", marginBottom: 14 }}>
          <TextInput
            style={{ color: C.text, fontSize: 15 }}
            placeholder="e.g. Goa Summer Trip"
            placeholderTextColor={C.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Dates */}
        <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>DATES</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => openDatePicker(startDate, setStartDate)}
            style={{ flex: 1, height: 48, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }}>
            <Ionicons name="calendar-outline" size={16} color={C.textSub} />
            <View>
              <Text style={{ color: C.textSub, fontSize: 10, fontWeight: "600" }}>FROM</Text>
              <Text style={{ color: C.text, fontSize: 13 }}>{startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openDatePicker(endDate, (d) => { if (d >= startDate) setEndDate(d) })}
            style={{ flex: 1, height: 48, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }}>
            <Ionicons name="calendar-outline" size={16} color={C.textSub} />
            <View>
              <Text style={{ color: C.textSub, fontSize: 10, fontWeight: "600" }}>TO</Text>
              <Text style={{ color: C.text, fontSize: 13 }}>{endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Budget */}
        <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>TOTAL BUDGET</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <View style={{ flex: 1, height: 48, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }}>
            <Text style={{ color: C.textSub, fontSize: 16, marginRight: 4 }}>{symbols[currency]}</Text>
            <TextInput
              style={{ flex: 1, color: C.text, fontSize: 17, fontWeight: "700" }}
              placeholder="0" placeholderTextColor={C.textMuted}
              keyboardType="decimal-pad" value={budget} onChangeText={setBudget}
            />
          </View>
          {CURRENCIES.map(cur => (
            <TouchableOpacity key={cur} onPress={() => setCurrency(cur)}
              style={{ paddingHorizontal: 10, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center",
                backgroundColor: currency === cur ? TEAL_BG : C.bg,
                borderWidth: currency === cur ? 1.5 : 1,
                borderColor: currency === cur ? TEAL : C.border }}>
              <Text style={{ color: currency === cur ? TEAL : C.textSub, fontWeight: "700", fontSize: 12 }}>{cur}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Link group (optional) */}
        <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>LINK GROUP (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => setGroupId("")}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: !groupId ? TEAL_BG : C.bg, borderWidth: !groupId ? 1.5 : 1, borderColor: !groupId ? TEAL : C.border }}>
              <Text style={{ color: !groupId ? TEAL : C.textSub, fontWeight: "600", fontSize: 13 }}>None</Text>
            </TouchableOpacity>
            {groups.map((g: any) => (
              <TouchableOpacity key={g.id} onPress={() => setGroupId(g.id)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6,
                  backgroundColor: groupId === g.id ? TEAL_BG : C.bg,
                  borderWidth: groupId === g.id ? 1.5 : 1,
                  borderColor: groupId === g.id ? TEAL : C.border }}>
                <Text style={{ fontSize: 14 }}>{g.emoji}</Text>
                <Text style={{ color: groupId === g.id ? TEAL : C.text, fontWeight: groupId === g.id ? "700" : "500", fontSize: 13 }}>{g.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          onPress={() => createMutation.mutate()}
          disabled={!name.trim() || !budget || parseFloat(budget || "0") <= 0 || createMutation.isPending}
          style={{ height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center",
            backgroundColor: (!name.trim() || !budget || parseFloat(budget || "0") <= 0) ? `${TEAL}55` : TEAL }}>
          {createMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Create Trip</Text>
          }
        </TouchableOpacity>
      </SwipeSheet>
    </SafeAreaView>
  )
}

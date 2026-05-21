import { useState, useRef, useEffect } from "react"
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, ActivityIndicator, Pressable, RefreshControl,
  Platform, Animated, PanResponder, useWindowDimensions,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { spendDiaryApi } from "@/lib/api"
import Toast from "react-native-toast-message"

const ACCENT = "#06b6d4"
const ACCENT_BG = "rgba(6,182,212,0.12)"
const ACCENT_BORDER = "rgba(6,182,212,0.3)"
const CURRENCIES = ["INR", "USD", "EUR", "GBP"]

type Diary = {
  id: string
  title: string
  entryCount: number
  total: number
  currency: string
  createdAt: string
}

type Entry = {
  id: string
  title: string
  amount: number
  currency: string
  date: string
  createdAt: string
}

function fmt(amount: number, currency: string) {
  const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }
  return `${symbols[currency] ?? currency}${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function BottomSheet({
  visible, onClose, children, title,
}: { visible: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  const { bottom } = useSafeAreaInsets()
  const C = useTheme()
  const { height } = useWindowDimensions()
  const hiddenTranslateY = Math.max(300, height)
  const [mounted, setMounted] = useState(visible)
  const slideAnim = useRef(new Animated.Value(hiddenTranslateY)).current
  const panY = useRef(new Animated.Value(0)).current
  const overlayAnim = useRef(new Animated.Value(0)).current

  const translateY = Animated.add(slideAnim, panY.interpolate({
    inputRange: [-9999, 0, 9999], outputRange: [0, 0, 9999],
  }))

  useEffect(() => {
    if (visible) {
      setMounted(true)
      panY.setValue(0)
      slideAnim.setValue(hiddenTranslateY)
      overlayAnim.setValue(0)
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      setMounted(false)
      panY.setValue(0)
      slideAnim.setValue(hiddenTranslateY)
      overlayAnim.setValue(0)
    }
  }, [visible])

  function closeSheet() {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: hiddenTranslateY, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { panY.setValue(0); setMounted(false); onClose() })
  }

  const shouldStartDrag = (_: any, g: { dy: number; dx: number }) => g.dy > 8 && g.dy > Math.abs(g.dx)

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: shouldStartDrag,
    onMoveShouldSetPanResponderCapture: shouldStartDrag,
    onPanResponderMove: (_: any, g: any) => { if (g.dy > 0) panY.setValue(g.dy) },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_: any, g: any) => {
      if (g.dy > 80 || g.vy > 0.5) { slideAnim.setValue(Math.max(0, g.dy)); panY.setValue(0); closeSheet() }
      else Animated.spring(panY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start()
    },
  })).current

  if (!mounted) return null

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={closeSheet}>
      <Animated.View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", opacity: overlayAnim }}>
        <Pressable style={{ flex: 1 }} onPress={closeSheet} />
      </Animated.View>
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: C.card,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 20, paddingTop: 16, paddingBottom: bottom + 24,
          transform: [{ translateY }],
        }}
      >
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 16 }} />
        <Text style={{ color: C.text, fontSize: 17, fontWeight: "800", marginBottom: 20 }}>{title}</Text>
        {children}
      </Animated.View>
    </Modal>
  )
}

export default function SpendDiary() {
  const C = useTheme()
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()

  // ── View state ────────────────────────────────────────────────────────────────
  const [activeDiary, setActiveDiary] = useState<Diary | null>(null)

  // ── Create diary sheet ────────────────────────────────────────────────────────
  const [showCreateDiary, setShowCreateDiary] = useState(false)
  const [newDiaryTitle, setNewDiaryTitle] = useState("")

  // ── Add / Edit entry sheet ────────────────────────────────────────────────────
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [entryTitle, setEntryTitle] = useState("")
  const [entryAmount, setEntryAmount] = useState("")
  const [entryCurrency, setEntryCurrency] = useState("INR")
  const [entryDate, setEntryDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)

  // ── Confirm dialog ────────────────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmText: string; danger?: boolean; onConfirm: () => void
  } | null>(null)

  // ── Queries ───────────────────────────────────────────────────────────────────
  const { data: diaries = [], isLoading, refetch } = useQuery<Diary[]>({
    queryKey: ["spend-diary"],
    queryFn: async () => { const r = await spendDiaryApi.list(); return r.data },
  })

  const { data: entries = [], isLoading: entriesLoading, refetch: refetchEntries } = useQuery<Entry[]>({
    queryKey: ["spend-diary-entries", activeDiary?.id],
    queryFn: async () => {
      if (!activeDiary) return []
      const r = await spendDiaryApi.entries(activeDiary.id)
      return r.data
    },
    enabled: !!activeDiary,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createDiary = useMutation({
    mutationFn: () => spendDiaryApi.create(newDiaryTitle.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend-diary"] })
      setShowCreateDiary(false)
      setNewDiaryTitle("")
      Toast.show({ type: "success", text1: "Diary created 📓" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to create diary" }),
  })

  const deleteDiary = useMutation({
    mutationFn: (id: string) => spendDiaryApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend-diary"] })
      setActiveDiary(null)
      Toast.show({ type: "success", text1: "Diary deleted" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to delete" }),
  })

  const addEntry = useMutation({
    mutationFn: () => spendDiaryApi.addEntry(activeDiary!.id, {
      title: entryTitle.trim(),
      amount: parseFloat(entryAmount),
      currency: entryCurrency,
      date: entryDate.toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend-diary-entries", activeDiary?.id] })
      qc.invalidateQueries({ queryKey: ["spend-diary"] })
      setShowAddEntry(false)
      resetEntryForm()
      Toast.show({ type: "success", text1: "Expense added ✓" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to add expense" }),
  })

  const editEntry = useMutation({
    mutationFn: () => spendDiaryApi.editEntry(activeDiary!.id, editingEntry!.id, {
      title: entryTitle.trim(),
      amount: parseFloat(entryAmount),
      currency: entryCurrency,
      date: entryDate.toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend-diary-entries", activeDiary?.id] })
      qc.invalidateQueries({ queryKey: ["spend-diary"] })
      setShowAddEntry(false)
      setEditingEntry(null)
      resetEntryForm()
      Toast.show({ type: "success", text1: "Expense updated ✓" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to update expense" }),
  })

  const deleteEntry = useMutation({
    mutationFn: (entryId: string) => spendDiaryApi.deleteEntry(activeDiary!.id, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spend-diary-entries", activeDiary?.id] })
      qc.invalidateQueries({ queryKey: ["spend-diary"] })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to delete" }),
  })

  function resetEntryForm() {
    setEntryTitle(""); setEntryAmount(""); setEntryCurrency("INR"); setEntryDate(new Date())
  }

  function openEditEntry(entry: Entry) {
    setEditingEntry(entry)
    setEntryTitle(entry.title)
    setEntryAmount(String(entry.amount))
    setEntryCurrency(entry.currency)
    setEntryDate(new Date(entry.date))
    setShowAddEntry(true)
  }

  function closeEntrySheet() {
    setShowAddEntry(false)
    setEditingEntry(null)
    resetEntryForm()
  }

  const isEditMode = !!editingEntry
  const totalSpent = entries.reduce((s, e) => s + e.amount, 0)
  const entryCurrencySymbol = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[entryCurrency] ?? entryCurrency

  // ── Detail view ───────────────────────────────────────────────────────────────
  if (activeDiary) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
          <TouchableOpacity
            onPress={() => setActiveDiary(null)}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={18} color={C.text} />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: C.text, fontSize: 20, fontWeight: "800" }} numberOfLines={1}>
            {activeDiary.title}
          </Text>
          <TouchableOpacity
            onPress={() => setConfirmDialog({
              title: "Delete Diary",
              message: `Delete "${activeDiary.title}" and all its expenses? This cannot be undone.`,
              confirmText: "Delete",
              danger: true,
              onConfirm: () => deleteDiary.mutate(activeDiary.id),
            })}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="trash-outline" size={17} color="#f87171" />
          </TouchableOpacity>
        </View>

        {/* Summary card */}
        <View style={{
          marginHorizontal: 20, marginBottom: 16,
          backgroundColor: C.card, borderRadius: 16,
          borderWidth: 1, borderColor: ACCENT_BORDER,
          padding: 18, flexDirection: "row", alignItems: "center", gap: 16,
        }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 24 }}>📓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>Total Spent</Text>
            <Text style={{ color: ACCENT, fontSize: 26, fontWeight: "800", marginTop: 2 }}>
              {fmt(totalSpent, entries[0]?.currency ?? "INR")}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{entries.length} expense{entries.length !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddEntry(true)}
            style={{ backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Entries */}
        {entriesLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : entries.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📝</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>No expenses yet</Text>
            <Text style={{ color: C.textSub, fontSize: 14, textAlign: "center", marginTop: 8 }}>Tap Add to record your first expense</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: insets.bottom + 20 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refetchEntries} tintColor={ACCENT} />}
          >
            {entries.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                onPress={() => openEditEntry(entry)}
                activeOpacity={0.75}
                style={{
                  backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
                  paddingHorizontal: 16, paddingVertical: 14,
                  flexDirection: "row", alignItems: "center", gap: 12,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="receipt-outline" size={16} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{entry.title}</Text>
                  <Text style={{ color: C.textSub, fontSize: 12, marginTop: 3 }}>{fmtDate(entry.date)}</Text>
                </View>
                <Text style={{ color: ACCENT, fontWeight: "800", fontSize: 15 }}>{fmt(entry.amount, entry.currency)}</Text>
                <TouchableOpacity
                  onPress={() => setConfirmDialog({
                    title: "Delete Expense",
                    message: `Delete "${entry.title}"?`,
                    confirmText: "Delete",
                    danger: true,
                    onConfirm: () => deleteEntry.mutate(entry.id),
                  })}
                  style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="trash-outline" size={15} color="#f87171" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Add / Edit Entry Sheet */}
        <BottomSheet visible={showAddEntry} onClose={closeEntrySheet} title={isEditMode ? "Edit Expense" : "Add Expense"}>
          <View style={{ gap: 14 }}>
            <View>
              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Title</Text>
              <TextInput
                value={entryTitle}
                onChangeText={setEntryTitle}
                placeholder="e.g. Dinner, Cab, Groceries..."
                placeholderTextColor={C.textMuted}
                style={{ backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 }}
              />
            </View>

            <View>
              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Amount</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14 }}>
                  <Text style={{ color: C.textSub, fontSize: 16, marginRight: 4 }}>{entryCurrencySymbol}</Text>
                  <TextInput
                    value={entryAmount}
                    onChangeText={setEntryAmount}
                    placeholder="0.00"
                    placeholderTextColor={C.textMuted}
                    keyboardType="decimal-pad"
                    style={{ flex: 1, paddingVertical: 12, color: C.text, fontSize: 15 }}
                  />
                </View>
                {CURRENCIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setEntryCurrency(c)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 12, borderRadius: 12,
                      backgroundColor: entryCurrency === c ? ACCENT_BG : C.bg,
                      borderWidth: 1.5, borderColor: entryCurrency === c ? ACCENT : C.border,
                    }}
                  >
                    <Text style={{ color: entryCurrency === c ? ACCENT : C.textSub, fontSize: 12, fontWeight: "700" }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View>
              <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Date</Text>
              {Platform.OS === "android" ? (
                <TouchableOpacity
                  onPress={() => DateTimePickerAndroid.open({
                    value: entryDate, mode: "date", onChange: (_, d) => { if (d) setEntryDate(d) },
                  })}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12 }}
                >
                  <Ionicons name="calendar-outline" size={18} color={C.textSub} />
                  <Text style={{ color: C.text, fontSize: 15 }}>{entryDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 4 }}>
                  <Ionicons name="calendar-outline" size={18} color={C.textSub} />
                  <DateTimePicker value={entryDate} mode="date" display="compact" onChange={(_, d) => { if (d) setEntryDate(d) }} style={{ flex: 1 }} />
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={() => isEditMode ? editEntry.mutate() : addEntry.mutate()}
              disabled={!entryTitle.trim() || !entryAmount || parseFloat(entryAmount || "0") <= 0 || addEntry.isPending || editEntry.isPending}
              style={{
                height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 4,
                backgroundColor: (!entryTitle.trim() || !entryAmount || parseFloat(entryAmount || "0") <= 0) ? `${ACCENT}55` : ACCENT,
              }}
            >
              {(addEntry.isPending || editEntry.isPending)
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{isEditMode ? "Update Expense" : "Save Expense"}</Text>
              }
            </TouchableOpacity>
          </View>
        </BottomSheet>

        {/* Custom Confirm Dialog */}
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

  // ── List view ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20 }}>📓</Text>
        </View>
        <Text style={{ flex: 1, color: C.text, fontSize: 20, fontWeight: "800" }}>Spend Diary</Text>
        <TouchableOpacity
          onPress={() => setShowCreateDiary(true)}
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="add" size={22} color={ACCENT} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : diaries.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Text style={{ fontSize: 56, marginBottom: 20 }}>📓</Text>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Your diary is empty</Text>
          <Text style={{ color: C.textSub, fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 22 }}>
            Create a diary to start tracking your personal expenses — for trips, daily spends, or anything you want to record.
          </Text>
          <TouchableOpacity
            onPress={() => setShowCreateDiary(true)}
            style={{ marginTop: 24, backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Create First Diary</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 12 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={ACCENT} />}
        >
          {diaries.map((diary) => (
            <TouchableOpacity
              key={diary.id}
              onPress={() => setActiveDiary(diary)}
              activeOpacity={0.75}
              style={{
                backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border,
                paddingHorizontal: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 14,
              }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: ACCENT_BG, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24 }}>📓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }}>{diary.title}</Text>
                <Text style={{ color: C.textSub, fontSize: 13, marginTop: 3 }}>
                  {diary.entryCount} expense{diary.entryCount !== 1 ? "s" : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: ACCENT, fontWeight: "800", fontSize: 16 }}>{fmt(diary.total, diary.currency)}</Text>
                <Ionicons name="chevron-forward" size={14} color={C.textSub} style={{ marginTop: 4 }} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Create Diary Sheet */}
      <BottomSheet visible={showCreateDiary} onClose={() => { setShowCreateDiary(false); setNewDiaryTitle("") }} title="New Diary">
        <View style={{ gap: 14 }}>
          <View>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Diary Name</Text>
            <TextInput
              value={newDiaryTitle}
              onChangeText={setNewDiaryTitle}
              placeholder="e.g. Goa Trip, Monthly Spends..."
              placeholderTextColor={C.textMuted}
              autoFocus
              style={{ backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15 }}
            />
          </View>
          <TouchableOpacity
            onPress={() => createDiary.mutate()}
            disabled={!newDiaryTitle.trim() || createDiary.isPending}
            style={{
              height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center",
              backgroundColor: !newDiaryTitle.trim() ? `${ACCENT}55` : ACCENT,
            }}
          >
            {createDiary.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Create Diary</Text>
            }
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </SafeAreaView>
  )
}

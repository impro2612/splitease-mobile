import { useState, useEffect, useRef } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, FlatList, Platform, PermissionsAndroid,
  useWindowDimensions, Animated,
} from "react-native"
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { useLocalSearchParams, router } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { groupsApi, expensesApi, balancesApi, membersApi, friendsApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { formatCurrency, formatDate, GROUP_EMOJIS, GROUP_COLORS, guessCategory, getExpenseEmoji } from "@/lib/utils"
import { CURRENCIES, NO_DECIMAL_CURRENCIES } from "@/lib/currencies"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { syncTrackConfigToNative } from "@/lib/nativeTrackExpense"
import { useTheme } from "@/lib/theme"
import { BottomTabBar } from "@/components/ui/BottomTabBar"
import { getRate } from "@/lib/exchange"
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg"
const AnimatedPath = Animated.createAnimatedComponent(Path)
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"

type Tab = "expenses" | "balances" | "members" | "analytics" | "utility"

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#f87171", "#38bdf8", "#a78bfa", "#fb923c", "#34d399"]

function AnimatedPieChart({ data, size = 240, symbol = "$" }: {
  data: { name: string; amount: number; color: string }[]
  size?: number
  symbol?: string
}) {
  const C = useTheme()
  const [selected, setSelected] = useState<number | null>(null)
  const mountAnim = useRef(new Animated.Value(0)).current
  const segAnims = useRef(data.map(() => new Animated.Value(0))).current

  useEffect(() => {
    Animated.spring(mountAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }).start()
    Animated.stagger(120, segAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true })
    )).start()
  }, [])

  const total = data.reduce((s, d) => s + d.amount, 0)
  if (total === 0) return null

  const cx = size / 2, cy = size / 2
  const outerR = size * 0.43, innerR = size * 0.265
  const explodeD = 12

  let angle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const frac = d.amount / total
    const sweep = frac * 2 * Math.PI
    const mid = angle + sweep / 2
    const end = angle + sweep
    const large = sweep > Math.PI ? 1 : 0
    const ox1 = cx + outerR * Math.cos(angle), oy1 = cy + outerR * Math.sin(angle)
    const ox2 = cx + outerR * Math.cos(end), oy2 = cy + outerR * Math.sin(end)
    const ix1 = cx + innerR * Math.cos(end), iy1 = cy + innerR * Math.sin(end)
    const ix2 = cx + innerR * Math.cos(angle), iy2 = cy + innerR * Math.sin(angle)
    const path = `M${ox1},${oy1} A${outerR},${outerR},0,${large},1,${ox2},${oy2} L${ix1},${iy1} A${innerR},${innerR},0,${large},0,${ix2},${iy2}Z`
    const tx = Math.cos(mid) * explodeD, ty = Math.sin(mid) * explodeD
    angle = end
    return { ...d, path, mid, tx, ty, frac, i }
  })

  const sel = selected !== null ? slices[selected] : null

  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View style={{ opacity: mountAnim, transform: [{ scale: mountAnim }] }}>
        <Svg width={size} height={size + 8}>
          <Defs>
            {slices.map((s, i) => (
              <LinearGradient key={i} id={`lg${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                <Stop offset="100%" stopColor={s.color} stopOpacity="1" />
              </LinearGradient>
            ))}
          </Defs>

          {/* 3D depth layers — two shadow offset copies per segment */}
          {slices.map((s, i) => {
            const isSel = selected === i
            const ox = isSel ? s.tx : 0, oy = isSel ? s.ty : 0
            return (
              <G key={`depth${i}`}>
                <Path d={s.path} fill={s.color} opacity={0.18} transform={`translate(${ox},${oy + 7})`} />
                <Path d={s.path} fill={s.color} opacity={0.12} transform={`translate(${ox},${oy + 12})`} />
              </G>
            )
          })}

          {/* Glow ring on selected */}
          {sel && (
            <Path
              d={sel.path}
              fill="none"
              stroke={sel.color}
              strokeWidth={8}
              opacity={0.25}
              transform={`translate(${sel.tx},${sel.ty})`}
            />
          )}

          {/* Main segments with stagger fade-in */}
          {slices.map((s, i) => {
            const isSel = selected === i
            return (
              <AnimatedPath
                key={`seg${i}`}
                d={s.path}
                fill={`url(#lg${i})`}
                stroke={isSel ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)"}
                strokeWidth={isSel ? 2.5 : 1.5}
                transform={isSel ? `translate(${s.tx},${s.ty})` : "translate(0,0)"}
                opacity={segAnims[i] as any}
                onPress={() => setSelected(selected === i ? null : i)}
              />
            )
          })}

          {/* Center hole */}
          <Circle cx={cx} cy={cy} r={innerR - 2} fill="#1a1a2e" />
          {/* Subtle inner ring */}
          <Circle cx={cx} cy={cy} r={innerR - 2} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />

          {/* Center content */}
          {sel ? (
            <G>
              <Circle cx={cx} cy={cy} r={innerR - 4} fill={sel.color} opacity={0.08} />
              <SvgText x={cx} y={cy - 10} textAnchor="middle" fill={sel.color} fontSize="9" fontWeight="bold" letterSpacing="1.5">
                {sel.name.slice(0, 12).toUpperCase()}
              </SvgText>
              <SvgText x={cx} y={cy + 10} textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">
                {`${symbol}${sel.amount.toFixed(2)}`}
              </SvgText>
            </G>
          ) : (
            <G>
              <SvgText x={cx} y={cy - 7} textAnchor="middle" fill="#64748b" fontSize="9" letterSpacing="2">
                TOTAL
              </SvgText>
              <SvgText x={cx} y={cy + 11} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="bold">
                {`${symbol}${total.toFixed(2)}`}
              </SvgText>
            </G>
          )}
        </Svg>
      </Animated.View>
      <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2, fontStyle: "italic" }}>Tap a slice to explore</Text>
    </View>
  )
}

function openDatePicker(current: Date, onChange: (d: Date) => void) {
  DateTimePickerAndroid.open({
    value: current,
    mode: "date",
    is24Hour: true,
    maximumDate: new Date(),
    onChange: (_, selected) => { if (selected) onChange(selected) },
  })
}

function BarChart({ data, maxAmt, barHeight, symbol, code }: {
  data: { name: string; amount: number; color: string }[]
  maxAmt: number
  barHeight: number
  symbol: string
  code: string
}) {
  const C = useTheme()
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current
  useEffect(() => {
    Animated.stagger(100, barAnims.map(a =>
      Animated.spring(a, { toValue: 1, tension: 55, friction: 8, useNativeDriver: false })
    )).start()
  }, [])

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20 }}>
      <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 20 }}>Who Paid the Most</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: barHeight + 40 }}>
        {data.map((d, i) => {
          const heightPct = maxAmt > 0 ? d.amount / maxAmt : 0
          const barH = barAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, barHeight * heightPct] })
          return (
            <View key={i} style={{ alignItems: "center", flex: 1, gap: 6 }}>
              {/* Amount label */}
              <Animated.Text style={{ color: d.color, fontSize: 10, fontWeight: "700", opacity: barAnims[i] }}>
                {symbol}{d.amount >= 1000 ? `${(d.amount / 1000).toFixed(1)}k` : d.amount.toFixed(0)}
              </Animated.Text>
              {/* Bar */}
              <View style={{ width: "60%", height: barHeight, justifyContent: "flex-end" }}>
                <Animated.View style={{
                  height: barH,
                  backgroundColor: d.color,
                  borderRadius: 8,
                  width: "100%",
                  shadowColor: d.color,
                  shadowOpacity: 0.4,
                  shadowRadius: 6,
                }} />
              </View>
              {/* Name */}
              <Text style={{ color: C.textSub, fontSize: 10, fontWeight: "600", textAlign: "center" }} numberOfLines={1}>
                {d.name}
              </Text>
            </View>
          )
        })}
      </View>
      {/* Baseline */}
      <View style={{ height: 1, backgroundColor: C.iconBg, marginTop: 4 }} />
    </View>
  )
}

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { height: windowH } = useWindowDimensions()
  const { user } = useAuthStore()
  const C = useTheme()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>("expenses")

  // Edit Group modal
  const [showEditGroup, setShowEditGroup] = useState(false)
  const [editGroupName, setEditGroupName] = useState("")
  const [editGroupDesc, setEditGroupDesc] = useState("")
  const [editGroupEmoji, setEditGroupEmoji] = useState("💰")
  const [editGroupColor, setEditGroupColor] = useState("#6366f1")
  const [editGroupCurrency, setEditGroupCurrency] = useState("INR")
  const [showEditCurrencyPicker, setShowEditCurrencyPicker] = useState(false)
  const [editCurrencySearch, setEditCurrencySearch] = useState("")

  // Add Expense modal
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expDesc, setExpDesc] = useState("")
  const [expAmount, setExpAmount] = useState("")
  const [expCurrency, setExpCurrency] = useState("")
  const [expCategory, setExpCategory] = useState("general")
  const [expPaidBy, setExpPaidBy] = useState<string>(user?.id ?? "")
  const [expDate, setExpDate] = useState(new Date())

  // Split options
  type SplitType = "EQUAL" | "PERCENTAGE" | "CUSTOM"
  const [splitType, setSplitType] = useState<SplitType>("EQUAL")
  const [equallyIncluded, setEquallyIncluded] = useState<string[]>([])
  const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>({})
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})

  // Edit Expense modal
  const [showEditExpense, setShowEditExpense] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editDesc, setEditDesc] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editCurrency, setEditCurrency] = useState("")
  const [editCategory, setEditCategory] = useState("general")
  const [editPaidBy, setEditPaidBy] = useState("")
  const [editDate, setEditDate] = useState(new Date())

  // Add Member modal — friends picker
  const [showAddMember, setShowAddMember] = useState(false)
  const [friendSearch, setFriendSearch] = useState("")

  // Settle modal
  const [showSettle, setShowSettle] = useState(false)
  const [settleTarget, setSettleTarget] = useState<{ userId: string; name: string; amount: number } | null>(null)
  const [settleNote, setSettleNote] = useState("")

  // Balances tab — collapse/expand & inline settle
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set())
  const [inlineSettleKey, setInlineSettleKey] = useState<string | null>(null)
  const [inlineSettleAmount, setInlineSettleAmount] = useState("")

  // Currency conversion in Balances tab: { "USD": 84.52 } means 1 USD = 84.52 INR
  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [convertedSections, setConvertedSections] = useState<Record<string, boolean>>({})

  // Custom confirm dialog (replaces native Alert.alert)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmText: string; danger?: boolean; onConfirm: () => void
  } | null>(null)
  function showConfirm(cfg: typeof confirmDialog) { setConfirmDialog(cfg) }

  // Notes (Utility tab)
  const [showNotes, setShowNotes] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [noteSaving, setNoteSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [showTrackModal, setShowTrackModal] = useState(false)

  // Track Expense
  type TrackConfig = { groupId: string; groupName: string; enabledAt: string; expiresAt: string | null }
  const TRACK_KEY = "trackExpense"
  const [trackConfig, setTrackConfig] = useState<TrackConfig | null>(null)
  const isTracking = trackConfig?.groupId === id &&
    (trackConfig?.expiresAt === null || new Date(trackConfig.expiresAt) > new Date())
  const otherGroupTracking = !!trackConfig && !isTracking

  useEffect(() => {
    AsyncStorage.getItem(TRACK_KEY).then((raw) => {
      if (!raw) return
      const cfg: TrackConfig = JSON.parse(raw)
      // auto-clear if expired
      if (cfg.expiresAt && new Date(cfg.expiresAt) <= new Date()) {
        AsyncStorage.removeItem(TRACK_KEY)
      } else {
        setTrackConfig(cfg)
      }
    })
  }, [id])

  async function openTrackDatePicker() {
    if (Platform.OS !== "android") {
      Toast.show({ type: "error", text1: "SMS tracking is Android only" })
      return
    }
    try {
      const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS)
      if (!already) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          {
            title: "SMS Permission Required",
            message: "SplitEase needs to read incoming SMS to auto-detect expenses for this group.",
            buttonPositive: "Allow",
            buttonNegative: "Deny",
          }
        )
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          Toast.show({
            type: "error",
            text1: "Permission denied",
            text2: "Enable SMS permission in device settings to use expense tracking.",
          })
          return
        }
      }
      setShowTrackModal(true)
    } catch {
      Toast.show({ type: "error", text1: "Could not request SMS permission" })
    }
  }

  function pickTrackEndDate() {
    setShowTrackModal(false)
    DateTimePickerAndroid.open({
      value: new Date(Date.now() + 86400000),
      mode: "date",
      minimumDate: new Date(Date.now() + 86400000),
      onChange: (_, selected) => {
        if (selected) enableTracking(selected)
      },
    })
  }

  async function enableTracking(expiresAt: Date | null) {
    const cfg: TrackConfig = {
      groupId: id as string,
      groupName: group?.name ?? "Group",
      enabledAt: new Date().toISOString(),
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    }
    await AsyncStorage.setItem(TRACK_KEY, JSON.stringify(cfg))
    await syncTrackConfigToNative(cfg)
    setTrackConfig(cfg)
    Toast.show({ type: "success", text1: "📡 Tracking started!", text2: expiresAt ? `Until ${formatDate(expiresAt)}` : "Stops manually" })
  }

  async function stopTracking() {
    await AsyncStorage.removeItem(TRACK_KEY)
    await syncTrackConfigToNative(null)
    setTrackConfig(null)
    Toast.show({ type: "info", text1: "Tracking stopped" })
  }

  function confirmStopTracking() {
    showConfirm({
      title: "Stop Tracking?",
      message: "SMS expense tracking will be disabled for this group.",
      confirmText: "Stop",
      danger: true,
      onConfirm: stopTracking,
    })
  }

  useEffect(() => {
    if (id) {
      AsyncStorage.getItem(`group-note-${id}`).then((v) => { if (v) setNoteText(v) })
    }
  }, [id])

  async function saveNote() {
    setNoteSaving(true)
    await AsyncStorage.setItem(`group-note-${id}`, noteText)
    setNoteSaving(false)
    setShowNotes(false)
    Toast.show({ type: "success", text1: "Note saved!" })
  }

  const { data: group, isLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })

  const { data: balances = [] } = useQuery({
    queryKey: ["balances", id],
    queryFn: () => balancesApi.get(id).then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled: !!id,
  })

  // Fetch FX rates for non-default currencies when balances or analytics tab is open
  useEffect(() => {
    if (tab !== "balances" && tab !== "analytics") return
    const defaultCode = group?.currency ?? "USD"
    const fromBalances = (balances as any[]).map((g: any) => g.currency as string).filter(Boolean)
    const fromExpenses = (expenses as any[]).map((e: any) => e.currency ?? defaultCode).filter(Boolean)
    const nonDefault = [...new Set([...fromBalances, ...fromExpenses])]
      .filter((c) => c !== defaultCode && !fxRates[c])
    if (nonDefault.length === 0) return
    Promise.all(nonDefault.map(async (cur) => {
      const rate = await getRate(cur, defaultCode)
      return { currency: cur, rate }
    })).then((results) => {
      setFxRates((prev) => {
        const next = { ...prev }
        for (const r of results) if (r.rate !== null) next[r.currency] = r.rate
        return next
      })
    })
  }, [tab, balances, expenses, group?.currency])

  const addExpenseMutation = useMutation({
    mutationFn: () => {
      const numAmount = parseFloat(expAmount)
      const memberIds = members.map((m: any) => m.userId)
      const included = equallyIncluded.length > 0 ? equallyIncluded : memberIds
      const activeCurrency = expCurrency || gc.code

      let apiSplitType: string
      let splits: any[] | undefined

      if (splitType === "EQUAL") {
        apiSplitType = "EXACT"
        const n = included.length
        const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrency)
        if (isNoDec) {
          // 0-decimal currencies (JPY, KRW, …): split at base-unit level
          const totalUnits = Math.round(numAmount)
          const baseUnits = Math.floor(totalUnits / n)
          const extra = totalUnits - baseUnits * n
          splits = included.map((uid: string, i: number) => ({
            userId: uid,
            amount: baseUnits + (i < extra ? 1 : 0),
          }))
        } else {
          // 2-decimal currencies: split in cents so the total is exact
          const totalCents = Math.round(numAmount * 100)
          const baseCents = Math.floor(totalCents / n)
          const extra = totalCents - baseCents * n
          splits = included.map((uid: string, i: number) => ({
            userId: uid,
            amount: (baseCents + (i < extra ? 1 : 0)) / 100,
          }))
        }
      } else if (splitType === "PERCENTAGE") {
        apiSplitType = "PERCENTAGE"
        splits = memberIds
          .filter((uid: string) => parseFloat(percentageSplits[uid] || "0") > 0)
          .map((uid: string) => ({ userId: uid, percentage: parseFloat(percentageSplits[uid] || "0") }))
      } else {
        apiSplitType = "EXACT"
        splits = memberIds
          .filter((uid: string) => parseFloat(customSplits[uid] || "0") > 0)
          .map((uid: string) => ({ userId: uid, amount: parseFloat(customSplits[uid] || "0") }))
      }

      return expensesApi.add(id, {
        description: expDesc.trim(),
        amount: numAmount,
        category: expCategory,
        paidById: expPaidBy || user!.id,
        splitType: apiSplitType,
        splits,
        date: expDate.toISOString(),
        currency: activeCurrency,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["balances", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      setShowAddExpense(false)
      resetAddForm()
      Toast.show({ type: "success", text1: "Expense added!" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to add expense" }),
  })

  const editExpenseMutation = useMutation({
    mutationFn: () => expensesApi.update(id, editTarget.id, {
      description: editDesc.trim(),
      amount: parseFloat(editAmount),
      category: editCategory,
      paidById: editPaidBy,
      date: editDate.toISOString(),
      currency: editCurrency || gc.code,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["balances", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      setShowEditExpense(false)
      Toast.show({ type: "success", text1: "Expense updated!" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to update expense" }),
  })

  const deleteExpenseMutation = useMutation({
    mutationFn: (expenseId: string) => expensesApi.delete(id, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["balances", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      Toast.show({ type: "success", text1: "Expense deleted" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to delete expense" }),
  })

  const addMemberMutation = useMutation({
    mutationFn: (email: string) => membersApi.add(id, email),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => membersApi.remove(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      Toast.show({ type: "success", text1: "Member removed" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to remove member" }),
  })

  const makeAdminMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "ADMIN" | "MEMBER" }) =>
      membersApi.setRole(id, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      Toast.show({ type: "success", text1: "Role updated!" })
    },
    onError: (e: any) =>
      Toast.show({ type: "error", text1: e?.response?.data?.error ?? "Failed to update role" }),
  })

  // Friends list for picker
  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: () => friendsApi.list().then((r) => (r.data && typeof r.data === "object" ? r.data : {})),
  })
  const allFriends: any[] = (friendsData as any)?.friends ?? []

  const settleMutation = useMutation({
    mutationFn: () => balancesApi.settle(id, {
      toUserId: settleTarget!.userId,
      amount: settleTarget!.amount,
      note: settleNote.trim() || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["balances", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      setShowSettle(false)
      setSettleNote("")
      setSettleTarget(null)
      Toast.show({ type: "success", text1: "Settlement recorded!" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to record settlement" }),
  })

  const updateGroupMutation = useMutation({
    mutationFn: () => groupsApi.update(id, {
      name: editGroupName.trim(),
      description: editGroupDesc.trim(),
      emoji: editGroupEmoji,
      color: editGroupColor,
      currency: editGroupCurrency,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      setShowEditGroup(false)
      Toast.show({ type: "success", text1: "Group updated!" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to update group" }),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: () => groupsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      setShowEditGroup(false)
      router.replace("/(tabs)/groups")
      Toast.show({ type: "success", text1: "Group deleted" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to delete group" }),
  })

  function openEditGroup() {
    setEditGroupName(group?.name ?? "")
    setEditGroupDesc(group?.description ?? "")
    setEditGroupEmoji(group?.emoji ?? "💰")
    setEditGroupColor(group?.color ?? "#6366f1")
    setEditGroupCurrency(group?.currency ?? "INR")
    setShowEditGroup(true)
  }

  function confirmDeleteGroup() {
    showConfirm({
      title: "Delete Group",
      message: `Delete "${group?.name}"? All expenses and data will be permanently removed.`,
      confirmText: "Delete",
      danger: true,
      onConfirm: () => deleteGroupMutation.mutate(),
    })
  }

  function resetAddForm() {
    setExpDesc(""); setExpAmount(""); setExpCategory("general")
    setExpCurrency(gc.code)
    setExpPaidBy(user?.id ?? ""); setExpDate(new Date())
    setSplitType("EQUAL"); setEquallyIncluded([]); setPercentageSplits({}); setCustomSplits({})
  }

  function openEdit(exp: any) {
    setEditTarget(exp)
    setEditDesc(exp.description)
    setEditAmount(String(exp.amount))
    setEditCurrency(exp.currency ?? gc.code)
    setEditCategory(exp.category ?? "general")
    setEditPaidBy(exp.paidById)
    setEditDate(new Date(exp.date ?? exp.createdAt))
    setShowEditExpense(true)
  }

  function confirmDelete(exp: any) {
    showConfirm({
      title: "Delete Expense",
      message: `Delete "${exp.description}"? This cannot be undone.`,
      confirmText: "Delete",
      danger: true,
      onConfirm: () => deleteExpenseMutation.mutate(exp.id),
    })
  }

  function openSettle(userId: string, name: string, amount: number) {
    setSettleTarget({ userId, name, amount })
    setShowSettle(true)
  }

  const expenses: any[] = group?.expenses ?? []
  const members: any[] = group?.members ?? []

  // Is the current user an admin of this group?
  const isAdmin = members.some((m: any) => m.userId === user?.id && m.role === "ADMIN")

  // Group currency info — used for all amount display in this screen
  const gc = CURRENCIES.find((c) => c.code === (group?.currency ?? "USD")) ?? CURRENCIES[0]

  // Per-currency net balance
  const myNetByCurrency: Record<string, number> = {}
  for (const exp of expenses) {
    const currency = exp.currency ?? gc.code
    const mySplit = exp.splits?.find((s: any) => s.userId === user?.id)
    if (!mySplit) continue
    if (!myNetByCurrency[currency]) myNetByCurrency[currency] = 0
    if (exp.paidById === user?.id) {
      exp.splits?.forEach((s: any) => {
        if (s.userId !== user?.id && !s.paid) myNetByCurrency[currency] += s.amount
      })
    } else if (!mySplit.paid) {
      myNetByCurrency[currency] -= mySplit.amount
    }
  }
  // Keep default currency first, then others sorted by code
  const balanceEntries = Object.entries(myNetByCurrency)
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => a === gc.code ? -1 : b === gc.code ? 1 : a.localeCompare(b))
  const myNet = myNetByCurrency[gc.code] ?? 0

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }} edges={["top"]}>
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View className="flex-row items-center gap-3 mb-3">
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: C.iconBg, borderRadius: 12, padding: 8 }}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: (group?.color ?? "#6366f1") + "33", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22 }}>{group?.emoji}</Text>
          </View>
          <View className="flex-1">
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }} numberOfLines={1}>{group?.name}</Text>
            {group?.description ? <Text style={{ color: C.textSub, fontSize: 12 }}>{group.description}</Text> : null}
          </View>
          <TouchableOpacity onPress={openEditGroup} style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 12, padding: 10 }}>
            <Ionicons name="pencil" size={16} color="#a5b4fc" />
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2 mb-3">
          <View style={{ flex: 1, backgroundColor: myNet >= 0 ? "rgba(34,197,94,0.1)" : "rgba(244,63,94,0.1)", borderRadius: 14, borderWidth: 1, borderColor: myNet >= 0 ? "rgba(34,197,94,0.2)" : "rgba(244,63,94,0.2)", padding: 12, alignItems: "center" }}>
            <Text style={{ color: C.textSub, fontSize: 12, marginBottom: 8 }}>Your balance</Text>
            {balanceEntries.length === 0 ? (
              <Text style={{ color: "#64748b", fontWeight: "800", fontSize: 18 }}>Settled up ✅</Text>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
                {balanceEntries.map(([code, net], idx) => {
                  const ci = CURRENCIES.find(c => c.code === code) ?? { symbol: code, code }
                  const color = net >= 0 ? "#4ade80" : "#f87171"
                  const bgColor = net >= 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)"
                  const borderColor = net >= 0 ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"
                  return (
                    <View key={code} style={{ backgroundColor: bgColor, borderRadius: 10, borderWidth: 1, borderColor, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center" }}>
                      <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: "600", marginBottom: 2 }}>{code}</Text>
                      <Text style={{ color, fontWeight: "800", fontSize: 18 }}>
                        {net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(net), ci.symbol, ci.code)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => { setExpCurrency(gc.code); setShowAddExpense(true) }}
            style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", gap: 4 }}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={{ color: C.text, fontSize: 10, fontWeight: "600" }}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: C.iconBg, borderRadius: 12 }} contentContainerStyle={{ padding: 3, gap: 4 }}>
          {(["expenses", "balances", "analytics", "members", "utility"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{ backgroundColor: tab === t ? "#6366f1" : "transparent", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, alignItems: "center" }}
            >
              <Text style={{ color: tab === t ? "#fff" : C.textSub, fontWeight: "600", fontSize: 13, textTransform: "capitalize" }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tracking Banner */}
      {isTracking && (
        <View style={{ backgroundColor: "rgba(99,102,241,0.12)", borderBottomWidth: 1, borderBottomColor: "rgba(99,102,241,0.2)", paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={{ color: "#a5b4fc", fontSize: 13, fontWeight: "600", textAlign: "center" }}>
            📡 Tracking expenses{trackConfig?.expiresAt ? ` · ends ${formatDate(new Date(trackConfig.expiresAt))}` : ""}
          </Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Expenses Tab */}
        {tab === "expenses" && (
          expenses.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-5xl mb-3">📝</Text>
              <Text style={{ color: C.text, fontWeight: "600", marginBottom: 4 }}>No expenses yet</Text>
              <Text style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 20 }}>Add the first expense for this group</Text>
              <TouchableOpacity onPress={() => { setExpCurrency(gc.code); setShowAddExpense(true) }} style={{ backgroundColor: "#6366f1", borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 }}>
                <Text style={{ color: C.text, fontWeight: "600" }}>Add expense</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-2 py-3">
              {expenses.slice().sort((a: any, b: any) => {
                const dateDiff = new Date(b.date ?? b.createdAt).getTime() - new Date(a.date ?? a.createdAt).getTime()
                if (dateDiff !== 0) return dateDiff
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              }).map((exp: any) => {
                const mySplit = exp.splits?.find((s: any) => s.userId === user?.id)
                const isPayer = exp.paidById === user?.id
                const payer = members.find((m: any) => m.userId === exp.paidById)
                const myAmount = isPayer ? exp.amount - (mySplit?.amount ?? 0) : -(mySplit?.amount ?? 0)
                const expCurr = CURRENCIES.find(c => c.code === (exp.currency ?? gc.code)) ?? gc
                return (
                  <TouchableOpacity
                    key={exp.id}
                    onPress={() => openEdit(exp)}
                    activeOpacity={0.75}
                    style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 18 }}>{getExpenseEmoji(exp.description)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>{exp.description}</Text>
                      <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
                        {isPayer ? "You paid" : `${payer?.user?.name ?? "Someone"} paid`}
                      </Text>
                      <Text style={{ color: C.textSub, fontSize: 12 }}>{formatDate(exp.date ?? exp.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: myAmount >= 0 ? "#4ade80" : "#f87171", fontWeight: "700", fontSize: 14 }}>
                        {myAmount >= 0 ? "+" : "-"}{formatCurrency(Math.abs(myAmount), expCurr.symbol, expCurr.code)}
                      </Text>
                      <Text style={{ color: C.textSub, fontSize: 12 }}>{formatCurrency(exp.amount, expCurr.symbol, expCurr.code)} total</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )
        )}

        {/* Balances Tab — currency-sectioned */}
        {tab === "balances" && (() => {
          type MemberBalance = { getsBack: number; owes: number; debts: any[] }

          // New API returns [{currency, balances:[]}]; guard against old flat format
          const rawBalances = balances as any[]
          const currencyGroups: Array<{ currency: string; balances: any[] }> =
            rawBalances.length > 0 && rawBalances[0]?.currency !== undefined
              ? rawBalances
              : [{ currency: gc.code, balances: rawBalances }]

          const sorted = [...members].sort((a: any, b: any) =>
            a.userId === user?.id ? -1 : b.userId === user?.id ? 1 : 0
          )

          if (currencyGroups.every(g => g.balances.length === 0)) {
            return (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>🎉</Text>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }}>All settled up!</Text>
                <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>No outstanding balances</Text>
              </View>
            )
          }

          return (
            <View style={{ paddingTop: 12, gap: 24, paddingBottom: 8 }}>
              {currencyGroups.map(({ currency, balances: currBalances }, groupIdx) => {
                if (currBalances.length === 0) return null
                const ci = CURRENCIES.find(c => c.code === currency) ?? gc
                const isDefaultCurrency = currency === gc.code

                // Build per-member map for this currency group
                const map: Record<string, MemberBalance> = {}
                for (const m of members) map[m.userId] = { getsBack: 0, owes: 0, debts: [] }
                for (const b of currBalances) {
                  if (map[b.fromUserId]) {
                    map[b.fromUserId].owes += b.amount
                    map[b.fromUserId].debts.push({ dir: "owes", otherId: b.toUserId, otherUser: b.toUser, amount: b.amount })
                  }
                  if (map[b.toUserId]) {
                    map[b.toUserId].getsBack += b.amount
                    map[b.toUserId].debts.push({ dir: "getsBack", otherId: b.fromUserId, otherUser: b.fromUser, amount: b.amount })
                  }
                }

                // Per-section: converted flag + display currency info
                const isConverted = !isDefaultCurrency && !!convertedSections[currency]
                const rate = fxRates[currency] ?? null
                const dispCi = isConverted ? gc : ci
                const convertAmt = (amt: number) => isConverted && rate ? amt * rate : amt

                return (
                  <View key={currency}>
                    {/* Section divider header */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 16 }}>{ci.flag}</Text>
                        <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{currency}</Text>
                        {isDefaultCurrency && (
                          <View style={{ backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                            <Text style={{ color: "#a5b4fc", fontSize: 9, fontWeight: "700" }}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      {/* Convert / Revert button — non-default sections only */}
                      {!isDefaultCurrency && (
                        <>
                          <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                          <TouchableOpacity
                            onPress={() => setConvertedSections(prev => ({ ...prev, [currency]: !prev[currency] }))}
                            disabled={!rate}
                            style={{ backgroundColor: isConverted ? "rgba(99,102,241,0.15)" : "rgba(16,185,129,0.12)", borderRadius: 10, borderWidth: 1, borderColor: isConverted ? "rgba(99,102,241,0.4)" : "rgba(16,185,129,0.3)", paddingHorizontal: 8, paddingVertical: 5, opacity: rate ? 1 : 0.4 }}
                          >
                            <Text style={{ color: isConverted ? "#a5b4fc" : "#34d399", fontWeight: "700", fontSize: 11 }}>
                              {isConverted ? "⟲ Revert" : `→ ${gc.code}`}
                            </Text>
                            {rate ? (
                              <Text style={{ color: C.textMuted, fontSize: 9, textAlign: "center", marginTop: 1 }}>
                                1 {currency} = {gc.symbol}{rate.toFixed(2)}
                              </Text>
                            ) : (
                              <Text style={{ color: C.textMuted, fontSize: 9, textAlign: "center", marginTop: 1 }}>loading…</Text>
                            )}
                          </TouchableOpacity>
                        </>
                      )}
                      {isDefaultCurrency && <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />}
                    </View>

                    {/* Member cards */}
                    <View style={{ gap: 10 }}>
                      {sorted.map((m: any) => {
                        const mb = map[m.userId] ?? { getsBack: 0, owes: 0, debts: [] }
                        if (mb.debts.length === 0) return null
                        const net = convertAmt(mb.getsBack - mb.owes)
                        const isMe = m.userId === user?.id
                        const name = isMe ? "You" : (m.user?.name ?? "Someone")
                        const netColor = net > 0 ? "#4ade80" : net < 0 ? "#f87171" : "#64748b"
                        const cardKey = `${currency}-${m.userId}`
                        const isExpanded = expandedMembers.has(cardKey)

                        return (
                          <View key={cardKey} style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
                            <TouchableOpacity
                              onPress={() => setExpandedMembers(prev => {
                                const next = new Set(prev)
                                next.has(cardKey) ? next.delete(cardKey) : next.add(cardKey)
                                return next
                              })}
                              activeOpacity={0.7}
                              style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}
                            >
                              <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={40} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: C.text, fontWeight: "700", fontSize: 14 }}>{name}</Text>
                                <Text style={{ color: netColor, fontWeight: "600", fontSize: 13, marginTop: 2 }}>
                                  {net > 0
                                    ? `gets back ${formatCurrency(net, dispCi.symbol, dispCi.code)}`
                                    : net < 0
                                    ? `owes ${formatCurrency(Math.abs(net), dispCi.symbol, dispCi.code)}`
                                    : "settled up ✅"}
                                </Text>
                              </View>
                              <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={C.textMuted} />
                            </TouchableOpacity>

                            {isExpanded && mb.debts.map((d: any, di: number) => {
                              const settleKey = `${currency}-${m.userId}-${di}`
                              const isInlineSettle = inlineSettleKey === settleKey
                              const otherName = d.otherUser?.name ?? "Someone"
                              const displayAmt = convertAmt(d.amount)
                              return (
                                <View key={di} style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" }}>
                                  <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                                    <Avatar name={d.otherUser?.name} email={d.otherUser?.email} image={d.otherUser?.image} size={28} />
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ color: C.textSub, fontSize: 12 }}>
                                        {d.dir === "owes"
                                          ? `${isMe ? "You owe" : `${name} owes`} ${otherName}`
                                          : `${otherName} owes ${isMe ? "you" : name}`}
                                      </Text>
                                      <Text style={{ color: d.dir === "owes" ? "#f87171" : "#4ade80", fontWeight: "700", fontSize: 14 }}>
                                        {formatCurrency(displayAmt, dispCi.symbol, dispCi.code)}
                                      </Text>
                                    </View>
                                    {(isMe || isAdmin) && (
                                      <View style={{ flexDirection: "row", gap: 6 }}>
                                        <TouchableOpacity style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                                          <Text style={{ color: "#fbbf24", fontWeight: "600", fontSize: 11 }}>Remind</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          onPress={() => {
                                            if (isInlineSettle) { setInlineSettleKey(null); setInlineSettleAmount("") }
                                            else { setInlineSettleKey(settleKey); setInlineSettleAmount(d.amount.toFixed(2)) }
                                          }}
                                          style={{ backgroundColor: "#6366f1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                                        >
                                          <Text style={{ color: C.text, fontWeight: "600", fontSize: 11 }}>Settle up</Text>
                                        </TouchableOpacity>
                                      </View>
                                    )}
                                  </View>

                                  {(isMe || isAdmin) && isInlineSettle && (
                                    <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}>
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: C.iconBg, borderRadius: 10, borderWidth: 1, borderColor: "rgba(99,102,241,0.5)", paddingHorizontal: 12, height: 40 }}>
                                          <Text style={{ color: C.textSub, fontSize: 14, marginRight: 4 }}>{ci.symbol}</Text>
                                          <TextInput
                                            style={{ flex: 1, color: C.text, fontSize: 14 }}
                                            keyboardType="decimal-pad"
                                            value={inlineSettleAmount}
                                            onChangeText={setInlineSettleAmount}
                                            placeholder={d.amount.toFixed(2)}
                                            placeholderTextColor={C.textMuted}
                                            autoFocus
                                          />
                                        </View>
                                        <TouchableOpacity
                                          onPress={() => {
                                            const amt = parseFloat(inlineSettleAmount)
                                            if (!amt || amt <= 0) return
                                            const capped = Math.min(amt, d.amount)
                                            balancesApi.settle(id, { toUserId: d.otherId, amount: capped })
                                              .then(() => {
                                                queryClient.invalidateQueries({ queryKey: ["group", id] })
                                                queryClient.invalidateQueries({ queryKey: ["balances", id] })
                                                queryClient.invalidateQueries({ queryKey: ["groups"] })
                                                queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
                                                setInlineSettleKey(null)
                                                setInlineSettleAmount("")
                                                Toast.show({ type: "success", text1: amt >= d.amount ? "Fully settled! 🎉" : "Partial settlement recorded!" })
                                              })
                                              .catch(() => Toast.show({ type: "error", text1: "Failed to record settlement" }))
                                          }}
                                          style={{ backgroundColor: "#6366f1", borderRadius: 10, paddingHorizontal: 14, height: 40, alignItems: "center", justifyContent: "center" }}
                                        >
                                          <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>Confirm</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => { setInlineSettleKey(null); setInlineSettleAmount("") }} style={{ padding: 6 }}>
                                          <Ionicons name="close" size={18} color={C.textMuted} />
                                        </TouchableOpacity>
                                      </View>
                                      <Text style={{ color: C.textMuted, fontSize: 11 }}>
                                        Max: {formatCurrency(d.amount, ci.symbol, ci.code)} — enter full amount to settle completely
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )
                            })}
                          </View>
                        )
                      })}
                    </View>
                  </View>
                )
              })}
            </View>
          )
        })()}

        {/* Members Tab */}
        {tab === "members" && (
          <View className="py-3 gap-2">
            {/* Add members — admin only */}
            {isAdmin && (
              <TouchableOpacity
                onPress={() => setShowAddMember(true)}
                style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="person-add" size={20} color="#a5b4fc" />
                </View>
                <Text style={{ color: "#a5b4fc", fontWeight: "600" }}>Add members</Text>
              </TouchableOpacity>
            )}

            {members.map((m: any) => {
              const isMemberAdmin = m.role === "ADMIN"
              const isMe = m.userId === user?.id
              return (
                <View
                  key={m.id}
                  style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={44} />
                  <View style={{ flex: 1 }}>
                    <View className="flex-row items-center gap-2">
                      <Text style={{ color: C.text, fontWeight: "600" }}>{m.user?.name ?? "Unknown"}</Text>
                      {isMe && <Text style={{ color: "#a5b4fc", fontSize: 10, fontWeight: "600" }}>(you)</Text>}
                    </View>
                    <Text style={{ color: C.textSub, fontSize: 12 }}>{m.user?.email}</Text>
                  </View>
                  {/* Admin badge */}
                  {isMemberAdmin && (
                    <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "600" }}>Admin</Text>
                    </View>
                  )}
                  {/* Admin-only actions */}
                  {isAdmin && !isMe && (
                    <View style={{ flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => showConfirm({
                          title: "Remove Member",
                          message: `Remove ${m.user?.name} from this group?`,
                          confirmText: "Remove",
                          danger: true,
                          onConfirm: () => removeMemberMutation.mutate(m.userId),
                        })}
                        disabled={removeMemberMutation.isPending}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="person-remove-outline" size={18} color="#f87171" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => showConfirm({
                          title: isMemberAdmin ? "Remove Admin" : "Make Admin",
                          message: isMemberAdmin
                            ? `Remove admin rights from ${m.user?.name}?`
                            : `Make ${m.user?.name} an admin of this group?`,
                          confirmText: isMemberAdmin ? "Remove Admin" : "Make Admin",
                          danger: false,
                          onConfirm: () => makeAdminMutation.mutate({ userId: m.userId, role: isMemberAdmin ? "MEMBER" : "ADMIN" }),
                        })}
                        disabled={makeAdminMutation.isPending}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name={isMemberAdmin ? "shield" : "shield-outline"} size={16} color={isMemberAdmin ? "#fbbf24" : "#64748b"} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* Analytics Tab */}
        {tab === "analytics" && (() => {
          // Per-currency totals and my-share
          const totalByCurrency: Record<string, number> = {}
          const myShareByCurrency: Record<string, number> = {}
          for (const e of expenses) {
            const cur = e.currency ?? gc.code
            totalByCurrency[cur] = (totalByCurrency[cur] ?? 0) + e.amount
            const mySplit = e.splits?.find((sp: any) => sp.userId === user?.id)
            if (mySplit) myShareByCurrency[cur] = (myShareByCurrency[cur] ?? 0) + mySplit.amount
          }
          // Sorted currency lists: default first, then alphabetical
          const currencyOrder = [
            gc.code,
            ...Object.keys(totalByCurrency).filter(c => c !== gc.code).sort(),
          ]
          const isMultiCurrency = currencyOrder.length > 1

          // Convert all non-default currencies to default for main totals
          const totalGroupExpense = Object.entries(totalByCurrency).reduce((sum, [c, amt]) => {
            if (c === gc.code) return sum + amt
            const rate = fxRates[c]
            return sum + (rate ? amt * rate : 0)
          }, 0)
          const myShare = Object.entries(myShareByCurrency).reduce((sum, [c, amt]) => {
            if (c === gc.code) return sum + amt
            const rate = fxRates[c]
            return sum + (rate ? amt * rate : 0)
          }, 0)
          const ratesLoaded = !isMultiCurrency || currencyOrder.slice(1).every(c => !!fxRates[c])

          // Per-member share (all currencies combined in gc for pie — gc-only expenses)
          const memberShareMap: Record<string, number> = {}
          for (const m of members) memberShareMap[m.userId] = 0
          for (const e of expenses) {
            for (const s of (e.splits ?? [])) {
              if (memberShareMap[s.userId] !== undefined) memberShareMap[s.userId] += s.amount
            }
          }
          const pieData = members
            .map((m: any, i: number) => ({
              name: m.userId === user?.id ? "You" : (m.user?.name ?? "?"),
              amount: memberShareMap[m.userId] ?? 0,
              color: PIE_COLORS[i % PIE_COLORS.length],
              userId: m.userId,
            }))
            .filter((d) => d.amount > 0)

          return (
            <View className="py-3 gap-4">
              {/* Summary cards */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                {/* GROUP TOTAL */}
                <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 }}>
                  <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>GROUP TOTAL</Text>
                  <Text style={{ color: C.text, fontSize: 22, fontWeight: "800" }}>
                    {ratesLoaded ? formatCurrency(totalGroupExpense, gc.symbol, gc.code) : "…"}
                  </Text>
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 4 }}>{expenses.length} expenses</Text>
                  {isMultiCurrency && (
                    <View style={{ marginTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)", paddingTop: 8 }}>
                      {currencyOrder.filter(c => (totalByCurrency[c] ?? 0) > 0).map(c => {
                        const ci = CURRENCIES.find(x => x.code === c) ?? { symbol: c, code: c, flag: "" }
                        return (
                          <View key={c} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: C.textMuted, fontSize: 11 }}>{ci.flag} {c}</Text>
                            <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600" }}>{formatCurrency(totalByCurrency[c], ci.symbol, ci.code)}</Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>

                {/* YOUR SHARE */}
                <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", padding: 16 }}>
                  <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>YOUR SHARE</Text>
                  <Text style={{ color: "#6366f1", fontSize: 22, fontWeight: "800" }}>
                    {ratesLoaded ? formatCurrency(myShare, gc.symbol, gc.code) : "…"}
                  </Text>
                  <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 4 }}>
                    {totalGroupExpense > 0 && ratesLoaded ? `${((myShare / totalGroupExpense) * 100).toFixed(1)}% of total` : "—"}
                  </Text>
                  {isMultiCurrency && (
                    <View style={{ marginTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: "rgba(99,102,241,0.15)", paddingTop: 8 }}>
                      {currencyOrder.filter(c => (myShareByCurrency[c] ?? 0) > 0).map(c => {
                        const ci = CURRENCIES.find(x => x.code === c) ?? { symbol: c, code: c, flag: "" }
                        return (
                          <View key={c} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={{ color: C.textMuted, fontSize: 11 }}>{ci.flag} {c}</Text>
                            <Text style={{ color: "#a5b4fc", fontSize: 11, fontWeight: "600" }}>{formatCurrency(myShareByCurrency[c], ci.symbol, ci.code)}</Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              </View>

              {/* Pie chart */}
              {pieData.length > 0 && (
                <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: "center" }}>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 20 }}>Expense Distribution</Text>
                  <AnimatedPieChart data={pieData} size={240} symbol={gc.symbol} />
                  {/* Legend */}
                  <View style={{ width: "100%", marginTop: 20, gap: 10 }}>
                    {pieData.map((d, i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: d.color }} />
                        <Text style={{ flex: 1, color: "#cbd5e1", fontSize: 13 }}>{d.name}</Text>
                        <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{formatCurrency(d.amount, gc.symbol, gc.code)}</Text>
                        <Text style={{ color: C.textMuted, fontSize: 12, width: 42, textAlign: "right" }}>
                          {totalGroupExpense > 0 ? `${((d.amount / totalGroupExpense) * 100).toFixed(1)}%` : "0%"}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Who Paid Bar Chart */}
              {(() => {
                // Calculate how much each member actually paid (paidById)
                const paidMap: Record<string, number> = {}
                for (const m of members) paidMap[m.userId] = 0
                for (const e of expenses) {
                  if (paidMap[e.paidById] !== undefined) paidMap[e.paidById] += e.amount
                }
                const barData = members
                  .map((m: any, i: number) => ({
                    name: m.userId === user?.id ? "You" : (m.user?.name?.split(" ")[0] ?? "?"),
                    amount: paidMap[m.userId] ?? 0,
                    color: PIE_COLORS[i % PIE_COLORS.length],
                    userId: m.userId,
                  }))
                  .filter(d => d.amount > 0)
                  .sort((a, b) => b.amount - a.amount)

                if (barData.length === 0) return null
                const maxAmt = barData[0].amount
                const BAR_H = 140

                return (
                  <BarChart data={barData} maxAmt={maxAmt} barHeight={BAR_H} symbol={gc.symbol} code={gc.code} />
                )
              })()}
            </View>
          )
        })()}

        {/* Utility Tab */}
        {tab === "utility" && (
          <View className="py-3 gap-3">
            {/* Write Notes */}
            <TouchableOpacity
              onPress={() => setShowNotes(true)}
              style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="document-text-outline" size={22} color="#a5b4fc" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Write Notes</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                  {noteText.trim() ? `${noteText.trim().slice(0, 40)}${noteText.length > 40 ? "…" : ""}` : "Add notes for this group"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>

            {/* Download Statement */}
            <TouchableOpacity
              onPress={async () => {
                setPdfLoading(true)
                try {
                  const totalGroupExpense = expenses.reduce((sum: number, e: any) => sum + e.amount, 0)
                  const myShare = expenses.reduce((sum: number, e: any) => {
                    const s = e.splits?.find((sp: any) => sp.userId === user?.id)
                    return sum + (s?.amount ?? 0)
                  }, 0)
                  const rows = expenses.map((e: any) => `
                    <tr>
                      <td>${new Date(e.date ?? e.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td>${e.description}</td>
                      <td>${e.paidBy?.name ?? "?"}</td>
                      <td style="text-align:right;font-weight:600">${gc.symbol}${e.amount.toFixed(2)}</td>
                    </tr>`).join("")
                  const html = `
                    <!DOCTYPE html><html><head>
                    <meta charset="utf-8"/>
                    <style>
                      body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; }
                      h1 { font-size: 24px; color: #6366f1; margin-bottom: 4px; }
                      .subtitle { color: #64748b; font-size: 13px; margin-bottom: 24px; }
                      .summary { display: flex; gap: 24px; margin-bottom: 28px; }
                      .card { background: #f8fafc; border-radius: 12px; padding: 16px 24px; flex: 1; }
                      .card-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
                      .card-value { font-size: 22px; font-weight: 800; color: #1e293b; }
                      table { width: 100%; border-collapse: collapse; }
                      th { background: #6366f1; color: #fff; padding: 10px 12px; text-align: left; font-size: 12px; }
                      td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
                      tr:nth-child(even) td { background: #f8fafc; }
                      .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }
                    </style></head><body>
                    <h1>${group?.emoji ?? ""} ${group?.name ?? "Group"} — Statement</h1>
                    <div class="subtitle">Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>
                    <div class="summary">
                      <div class="card"><div class="card-label">Total Group Expense</div><div class="card-value">${gc.symbol}${totalGroupExpense.toFixed(2)}</div></div>
                      <div class="card"><div class="card-label">Your Share</div><div class="card-value" style="color:#6366f1">${gc.symbol}${myShare.toFixed(2)}</div></div>
                    </div>
                    <table>
                      <thead><tr><th>Date</th><th>Expense</th><th>Paid By</th><th style="text-align:right">Amount</th></tr></thead>
                      <tbody>${rows}</tbody>
                    </table>
                    <div class="footer">SplitEase • All amounts in ${gc.code}</div>
                    </body></html>`
                  const { uri } = await Print.printToFileAsync({ html, base64: false })
                  await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${group?.name} Statement` })
                } catch (e) {
                  Toast.show({ type: "error", text1: "Failed to generate PDF" })
                } finally {
                  setPdfLoading(false)
                }
              }}
              disabled={pdfLoading}
              style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, opacity: pdfLoading ? 0.6 : 1 }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center" }}>
                {pdfLoading ? <ActivityIndicator color="#10b981" size="small" /> : <Ionicons name="download-outline" size={22} color="#10b981" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Download Statement</Text>
                <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>Export all expenses as PDF</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>

            {/* Track Expense */}
            <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: isTracking ? "rgba(99,102,241,0.4)" : C.border, padding: 18, gap: 14, opacity: otherGroupTracking ? 0.6 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isTracking ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={isTracking ? "radio" : "radio-outline"} size={22} color={otherGroupTracking ? C.textMuted : "#a5b4fc"} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Track Expense</Text>
                    {isTracking && (
                      <View style={{ backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: "#a5b4fc", fontSize: 10, fontWeight: "700" }}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                    {isTracking
                      ? trackConfig?.expiresAt
                        ? `Ends ${formatDate(new Date(trackConfig.expiresAt))}`
                        : "Running until stopped manually"
                      : "Auto-detect debit SMS for this group"}
                  </Text>
                </View>
              </View>

              {isTracking ? (
                <TouchableOpacity
                  onPress={confirmStopTracking}
                  style={{ backgroundColor: "rgba(244,63,94,0.1)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(244,63,94,0.25)", paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  <Ionicons name="stop-circle-outline" size={18} color="#f87171" />
                  <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 14 }}>Stop Tracking</Text>
                </TouchableOpacity>
              ) : otherGroupTracking ? (
                <View style={{ backgroundColor: C.iconBg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}>
                  <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Already tracking "{trackConfig?.groupName}"
                  </Text>
                  <Text style={{ color: C.textMuted, fontSize: 12, textAlign: "center" }}>
                    Disable it first to enable tracking here
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={openTrackDatePicker}
                  style={{ backgroundColor: "#6366f1", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  <Ionicons name="radio-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Enable Tracking</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Custom Confirm Dialog */}
      <Modal visible={!!confirmDialog} transparent animationType="fade" onRequestClose={() => setConfirmDialog(null)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20 }}>
            {/* Icon — centered */}
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: confirmDialog?.danger ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name={confirmDialog?.danger ? "warning-outline" : "shield-outline"} size={26} color={confirmDialog?.danger ? "#f87171" : "#a5b4fc"} />
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
                style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: confirmDialog?.danger ? "#ef4444" : "#6366f1", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>{confirmDialog?.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Enable Tracking Modal */}
      <Modal visible={showTrackModal} transparent animationType="fade" onRequestClose={() => setShowTrackModal(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name="radio" size={26} color="#a5b4fc" />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>Enable Expense Tracking</Text>
            <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>Auto-detect debit SMS for this group. Pick an end date to begin.</Text>
            <TouchableOpacity
              onPress={pickTrackEndDate}
              style={{ height: 50, borderRadius: 14, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginBottom: 10 }}
            >
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Pick end date</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowTrackModal(false)}
              style={{ height: 44, borderRadius: 14, borderWidth: 1, borderColor: C.borderStrong, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Notes Modal */}
      <Modal visible={showNotes} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNotes(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>Group Notes</Text>
            <TouchableOpacity onPress={() => setShowNotes(false)} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={{ flex: 1, color: C.text, fontSize: 14, lineHeight: 22, paddingHorizontal: 20, paddingTop: 8, textAlignVertical: "top" }}
            multiline
            placeholder="Write anything about this group — trip plans, reminders, important notes..."
            placeholderTextColor={C.textMuted}
            value={noteText}
            onChangeText={setNoteText}
          />
          <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
            <TouchableOpacity
              onPress={saveNote}
              disabled={noteSaving}
              style={{ backgroundColor: "#6366f1", borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
            >
              {noteSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }}>Save Note</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Expense Modal */}
      <Modal visible={showAddExpense} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddExpense(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingHorizontal: 20 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Add Expense</Text>
            <TouchableOpacity onPress={() => { setShowAddExpense(false); resetAddForm() }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <ExpenseFormFields
              desc={expDesc} setDesc={setExpDesc}
              amount={expAmount} setAmount={setExpAmount}
              currency={expCurrency || gc.code} setCurrency={setExpCurrency}
              category={expCategory} setCategory={setExpCategory}
              paidBy={expPaidBy} setPaidBy={setExpPaidBy}
              date={expDate} setDate={setExpDate}
              members={members} gc={gc} user={user}
              splitType={splitType} setSplitType={setSplitType}
              equallyIncluded={equallyIncluded} setEquallyIncluded={setEquallyIncluded}
              percentageSplits={percentageSplits} setPercentageSplits={setPercentageSplits}
              customSplits={customSplits} setCustomSplits={setCustomSplits}
            />
          </View>
          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(28, insets.bottom + 16), borderTopWidth: 1, borderTopColor: C.border }}>
            <TouchableOpacity
              onPress={() => addExpenseMutation.mutate()}
              disabled={(() => {
                if (!expDesc.trim() || !expAmount || isNaN(parseFloat(expAmount)) || addExpenseMutation.isPending) return true
                const numAmt = parseFloat(expAmount)
                const memberIds = members.map((m: any) => m.userId)
                if (splitType === "PERCENTAGE") {
                  const pctTotal = memberIds.reduce((s: number, uid: string) => s + (parseFloat(percentageSplits[uid] || "0")), 0)
                  if (Math.abs(pctTotal - 100) > 0.01) return true
                }
                if (splitType === "CUSTOM") {
                  const customTotal = memberIds.reduce((s: number, uid: string) => s + (parseFloat(customSplits[uid] || "0")), 0)
                  if (Math.abs(customTotal - numAmt) > 0.01) return true
                }
                return false
              })()}
              style={{ backgroundColor: (!expDesc.trim() || !expAmount) ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}
            >
              {addExpenseMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Add Expense</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal visible={showEditExpense} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditExpense(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingHorizontal: 20 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Edit Expense</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                onPress={() => { setShowEditExpense(false); confirmDelete(editTarget) }}
                style={{ backgroundColor: "rgba(244,63,94,0.15)", borderRadius: 20, padding: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color="#f87171" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowEditExpense(false)} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <ExpenseFormFields
              desc={editDesc} setDesc={setEditDesc}
              amount={editAmount} setAmount={setEditAmount}
              currency={editCurrency || gc.code} setCurrency={setEditCurrency}
              category={editCategory} setCategory={setEditCategory}
              paidBy={editPaidBy} setPaidBy={setEditPaidBy}
              date={editDate} setDate={setEditDate}
              members={members} gc={gc} user={user}
              splitType={splitType} setSplitType={setSplitType}
              equallyIncluded={equallyIncluded} setEquallyIncluded={setEquallyIncluded}
              percentageSplits={percentageSplits} setPercentageSplits={setPercentageSplits}
              customSplits={customSplits} setCustomSplits={setCustomSplits}
            />
          </View>
          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(28, insets.bottom + 16), borderTopWidth: 1, borderTopColor: C.border }}>
            <TouchableOpacity
              onPress={() => editExpenseMutation.mutate()}
              disabled={!editDesc.trim() || !editAmount || isNaN(parseFloat(editAmount)) || editExpenseMutation.isPending}
              style={{ backgroundColor: (!editDesc.trim() || !editAmount) ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}
            >
              {editExpenseMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal — Friends Picker */}
      <Modal visible={showAddMember} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowAddMember(false); setFriendSearch("") }}>
        <View style={{ height: windowH, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Add to {group?.name}</Text>
            <TouchableOpacity onPress={() => { setShowAddMember(false); setFriendSearch("") }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 46 }}>
            <Ionicons name="search-outline" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, color: C.text, fontSize: 14 }}
              placeholder="Search friends..."
              placeholderTextColor={C.textMuted}
              value={friendSearch}
              onChangeText={setFriendSearch}
              autoCapitalize="none"
            />
            {friendSearch.length > 0 && (
              <TouchableOpacity onPress={() => setFriendSearch("")}>
                <Ionicons name="close-circle" size={16} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Friends list */}
          {(() => {
            const members: any[] = group?.members ?? []
            const memberIds = new Set(members.map((m: any) => m.userId))
            const filtered = allFriends
              .filter((f: any) => {
                const other = f.requesterId === user?.id ? f.addressee : f.requester
                if (!other) return false
                if (memberIds.has(other.id)) return false
                if (!friendSearch.trim()) return true
                const q = friendSearch.toLowerCase()
                return other.name?.toLowerCase().includes(q) || other.email?.toLowerCase().includes(q)
              })

            if (!friendsData) {
              return (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color="#6366f1" />
                </View>
              )
            }

            if (filtered.length === 0) {
              return (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
                  <Ionicons name="people-outline" size={48} color={C.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={{ color: C.textSub, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
                    {friendSearch.trim() ? "No friends match your search" : "All your friends are already in this group"}
                  </Text>
                  <Text style={{ color: C.textMuted, fontSize: 13, textAlign: "center", marginTop: 6 }}>
                    {!friendSearch.trim() && "Add friends from the Friends tab first."}
                  </Text>
                </View>
              )
            }

            return (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                renderItem={({ item }) => {
                  const other = item.requesterId === user?.id ? item.addressee : item.requester
                  if (!other) return null
                  return (
                    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                      <Avatar name={other.name} image={other.image} size={42} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }}>{other.name}</Text>
                        <Text style={{ color: C.textMuted, fontSize: 12 }}>{other.email}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          addMemberMutation.mutate(other.email, {
                            onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: ["group", id] })
                              queryClient.invalidateQueries({ queryKey: ["friends"] })
                              Toast.show({ type: "success", text1: `${other.name} added!` })
                            },
                            onError: (err: any) => {
                              const msg = err?.response?.data?.error ?? "Failed to add member"
                              Toast.show({ type: "error", text1: msg })
                            },
                          })
                        }}
                        disabled={addMemberMutation.isPending}
                        style={{ backgroundColor: "#6366f1", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 }}
                      >
                        <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  )
                }}
              />
            )
          })()}
        </View>
      </Modal>

      {/* Edit Group Modal */}
      <Modal visible={showEditGroup} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditGroup(false)}>
        <View style={{ height: windowH, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>

          {/* Static top */}
          <View style={{ paddingHorizontal: 20 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Edit Group</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={confirmDeleteGroup}
                  style={{ backgroundColor: "rgba(244,63,94,0.15)", borderRadius: 20, padding: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#f87171" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowEditGroup(false)} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Preview card */}
            <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: editGroupColor + "33", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22 }}>{editGroupEmoji}</Text>
              </View>
              <View>
                <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{editGroupName || "Group name"}</Text>
                <Text style={{ color: C.textMuted, fontSize: 12 }}>{editGroupDesc || "No description"}</Text>
              </View>
            </View>

            {/* Group name */}
            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Group name *</Text>
            <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 48, justifyContent: "center", marginBottom: 10 }}>
              <TextInput style={{ color: C.text, fontSize: 15 }} placeholder="e.g. NYC Trip, Apartment" placeholderTextColor={C.textMuted} value={editGroupName} onChangeText={setEditGroupName} />
            </View>

            {/* Description */}
            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Description (optional)</Text>
            <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 48, justifyContent: "center", marginBottom: 10 }}>
              <TextInput style={{ color: C.text, fontSize: 15 }} placeholder="What's this group for?" placeholderTextColor={C.textMuted} value={editGroupDesc} onChangeText={setEditGroupDesc} />
            </View>

            {/* Currency */}
            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Group Currency</Text>
            <TouchableOpacity
              onPress={() => setShowEditCurrencyPicker(true)}
              style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 18 }}>{CURRENCIES.find(c => c.code === editGroupCurrency)?.flag}</Text>
                <Text style={{ color: C.text, fontSize: 15 }}>{editGroupCurrency} — {CURRENCIES.find(c => c.code === editGroupCurrency)?.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>

            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500", marginBottom: 6, marginTop: 2 }}>Icon</Text>
          </View>

          {/* Scrollable: icons + colors */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {GROUP_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setEditGroupEmoji(e)}
                  style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: editGroupEmoji === e ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)", borderWidth: editGroupEmoji === e ? 2 : 1, borderColor: editGroupEmoji === e ? "#6366f1" : "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 21 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500", marginBottom: 8 }}>Color</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {GROUP_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setEditGroupColor(c)}
                  style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c, borderWidth: editGroupColor === c ? 3 : 0, borderColor: "rgba(255,255,255,0.6)" }}
                />
              ))}
            </View>
          </ScrollView>

          {/* Static bottom: Save button */}
          <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(28, insets.bottom + 16), paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
            <TouchableOpacity
              onPress={() => updateGroupMutation.mutate()}
              disabled={!editGroupName.trim() || updateGroupMutation.isPending}
              style={{ backgroundColor: !editGroupName.trim() ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}
            >
              {updateGroupMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Save Changes</Text>}
            </TouchableOpacity>
          </View>

        </View>
      </Modal>

      {/* Edit Group Currency Picker */}
      <Modal visible={showEditCurrencyPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditCurrencyPicker(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Group Currency</Text>
            <TouchableOpacity onPress={() => { setShowEditCurrencyPicker(false); setEditCurrencySearch("") }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
            <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
            <TextInput style={{ color: C.text, flex: 1, fontSize: 15 }} placeholder="Search currency..." placeholderTextColor={C.textMuted} value={editCurrencySearch} onChangeText={setEditCurrencySearch} autoCapitalize="none" />
            {editCurrencySearch.length > 0 && <TouchableOpacity onPress={() => setEditCurrencySearch("")}><Ionicons name="close-circle" size={16} color={C.textMuted} /></TouchableOpacity>}
          </View>
          <FlatList
            data={CURRENCIES.filter(c => c.code.toLowerCase().includes(editCurrencySearch.toLowerCase()) || c.name.toLowerCase().includes(editCurrencySearch.toLowerCase()))}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 20) }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setEditGroupCurrency(item.code); setShowEditCurrencyPicker(false); setEditCurrencySearch("") }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" }}
              >
                <Text style={{ fontSize: 24 }}>{item.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600" }}>{item.code}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>{item.name}</Text>
                </View>
                {editGroupCurrency === item.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Settle Up Modal */}
      <Modal visible={showSettle} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettle(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 8 }}>
          <View className="flex-row items-center justify-between mb-6">
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Settle Up</Text>
            <TouchableOpacity onPress={() => { setShowSettle(false); setSettleNote("") }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {settleTarget && (
            <>
              <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: "center", marginBottom: 20 }}>
                <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 4 }}>You're paying</Text>
                <Text style={{ color: C.text, fontSize: 24, fontWeight: "700", marginBottom: 4 }}>{settleTarget.name}</Text>
                <Text style={{ color: "#6366f1", fontSize: 32, fontWeight: "800" }}>{formatCurrency(settleTarget.amount, gc.symbol, gc.code)}</Text>
              </View>
              <Text className="text-slate-300 text-sm font-medium mb-2">Note (optional)</Text>
              <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 20 }}>
                <TextInput style={{ color: C.text, fontSize: 15 }} placeholder="e.g. Venmo, Cash…" placeholderTextColor={C.textMuted} value={settleNote} onChangeText={setSettleNote} />
              </View>
              <TouchableOpacity
                onPress={() => settleMutation.mutate()}
                disabled={settleMutation.isPending}
                style={{ backgroundColor: "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}
              >
                {settleMutation.isPending ? <ActivityIndicator color="#fff" /> : (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Confirm Settlement</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      <BottomTabBar activeTab="Groups" />
    </SafeAreaView>
  )
}

// ── Module-level component — must live OUTSIDE GroupDetail so React sees a
// stable component identity on every render. If defined inside the parent,
// every setState call creates a new function reference, React unmounts/remounts
// the component, and the TextInput loses focus (keyboard dismissed after each letter).
function ExpenseFormFields({
  desc, setDesc, amount, setAmount, currency, setCurrency, category, setCategory,
  paidBy, setPaidBy, date, setDate,
  members, gc, user,
  splitType, setSplitType,
  equallyIncluded, setEquallyIncluded,
  percentageSplits, setPercentageSplits,
  customSplits, setCustomSplits,
}: any) {
  const C = useTheme()
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")
  const detectedCategory = guessCategory(desc)
  const categoryEmoji = getExpenseEmoji(desc)
  const activeCurrencyCode = currency || gc.code
  const activeCurrencyInfo = CURRENCIES.find(c => c.code === activeCurrencyCode) ?? gc

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Description */}
      <Text className="text-slate-300 text-sm font-medium mb-2">Description *</Text>
      <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: desc.trim() ? 8 : 14, flexDirection: "row", alignItems: "center" }}>
        <TextInput
          style={{ color: C.text, fontSize: 15, flex: 1 }}
          placeholder="What was this for?"
          placeholderTextColor={C.textMuted}
          value={desc}
          onChangeText={(t) => { setDesc(t); setCategory(guessCategory(t)) }}
        />
      </View>
      {desc.trim() ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <Text style={{ fontSize: 16 }}>{categoryEmoji}</Text>
          <Text style={{ color: C.textMuted, fontSize: 12, textTransform: "capitalize" }}>{detectedCategory}</Text>
        </View>
      ) : null}

      {/* Amount + Currency picker */}
      <Text className="text-slate-300 text-sm font-medium mb-2">Amount *</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        {/* Tappable currency chip */}
        <TouchableOpacity
          onPress={() => setShowCurrencyPicker(true)}
          style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: activeCurrencyCode !== gc.code ? "rgba(99,102,241,0.5)" : C.border, paddingHorizontal: 12, height: 52, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 4 }}
        >
          <Text style={{ color: C.text, fontSize: 16, fontWeight: "700" }}>{activeCurrencyInfo.symbol}</Text>
          <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600" }}>{activeCurrencyCode}</Text>
          <Ionicons name="chevron-down" size={11} color={C.textMuted} />
        </TouchableOpacity>
        <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 52, justifyContent: "center" }}>
          <TextInput style={{ color: C.text, fontSize: 20, fontWeight: "700" }} placeholder="0.00" placeholderTextColor={C.textMuted} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        </View>
      </View>

      {/* Currency picker modal (inline within form fields component) */}
      <Modal visible={showCurrencyPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowCurrencyPicker(false); setCurrencySearch("") }}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Expense Currency</Text>
            <TouchableOpacity onPress={() => { setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
            <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
            <TextInput style={{ color: C.text, flex: 1, fontSize: 15 }} placeholder="Search currency..." placeholderTextColor={C.textMuted} value={currencySearch} onChangeText={setCurrencySearch} autoCapitalize="none" />
            {currencySearch.length > 0 && <TouchableOpacity onPress={() => setCurrencySearch("")}><Ionicons name="close-circle" size={16} color={C.textMuted} /></TouchableOpacity>}
          </View>
          {/* Default currency first */}
          {!currencySearch && (
            <View style={{ marginHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>GROUP DEFAULT</Text>
              <TouchableOpacity
                onPress={() => { setCurrency(gc.code); setShowCurrencyPicker(false); setCurrencySearch("") }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" }}
              >
                <Text style={{ fontSize: 24 }}>{gc.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600" }}>{gc.code}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>{gc.name}</Text>
                </View>
                {activeCurrencyCode === gc.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={CURRENCIES.filter(c =>
              (currencySearch ? c.code.toLowerCase().includes(currencySearch.toLowerCase()) || c.name.toLowerCase().includes(currencySearch.toLowerCase()) : c.code !== gc.code)
            )}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={!currencySearch ? <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>OTHER CURRENCIES</Text> : null}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setCurrency(item.code); setShowCurrencyPicker(false); setCurrencySearch("") }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" }}
              >
                <Text style={{ fontSize: 24 }}>{item.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600" }}>{item.code}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>{item.name}</Text>
                </View>
                {activeCurrencyCode === item.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Date */}
      <Text className="text-slate-300 text-sm font-medium mb-2">Date</Text>
      <TouchableOpacity
        onPress={() => openDatePicker(date, setDate)}
        style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <Ionicons name="calendar-outline" size={18} color={C.textSub} />
        <Text style={{ color: C.text, fontSize: 15 }}>{formatDate(date)}</Text>
      </TouchableOpacity>

      {/* Paid by */}
      <Text className="text-slate-300 text-sm font-medium mb-2">Paid by</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        {members.map((m: any) => (
          <TouchableOpacity
            key={m.userId}
            onPress={() => setPaidBy(m.userId)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: paidBy === m.userId ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", borderRadius: 12, borderWidth: paidBy === m.userId ? 2 : 1, borderColor: paidBy === m.userId ? "#6366f1" : "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}
          >
            <Avatar name={m.user?.name} email={m.user?.email} size={24} />
            <Text style={{ color: paidBy === m.userId ? "#fff" : C.textSub, fontWeight: "600", fontSize: 13 }}>
              {m.userId === user?.id ? "You" : m.user?.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Split section ── */}
      {(() => {
        const numAmount = parseFloat(amount) || 0
        const disabled = numAmount <= 0
        const memberIds = members.map((m: any) => m.userId)
        const included = equallyIncluded.length > 0 ? equallyIncluded : memberIds

        const pctTotal = memberIds.reduce((s: number, uid: string) => s + (parseFloat(percentageSplits[uid] || "0")), 0)
        const customTotal = memberIds.reduce((s: number, uid: string) => s + (parseFloat(customSplits[uid] || "0")), 0)
        const pctError = splitType === "PERCENTAGE" && numAmount > 0 && Math.abs(pctTotal - 100) > 0.01 ? `${pctTotal.toFixed(1)}% of 100%` : null
        const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrencyCode)
        const fmt = (n: number) => isNoDec ? Math.round(n).toString() : n.toFixed(2)
        const customError = splitType === "CUSTOM" && numAmount > 0 && Math.abs(customTotal - numAmount) > (isNoDec ? 0.5 : 0.01) ? `Total ${activeCurrencyInfo.symbol}${fmt(customTotal)} must equal ${activeCurrencyInfo.symbol}${fmt(numAmount)}` : null

        return (
          <View style={{ marginTop: 4, marginBottom: 8, opacity: disabled ? 0.4 : 1 }}>
            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500", marginBottom: 8 }}>Split</Text>

            {/* Tab row */}
            <View style={{ flexDirection: "row", backgroundColor: C.iconBg, borderRadius: 12, padding: 3, marginBottom: 14 }}>
              {(["EQUAL", "PERCENTAGE", "CUSTOM"] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  disabled={disabled}
                  onPress={() => { if (!disabled) setSplitType(st) }}
                  style={{ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center", backgroundColor: splitType === st ? "#6366f1" : "transparent" }}
                >
                  <Text style={{ color: splitType === st ? "#fff" : "#64748b", fontSize: 12, fontWeight: "600" }}>
                    {st === "EQUAL" ? "Equally" : st === "PERCENTAGE" ? "%" : "Custom"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Equally */}
            {splitType === "EQUAL" && (
              <View style={{ gap: 8 }}>
                {members.map((m: any) => {
                  const isIncluded = included.includes(m.userId)
                  const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrencyCode)
                  const rawPerPerson = included.length > 0 ? numAmount / included.length : 0
                  const perPerson = isNoDec ? Math.round(rawPerPerson) : rawPerPerson
                  return (
                    <TouchableOpacity
                      key={m.userId}
                      disabled={disabled}
                      onPress={() => {
                        if (disabled) return
                        const current = equallyIncluded.length > 0 ? equallyIncluded : memberIds
                        if (isIncluded && current.length === 1) return
                        setEquallyIncluded(isIncluded ? current.filter((id: string) => id !== m.userId) : [...current, m.userId])
                      }}
                      style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: isIncluded ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)" }}
                    >
                      <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={32} />
                      <Text style={{ flex: 1, color: C.text, fontWeight: "600", fontSize: 13, marginLeft: 10 }}>
                        {m.userId === user?.id ? "You" : m.user?.name}
                      </Text>
                      {isIncluded && numAmount > 0 && (
                        <Text style={{ color: C.textSub, fontSize: 12, marginRight: 10 }}>
                          {activeCurrencyInfo.symbol}{perPerson.toFixed(2)}
                        </Text>
                      )}
                      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: isIncluded ? "#6366f1" : "#334155", backgroundColor: isIncluded ? "#6366f1" : "transparent", alignItems: "center", justifyContent: "center" }}>
                        {isIncluded && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Percentage */}
            {splitType === "PERCENTAGE" && (
              <View style={{ gap: 8 }}>
                {members.map((m: any) => {
                  const pct = percentageSplits[m.userId] ?? ""
                  const pctNum = parseFloat(pct) || 0
                  const perPerson = (pctNum / 100) * numAmount
                  return (
                    <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", height: 52, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
                      <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={32} />
                      <Text style={{ flex: 1, color: C.text, fontWeight: "600", fontSize: 13, marginLeft: 10 }} numberOfLines={1}>
                        {m.userId === user?.id ? "You" : m.user?.name}
                      </Text>
                      {numAmount > 0 && pctNum > 0 && (
                        <Text style={{ color: C.textMuted, fontSize: 11, marginRight: 6 }}>{activeCurrencyInfo.symbol}{perPerson.toFixed(2)}</Text>
                      )}
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.iconBg, borderRadius: 8, paddingHorizontal: 6, height: 32, width: 64 }}>
                        <TextInput
                          style={{ flex: 1, color: C.text, fontSize: 13, fontWeight: "600", textAlign: "right", padding: 0, height: 32 }}
                          placeholder="0"
                          placeholderTextColor={C.textMuted}
                          value={pct}
                          onChangeText={(v) => setPercentageSplits({ ...percentageSplits, [m.userId]: v.replace(/[^0-9.]/g, "") })}
                          keyboardType="decimal-pad"
                          editable={!disabled}
                        />
                        <Text style={{ color: C.textMuted, fontSize: 12, marginLeft: 2 }}>%</Text>
                      </View>
                    </View>
                  )
                })}
                {pctError && <Text style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>⚠ {pctError} used</Text>}
                {!pctError && numAmount > 0 && <Text style={{ color: "#4ade80", fontSize: 12, marginTop: 4 }}>✓ Splits to 100%</Text>}
              </View>
            )}

            {/* Custom */}
            {splitType === "CUSTOM" && (
              <View style={{ gap: 8 }}>
                {members.map((m: any) => {
                  const val = customSplits[m.userId] ?? ""
                  return (
                    <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", height: 52, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
                      <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={32} />
                      <Text style={{ flex: 1, color: C.text, fontWeight: "600", fontSize: 13, marginLeft: 10 }} numberOfLines={1}>
                        {m.userId === user?.id ? "You" : m.user?.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.iconBg, borderRadius: 8, paddingHorizontal: 6, height: 32, width: 80 }}>
                        <Text style={{ color: C.textMuted, fontSize: 12, marginRight: 2 }}>{gc.symbol}</Text>
                        <TextInput
                          style={{ flex: 1, color: C.text, fontSize: 13, fontWeight: "600", padding: 0, height: 32 }}
                          placeholder="0.00"
                          placeholderTextColor={C.textMuted}
                          value={val}
                          onChangeText={(v) => setCustomSplits({ ...customSplits, [m.userId]: v.replace(/[^0-9.]/g, "") })}
                          keyboardType="decimal-pad"
                          editable={!disabled}
                        />
                      </View>
                    </View>
                  )
                })}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ color: customError ? "#f87171" : "#64748b", fontSize: 12 }}>
                    {customError ? `⚠ ${customError}` : `Total: ${gc.symbol}${customTotal.toFixed(2)}`}
                  </Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>of {gc.symbol}{numAmount.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </View>
        )
      })()}

    </ScrollView>
  )
}

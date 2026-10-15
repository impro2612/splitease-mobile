import { useState, useEffect, useRef } from "react"
import { View, ScrollView, TouchableOpacity, Modal, ActivityIndicator, FlatList, Platform, useWindowDimensions, Animated, Pressable } from "react-native"
import { Text, TextInput } from "@/components/ui/Typography"
import FloatingContextMenu, { MenuAnchor } from "@/components/ui/FloatingContextMenu"
import { InAppFullScreenModal } from "@/components/ui/InAppModal"
import { createPusher } from "@/lib/pusher"
import * as ExpoCrypto from "expo-crypto"
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { useLocalSearchParams, router } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { groupsApi, expensesApi, balancesApi, membersApi, friendsApi, reactionsApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { formatCurrency, formatDate, guessCategory, getExpenseEmoji, parseAmountInput, toLocalDateKey } from "@/lib/utils"
import { CURRENCIES, NO_DECIMAL_CURRENCIES } from "@/lib/currencies"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"
import AsyncStorage from "@react-native-async-storage/async-storage"
import EmojiKeyboard from "rn-emoji-keyboard"
import { syncTrackConfigToNative, checkNotificationAccess, openNotificationAccessSettings } from "@/lib/nativeTrackExpense"
import { tokens, useTheme } from "@/lib/theme"
import { Money } from "@/components/ui/Money"
import { Celebration } from "@/components/ui/Celebration"
import { EmptyState } from "@/components/ui/EmptyState"
import { SkeletonRow } from "@/components/ui/Skeleton"
import { haptic } from "@/lib/haptics"
import { useOffline } from "@/context/OfflineContext"
import { BottomTabBar } from "@/components/ui/BottomTabBar"
import { getRate } from "@/lib/exchange"
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg"
const AnimatedPath = Animated.createAnimatedComponent(Path)
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"

type Tab = "expenses" | "balances" | "members" | "analytics" | "utility"

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#f87171", "#38bdf8", "#a78bfa", "#fb923c", "#34d399"]

function AnimatedPieChart({ data, size = 240, symbol = "$", code = "USD" }: {
  data: { name: string; amount: number; color: string }[]
  size?: number
  symbol?: string
  code?: string
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
          <Circle cx={cx} cy={cy} r={innerR - 2} fill={C.card} />
          {/* Subtle inner ring */}
          <Circle cx={cx} cy={cy} r={innerR - 2} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />

          {/* Center content */}
          {sel ? (
            <G>
              <Circle cx={cx} cy={cy} r={innerR - 4} fill={sel.color} opacity={0.08} />
              <SvgText x={cx} y={cy - 10} textAnchor="middle" fill={sel.color} fontSize="9" fontWeight="bold" letterSpacing="1.5">
                {sel.name.slice(0, 12).toUpperCase()}
              </SvgText>
              <SvgText x={cx} y={cy + 10} textAnchor="middle" fill={C.text} fontSize="16" fontWeight="bold">
                {formatCurrency(sel.amount, symbol, code)}
              </SvgText>
            </G>
          ) : (
            <G>
              <SvgText x={cx} y={cy - 7} textAnchor="middle" fill="#64748b" fontSize="9" letterSpacing="2">
                TOTAL
              </SvgText>
              <SvgText x={cx} y={cy + 11} textAnchor="middle" fill={C.text} fontSize="15" fontWeight="bold">
                {formatCurrency(total, symbol, code)}
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
  const { isOnline, enqueueExpense } = useOffline()
  const [tab, setTab] = useState<Tab>("expenses")
  const [prevTab, setPrevTab] = useState<Tab>("expenses") // where "Done" returns from tools/members
  // Each tab/panel starts at the top — otherwise switching kept the previous scroll offset
  const scrollRef = useRef<ScrollView>(null)
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }) }, [tab])

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
  const editOriginal = useRef<{ desc: string; amount: string; currency: string; category: string; paidBy: string; date: string; splitType: string; equallyIncluded: string[]; percentageSplits: Record<string, string>; customSplits: Record<string, string> } | null>(null)

  // Add Member modal — friends picker
  const [showAddMember, setShowAddMember] = useState(false)
  const [friendSearch, setFriendSearch] = useState("")

  // Expense reactions
  const QUICK_REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"]
  const [reactionPickerState, setReactionPickerState] = useState<{ exp: any; anchor: MenuAnchor } | null>(null)
  const reactionPickerExp = reactionPickerState?.exp ?? null
  const [expenseEmojiPickerOpen, setExpenseEmojiPickerOpen] = useState(false)
  const [togglingReaction, setTogglingReaction] = useState(false)
  const expenseRefs = useRef<Record<string, any>>({})

  function openReactionPicker(exp: any) {
    expenseRefs.current[exp.id]?.measure((_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
      setReactionPickerState({ exp, anchor: { pageX, pageY, width: w, height: h } })
    })
  }

  async function toggleReaction(expenseId: string, emoji: string) {
    if (togglingReaction || !id) return
    setReactionPickerState(null)
    setExpenseEmojiPickerOpen(false)
    setTogglingReaction(true)
    try {
      await reactionsApi.toggle(id as string, expenseId, emoji)
      queryClient.invalidateQueries({ queryKey: ["group", id] })
    } catch {
      Toast.show({ type: "error", text1: "Failed to react" })
    } finally {
      setTogglingReaction(false)
    }
  }

  // Balances tab — collapse/expand & inline settle
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set())
  const [inlineSettleKey, setInlineSettleKey] = useState<string | null>(null)
  const [inlineSettleAmount, setInlineSettleAmount] = useState("")
  const [inlineSettling, setInlineSettling] = useState(false) // blocks double-tap duplicate settlements
  const [celebrate, setCelebrate] = useState(false)

  // Currency conversion in Balances tab: { "USD": 84.52 } means 1 USD = 84.52 INR
  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [fxAttempted, setFxAttempted] = useState(false)
  const [convertedSections, setConvertedSections] = useState<Record<string, boolean>>({})

  // Custom confirm dialog (replaces native Alert.alert)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; message: string; confirmText: string; danger?: boolean; onConfirm: () => void
  } | null>(null)
  function showConfirm(cfg: typeof confirmDialog) { setConfirmDialog(cfg) }

  function openBalanceSummary(summary: {
    fromName: string
    toName: string
    amount: number
    currency: string
    symbol: string
    items: Array<{ description: string; amount: number; date: string; isCredit: boolean }>
  }) {
    router.push({
      pathname: "/group/[id]/summary",
      params: {
        id: id as string,
        fromName: summary.fromName,
        toName: summary.toName,
        amount: String(summary.amount),
        currency: summary.currency,
        symbol: summary.symbol,
        items: JSON.stringify(summary.items),
      },
    } as any)
  }

  // Notes (Utility tab)
  const [showNotes, setShowNotes] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [noteSaving, setNoteSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [showTrackModal, setShowTrackModal] = useState(false)

  // Smart Debts (Utility tab)
  const [showSmartDebtsModal, setShowSmartDebtsModal] = useState(false)
  const [smartDebtsLoading, setSmartDebtsLoading] = useState(false)

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
      Toast.show({ type: "error", text1: "Expense tracking is Android only" })
      return
    }
    try {
      const granted = await checkNotificationAccess()
      if (!granted) {
        showConfirm({
          title: "Notification Access Required",
          message: 'To track expenses automatically, allow SplitIT under "Notification read, reply & control".',
          confirmText: "Open Settings",
          danger: false,
          onConfirm: () => {
            openNotificationAccessSettings().catch(() => {
              Toast.show({ type: "error", text1: "Could not open settings" })
            })
          },
        })
        return
      }
      setShowTrackModal(true)
    } catch {
      Toast.show({ type: "error", text1: "Could not check notification access" })
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

  // Real-time reaction updates via Pusher
  useEffect(() => {
    if (!user?.id || !id) return
    const pusher = createPusher()
    const channel = pusher.subscribe(`private-user-${user.id}`)
    channel.bind("expense-reaction", (data: { groupId: string }) => {
      if (data.groupId === id) queryClient.invalidateQueries({ queryKey: ["group", id] })
    })
    return () => { channel.unbind_all(); pusher.unsubscribe(`private-user-${user.id}`); pusher.disconnect() }
  }, [user?.id, id])

  const { data: balancesData } = useQuery({
    queryKey: ["balances", id],
    queryFn: () => balancesApi.get(id).then((r) => r.data),
    enabled: !!id,
  })
  const balances = (balancesData?.balances ?? []) as any[]
  const smartDebtsEnabled: boolean = balancesData?.smartDebtsEnabled ?? false

  // Fetch FX rates for non-default currencies when balances or analytics tab is open
  // NOTE: expensesRef is defined after `expenses` is declared below (line ~680)
  const fxRateEffect_tab = tab
  const fxRateEffect_balances = balances
  const fxRateEffect_groupCurrency = group?.currency
  useEffect(() => {
    if (fxRateEffect_tab !== "balances" && fxRateEffect_tab !== "analytics" && fxRateEffect_tab !== "expenses") return
    const defaultCode = fxRateEffect_groupCurrency ?? "USD"
    const fromBalances = (fxRateEffect_balances as any[]).map((g: any) => g.currency as string).filter(Boolean)
    const fromExpenses = expensesRef.current.map((e: any) => e.currency ?? defaultCode).filter(Boolean)
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
    }).finally(() => setFxAttempted(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxRateEffect_tab, fxRateEffect_balances, fxRateEffect_groupCurrency])

  const addExpenseMutation = useMutation({
    mutationFn: async () => {
      const numAmount = parseAmountInput(expAmount)
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
          .filter((uid: string) => parseAmountInput(percentageSplits[uid] || "0") > 0)
          .map((uid: string) => ({ userId: uid, percentage: parseAmountInput(percentageSplits[uid] || "0") }))
      } else {
        apiSplitType = "EXACT"
        splits = memberIds
          .filter((uid: string) => parseAmountInput(customSplits[uid] || "0") > 0)
          .map((uid: string) => ({ userId: uid, amount: parseAmountInput(customSplits[uid] || "0") }))
      }

      // Same id for the online attempt and any offline retry → the server dedupes it
      const clientRequestId = ExpoCrypto.randomUUID()
      const payload = {
        clientRequestId,
        description: expDesc.trim(),
        amount: numAmount,
        category: expCategory,
        paidById: expPaidBy || user!.id,
        splitType: apiSplitType,
        splits: splits as { userId: string; amount: number }[],
        date: expDate.toISOString(),
        currency: activeCurrency,
      }

      if (!isOnline) {
        await enqueueExpense({
          id: clientRequestId,
          groupId: id,
          createdAt: Date.now(),
          payload,
        })
        return null
      }

      return expensesApi.add(id, payload)
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["balances", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["activity"] })
      setShowAddExpense(false)
      resetAddForm()
      haptic.success()
      if (result === null) {
        Toast.show({ type: "info", text1: "Expense saved offline", text2: "Will sync when back online" })
      } else {
        Toast.show({ type: "success", text1: "Expense added" })
      }
    },
    onError: (e: any) => { haptic.error(); Toast.show({ type: "error", text1: "Couldn't add expense", text2: e?.response?.data?.error }) },
  })

  const editExpenseMutation = useMutation({
    mutationFn: () => {
      const numAmount = parseAmountInput(editAmount)
      const memberIds = members.map((m: any) => m.userId)
      const included = equallyIncluded.length > 0 ? equallyIncluded : memberIds
      const activeCurrency = editCurrency || gc.code

      let apiSplitType: string
      let splits: { userId: string; amount: number }[]

      if (splitType === "EQUAL") {
        apiSplitType = "EXACT"
        const n = included.length
        const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrency)
        if (isNoDec) {
          const totalUnits = Math.round(numAmount)
          const baseUnits = Math.floor(totalUnits / n)
          const extra = totalUnits - baseUnits * n
          splits = included.map((uid: string, i: number) => ({
            userId: uid, amount: baseUnits + (i < extra ? 1 : 0),
          }))
        } else {
          const totalCents = Math.round(numAmount * 100)
          const baseCents = Math.floor(totalCents / n)
          const extra = totalCents - baseCents * n
          splits = included.map((uid: string, i: number) => ({
            userId: uid, amount: (baseCents + (i < extra ? 1 : 0)) / 100,
          }))
        }
      } else if (splitType === "PERCENTAGE") {
        apiSplitType = "EXACT"
        const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrency)
        splits = memberIds
          .filter((uid: string) => parseAmountInput(percentageSplits[uid] || "0") > 0)
          .map((uid: string) => {
            const pct = parseAmountInput(percentageSplits[uid] || "0")
            const raw = numAmount * pct / 100
            return { userId: uid, amount: isNoDec ? Math.round(raw) : Math.round(raw * 100) / 100 }
          })
      } else {
        apiSplitType = "EXACT"
        splits = memberIds
          .filter((uid: string) => parseAmountInput(customSplits[uid] || "0") > 0)
          .map((uid: string) => ({ userId: uid, amount: parseAmountInput(customSplits[uid] || "0") }))
      }

      return expensesApi.update(id, editTarget.id, {
        description: editDesc.trim(),
        amount: numAmount,
        category: editCategory,
        paidById: editPaidBy,
        date: editDate.toISOString(),
        currency: activeCurrency,
        splitType: apiSplitType,
        splits,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["balances", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["activity"] })
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
      queryClient.invalidateQueries({ queryKey: ["activity"] })
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
    // Server explains why (e.g. the member still has an unsettled balance)
    onError: (e: any) => Toast.show({ type: "error", text1: "Couldn't remove member", text2: e?.response?.data?.error }),
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

  function openEditGroup() {
    router.push(`/group/${id}/edit` as any)
  }

  function resetAddForm() {
    setExpDesc(""); setExpAmount(""); setExpCategory("general")
    setExpCurrency(gc.code)
    setExpPaidBy(user?.id ?? ""); setExpDate(new Date())
    setSplitType("EQUAL"); setEquallyIncluded([]); setPercentageSplits({}); setCustomSplits({})
  }

  function openEdit(exp: any) {
    setEditTarget(exp)
    const origDesc = exp.description
    const origAmount = String(exp.amount)
    const origCurrency = exp.currency ?? gc.code
    const origCategory = exp.category ?? "general"
    const origPaidBy = exp.paidById
    const origDate = new Date(exp.date ?? exp.createdAt).toISOString()
    // split fields are resolved below — patched into editOriginal after the split block
    editOriginal.current = { desc: origDesc, amount: origAmount, currency: origCurrency, category: origCategory, paidBy: origPaidBy, date: origDate, splitType: "", equallyIncluded: [], percentageSplits: {}, customSplits: {} }
    setEditDesc(origDesc)
    setEditAmount(origAmount)
    setEditCurrency(origCurrency)
    setEditCategory(origCategory)
    setEditPaidBy(origPaidBy)
    setEditDate(new Date(exp.date ?? exp.createdAt))

    const splits: any[] = exp.splits ?? []
    const splitUserIds: string[] = splits.map((s: any) => s.userId)

    if (exp.splitType === "PERCENTAGE") {
      // Restore percentage split — derive % from saved amounts
      setSplitType("PERCENTAGE")
      setEquallyIncluded([])
      const pct: Record<string, string> = {}
      for (const s of splits) {
        pct[s.userId] = String(parseFloat((s.amount / exp.amount * 100).toFixed(4)))
      }
      setPercentageSplits(pct)
      setCustomSplits({})
      editOriginal.current!.splitType = "PERCENTAGE"
      editOriginal.current!.equallyIncluded = []
      editOriginal.current!.percentageSplits = { ...pct }
      editOriginal.current!.customSplits = {}
    } else {
      // "EXACT" covers both EQUAL and CUSTOM UI modes. Distinguish by whether
      // all included members have (approximately) the same share.
      const amounts = splits.map((s: any) => s.amount)
      const isEqualSplit =
        amounts.length <= 1 ||
        Math.max(...amounts) - Math.min(...amounts) <= 0.01

      if (isEqualSplit) {
        setSplitType("EQUAL")
        setEquallyIncluded(splitUserIds)
        setPercentageSplits({})
        setCustomSplits({})
        editOriginal.current!.splitType = "EQUAL"
        editOriginal.current!.equallyIncluded = [...splitUserIds]
        editOriginal.current!.percentageSplits = {}
        editOriginal.current!.customSplits = {}
      } else {
        setSplitType("CUSTOM")
        setEquallyIncluded([])
        setPercentageSplits({})
        const custom: Record<string, string> = {}
        for (const s of splits) custom[s.userId] = String(s.amount)
        setCustomSplits(custom)
        editOriginal.current!.splitType = "CUSTOM"
        editOriginal.current!.equallyIncluded = []
        editOriginal.current!.percentageSplits = {}
        editOriginal.current!.customSplits = { ...custom }
      }
    }

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

  const expenses: any[] = group?.expenses ?? []
  const members: any[] = group?.members ?? []

  // Ref used by the FX rate useEffect above — must be declared after `expenses`
  const expensesRef = useRef<any[]>(expenses)
  expensesRef.current = expenses

  // Is the current user an admin of this group?
  const isAdmin = members.some((m: any) => m.userId === user?.id && m.role === "ADMIN")

  // Group currency info — used for all amount display in this screen
  const gc = CURRENCIES.find((c) => c.code === (group?.currency ?? "USD")) ?? CURRENCIES[0]

  // Per-currency net balance
  const myNetByCurrency: Record<string, number> = {}
  for (const exp of expenses) {
    const currency = exp.currency ?? gc.code
    const mySplit = exp.splits?.find((s: any) => s.userId === user?.id)
    const iPaid = exp.paidById === user?.id
    // An expense I paid counts even when I'm not one of the people it was split between
    if (!mySplit && !iPaid) continue
    if (!myNetByCurrency[currency]) myNetByCurrency[currency] = 0
    if (iPaid) {
      exp.splits?.forEach((s: any) => {
        if (s.userId !== user?.id && !s.paid) myNetByCurrency[currency] += s.amount
      })
    } else if (!mySplit.paid) {
      myNetByCurrency[currency] -= mySplit.amount
    }
  }
  // Settlements move money too — without them the header showed debts that were already paid
  for (const st of (group?.settlements ?? []) as any[]) {
    const currency = st.currency ?? gc.code
    if (st.fromUserId === user?.id) myNetByCurrency[currency] = (myNetByCurrency[currency] ?? 0) + st.amount
    if (st.toUserId === user?.id) myNetByCurrency[currency] = (myNetByCurrency[currency] ?? 0) - st.amount
  }
  for (const c of Object.keys(myNetByCurrency)) {
    myNetByCurrency[c] = Math.round(myNetByCurrency[c] * 100) / 100
  }
  // Keep default currency first, then others sorted by code
  const balanceEntries = Object.entries(myNetByCurrency)
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => a === gc.code ? -1 : b === gc.code ? 1 : a.localeCompare(b))
  const myNet = myNetByCurrency[gc.code] ?? 0

  // Who should pay next: aggregate net debt across ALL currencies, converting to default via fxRates
  const nextPayer = (() => {
    if (members.length < 2) return null
    const rawBalances = balances as any[]
    if (rawBalances.length === 0) return null
    const netByMember: Record<string, number> = {}
    for (const m of members) netByMember[m.userId] = 0
    for (const { currency, balances: currBalances } of rawBalances) {
      if (!currBalances || currBalances.length === 0) continue
      const rate = currency === gc.code ? 1 : (fxRates[currency] ?? null)
      if (rate === null) continue
      for (const b of currBalances) {
        const converted = b.amount * rate
        netByMember[b.fromUserId] = (netByMember[b.fromUserId] ?? 0) - converted
        netByMember[b.toUserId] = (netByMember[b.toUserId] ?? 0) + converted
      }
    }
    let minNet = -0.005
    let nextMember: any = null
    for (const m of members) {
      const net = netByMember[m.userId] ?? 0
      if (net < minNet) { minNet = net; nextMember = m }
    }
    if (!nextMember) return null
    return { member: nextMember, amountOwed: -minNet }
  })()

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }} edges={["top"]}>
        <View style={{ width: "100%", paddingHorizontal: 20 }}><SkeletonRow /><SkeletonRow /><SkeletonRow /></View>
      </SafeAreaView>
    )
  }

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32 }} edges={["top"]}>
        <Ionicons name="alert-circle-outline" size={48} color="#64748b" />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginTop: 16, textAlign: "center" }}>Group not found</Text>
        <Text style={{ color: "#64748b", fontSize: 14, marginTop: 8, textAlign: "center" }}>This group may have been deleted or you may no longer be a member.</Text>
        <TouchableOpacity onPress={() => router.replace("/groups")} style={{ marginTop: 24, backgroundColor: "#6366f1", borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Back to Groups</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: C.iconBg, borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={18} color={C.text} />
          </TouchableOpacity>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: (group?.color ?? tokens.accent) + "2e", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 21 }}>{group?.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 19, fontWeight: "800" }} numberOfLines={1}>{group?.name}</Text>
            <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
              {members.length} member{members.length === 1 ? "" : "s"} · {gc.code}{group?.description ? ` · ${group.description}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { haptic.tap(); if (tab !== "members") setPrevTab(tab === "utility" ? prevTab : tab); setTab(tab === "members" ? prevTab : "members") }}
            style={{ backgroundColor: tab === "members" ? tokens.accentSoft : C.iconBg, borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="Members"
          >
            <Ionicons name="people-outline" size={18} color={tab === "members" ? tokens.accentText : C.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { haptic.tap(); if (tab !== "utility") setPrevTab(tab === "members" ? prevTab : tab); setTab(tab === "utility" ? prevTab : "utility") }}
            style={{ backgroundColor: tab === "utility" ? tokens.accentSoft : C.iconBg, borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="Group tools"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={tab === "utility" ? tokens.accentText : C.text} />
          </TouchableOpacity>
        </View>

        {/* Your balance — neutral card; each currency in words, only the amount carries colour */}
        <View style={{ backgroundColor: C.card, borderRadius: tokens.radius.lg, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 }}>
          <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Your balance</Text>
          {balanceEntries.length === 0 ? (
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 20 }}>All settled up</Text>
          ) : (
            <View style={{ gap: 4 }}>
              {balanceEntries.map(([code, net]) => {
                const ci = CURRENCIES.find(c => c.code === code) ?? { symbol: code, code }
                return (
                  <View key={code} style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <Text style={{ color: C.textSub, fontSize: 15, fontWeight: "600" }}>{net > 0 ? "You get back" : "You owe"}</Text>
                    <Money amount={net} symbol={ci.symbol} code={ci.code} size={22} color={net > 0 ? tokens.positive : tokens.negative} />
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {tab === "utility" || tab === "members" ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 40 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: "700" }}>{tab === "utility" ? "Group tools" : "Members"}</Text>
            <TouchableOpacity onPress={() => setTab(prevTab)} style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}>
              <Text style={{ color: tokens.accentText, fontSize: 13, fontWeight: "600" }}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: "row", backgroundColor: C.iconBg, borderRadius: 12, padding: 3, gap: 4 }}>
            {([["expenses", "Expenses"], ["balances", "Balances"], ["analytics", "Insights"]] as [Tab, string][]).map(([t, label]) => (
              <TouchableOpacity
                key={t}
                onPress={() => { haptic.tap(); setTab(t) }}
                style={{ flex: 1, backgroundColor: tab === t ? tokens.accent : "transparent", borderRadius: 10, paddingVertical: 8, alignItems: "center" }}
              >
                <Text style={{ color: tab === t ? "#fff" : C.textSub, fontWeight: "600", fontSize: 13 }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
        ref={scrollRef}
        style={{ flex: 1, paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Expenses Tab */}
        {tab === "expenses" && (
          expenses.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              title="No expenses yet"
              subtitle="Add the first expense — it's split between everyone automatically."
              actionLabel="Add expense"
              actionIcon="add"
              onAction={() => { resetAddForm(); setShowAddExpense(true) }}
            />
          ) : (
            <View className="gap-2 py-3">
              {expenses.slice().sort((a: any, b: any) => {
                const dateDiff = new Date(b.date ?? b.createdAt).getTime() - new Date(a.date ?? a.createdAt).getTime()
                if (dateDiff !== 0) return dateDiff
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              }).map((exp: any, idx: number, sortedList: any[]) => {
                const dayOf = (e: any) => new Date(e.date ?? e.createdAt).toDateString()
                const showDay = idx === 0 || dayOf(sortedList[idx - 1]) !== dayOf(exp)
                const mySplit = exp.splits?.find((s: any) => s.userId === user?.id)
                const isPayer = exp.paidById === user?.id
                const payer = members.find((m: any) => m.userId === exp.paidById)
                const myAmount = isPayer ? exp.amount - (mySplit?.amount ?? 0) : -(mySplit?.amount ?? 0)
                const involved = isPayer || !!mySplit
                const expCurr = CURRENCIES.find(c => c.code === (exp.currency ?? gc.code)) ?? gc
                // Group reactions: { emoji -> [userId, ...] }
                const reactionMap: Record<string, string[]> = {}
                for (const r of (exp.reactions ?? [])) {
                  if (!reactionMap[r.emoji]) reactionMap[r.emoji] = []
                  reactionMap[r.emoji].push(r.userId)
                }
                const reactionEntries = Object.entries(reactionMap)

                return (
                  <View key={exp.id}>
                  {showDay && (
                    <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "600", marginTop: idx === 0 ? 0 : 10, marginBottom: 6 }}>
                      {new Date(exp.date ?? exp.createdAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: new Date(exp.date ?? exp.createdAt).getFullYear() === new Date().getFullYear() ? undefined : "numeric" })}
                    </Text>
                  )}
                  <TouchableOpacity
                    ref={(r) => { expenseRefs.current[exp.id] = r }}
                    onPress={() => openEdit(exp)}
                    onLongPress={() => openReactionPicker(exp)}
                    delayLongPress={350}
                    activeOpacity={0.75}
                    style={{ backgroundColor: C.card, borderRadius: tokens.radius.lg, padding: 14, gap: 10 }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 18 }}>{getExpenseEmoji(exp.description)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>{exp.description}</Text>
                        <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
                          {isPayer ? "You paid" : `${payer?.user?.name ?? "Someone"} paid`} {formatCurrency(exp.amount, expCurr.symbol, expCurr.code)}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        {!involved || Math.abs(myAmount) < 0.005 ? (
                          <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "600" }}>{involved ? "your share only" : "not involved"}</Text>
                        ) : (
                          <>
                            <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: "600" }}>{myAmount > 0 ? "you lent" : "you borrowed"}</Text>
                            <Text style={{ color: myAmount > 0 ? tokens.positive : tokens.negative, fontWeight: "700", fontSize: 15, fontVariant: ["tabular-nums"] }}>
                              {formatCurrency(myAmount, expCurr.symbol, expCurr.code)}
                            </Text>
                          </>
                        )}
                        {reactionEntries.length > 0 && (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
                            {reactionEntries.map(([emoji, userIds]) => {
                              const isMine = userIds.includes(user?.id ?? "")
                              return (
                                <TouchableOpacity
                                  key={emoji}
                                  onPress={() => toggleReaction(exp.id, emoji)}
                                  style={{
                                    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                                    minWidth: 54, minHeight: 34,
                                    backgroundColor: isMine ? "#f5f3ff" : "#ffffff",
                                    borderRadius: 18, paddingHorizontal: 10, paddingVertical: 5,
                                    borderWidth: 1.5, borderColor: isMine ? "#6366f1" : "#c7d2fe",
                                    shadowColor: "#6366f1",
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: isMine ? 0.22 : 0.12,
                                    shadowRadius: 4,
                                    elevation: isMine ? 3 : 2,
                                  }}
                                >
                                  <Text style={{ fontSize: 18, lineHeight: 22 }}>{emoji}</Text>
                                  <Text style={{ color: isMine ? "#4f46e5" : "#475569", fontSize: 13, fontWeight: "800", lineHeight: 18 }}>{userIds.length}</Text>
                                </TouchableOpacity>
                              )
                            })}
                            <TouchableOpacity
                              onPress={() => openReactionPicker(exp)}
                              style={{
                                minWidth: 34, minHeight: 34,
                                backgroundColor: "#f8fafc",
                                borderRadius: 17,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderWidth: 1,
                                borderColor: "#e2e8f0",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Text style={{ color: "#334155", fontSize: 16, lineHeight: 20, fontWeight: "800" }}>+</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  </View>
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
              <EmptyState icon="checkmark-done-outline" title="All settled up" subtitle="Nobody in this group owes anybody." />
            )
          }

          return (
            <View style={{ paddingTop: 12, gap: 24, paddingBottom: 8 }}>
              {/* Smart Debts banner */}
              {smartDebtsEnabled && (
                <View style={{ backgroundColor: "rgba(99,102,241,0.12)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.35)", paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 16 }}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#a5b4fc", fontWeight: "700", fontSize: 13 }}>Smart Debts Enabled</Text>
                    <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 1 }}>Showing minimum transactions to settle all debts</Text>
                  </View>
                </View>
              )}
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
                                    {(isMe || d.otherId === user?.id || isAdmin) && (
                                      <View style={{ flexDirection: "row", gap: 6 }}>
                                        <TouchableOpacity
                                          onPress={() => {
                                            const fromId = d.dir === "owes" ? m.userId : d.otherId
                                            const toId = d.dir === "owes" ? d.otherId : m.userId
                                            const fromName = d.dir === "owes" ? name : otherName
                                            const toName = d.dir === "owes" ? otherName : name
                                            const items = expenses
                                              .filter((exp: any) => (exp.currency ?? gc.code) === currency)
                                              .flatMap((exp: any) => {
                                                const fromSplit = exp.splits?.find((s: any) => s.userId === fromId)
                                                const toSplit = exp.splits?.find((s: any) => s.userId === toId)
                                                if (exp.paidById === toId && fromSplit && fromSplit.amount > 0) {
                                                  return [{ description: exp.description, amount: fromSplit.amount, date: exp.date ?? exp.createdAt, isCredit: false }]
                                                }
                                                if (exp.paidById === fromId && toSplit && toSplit.amount > 0) {
                                                  return [{ description: exp.description, amount: toSplit.amount, date: exp.date ?? exp.createdAt, isCredit: true }]
                                                }
                                                return []
                                              })
                                              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            openBalanceSummary({ fromName, toName, amount: displayAmt, currency, symbol: dispCi.symbol, items })
                                          }}
                                          style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
                                        >
                                          <Text style={{ color: "#a5b4fc", fontWeight: "600", fontSize: 11 }}>Summary</Text>
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

                                  {(isMe || d.otherId === user?.id || isAdmin) && isInlineSettle && (
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
                                            if (!isOnline) {
                                              Toast.show({ type: "error", text1: "No connection", text2: "Settle requires internet" })
                                              return
                                            }
                                            if (inlineSettling) return
                                            const amt = parseAmountInput(inlineSettleAmount)
                                            if (!amt || amt <= 0) return
                                            setInlineSettling(true)
                                            // Amounts shown may be FX-converted — always settle in the section's own currency
                                            const capped = Math.min(amt, d.amount)
                                            const payerId = d.dir === "owes" ? m.userId : d.otherId
                                            const receiverId = d.dir === "owes" ? d.otherId : m.userId
                                            balancesApi.settle(id, { fromUserId: payerId, toUserId: receiverId, amount: capped, currency })
                                              .then(() => {
                                                queryClient.invalidateQueries({ queryKey: ["group", id] })
                                                queryClient.invalidateQueries({ queryKey: ["balances", id] })
                                                queryClient.invalidateQueries({ queryKey: ["groups"] })
                                                queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
                                                queryClient.invalidateQueries({ queryKey: ["activity"] })
                                                setInlineSettleKey(null)
                                                setInlineSettleAmount("")
                                                if (amt >= d.amount) { haptic.success(); setCelebrate(true) }
                                                else { haptic.success(); Toast.show({ type: "success", text1: "Partial payment recorded" }) }
                                              })
                                              .catch((e: any) => { haptic.error(); Toast.show({ type: "error", text1: e?.response?.data?.error ?? "Failed to record settlement" }) })
                                              .finally(() => setInlineSettling(false))
                                          }}
                                          disabled={inlineSettling}
                                          style={{ backgroundColor: "#6366f1", borderRadius: 10, paddingHorizontal: 14, height: 40, alignItems: "center", justifyContent: "center", opacity: inlineSettling ? 0.6 : 1 }}
                                        >
                                          {inlineSettling
                                            ? <ActivityIndicator color="#fff" size="small" />
                                            : <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>Confirm</Text>}
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
          const missingRates = currencyOrder.slice(1).filter(c => !fxRates[c])
          // After the fetch attempt has finished, show what we can instead of spinning forever
          const ratesLoaded = !isMultiCurrency || missingRates.length === 0 || fxAttempted

          // Per-member share — convert all currencies to default gc before summing
          const memberShareMap: Record<string, number> = {}
          for (const m of members) memberShareMap[m.userId] = 0
          for (const e of expenses) {
            const expCur = e.currency ?? gc.code
            const rate = expCur === gc.code ? 1 : (fxRates[expCur] ?? null)
            if (rate === null) continue // skip until rate is loaded
            for (const s of (e.splits ?? [])) {
              if (memberShareMap[s.userId] !== undefined) memberShareMap[s.userId] += s.amount * rate
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
                  {ratesLoaded && missingRates.length > 0 && (
                    <Text style={{ color: "#f59e0b", fontSize: 10, marginTop: 4 }}>
                      Excludes {missingRates.join(", ")} (exchange rate unavailable)
                    </Text>
                  )}
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

              {/* Charts — only render once all rates are loaded to avoid segAnims ref length mismatch */}
              {!ratesLoaded ? (
                <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 32, alignItems: "center" }}>
                  <ActivityIndicator color="#6366f1" />
                  <Text style={{ color: C.textSub, fontSize: 13, marginTop: 8 }}>Loading exchange rates…</Text>
                </View>
              ) : (
                <>
                  {/* Pie chart */}
                  {pieData.length > 0 && (
                    <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: "center" }}>
                      <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 20 }}>Expense Distribution</Text>
                      <AnimatedPieChart key={pieData.length} data={pieData} size={240} symbol={gc.symbol} code={gc.code} />
                      {/* Legend */}
                      <View style={{ width: "100%", marginTop: 20, gap: 10 }}>
                        {pieData.map((d, i) => (
                          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: d.color }} />
                            <Text style={{ flex: 1, color: C.textSub, fontSize: 13 }}>{d.name}</Text>
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
                    const paidMap: Record<string, number> = {}
                    for (const m of members) paidMap[m.userId] = 0
                    for (const e of expenses) {
                      const expCur = e.currency ?? gc.code
                      const rate = expCur === gc.code ? 1 : (fxRates[expCur] ?? null)
                      if (rate === null) continue
                      if (paidMap[e.paidById] !== undefined) paidMap[e.paidById] += e.amount * rate
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
                    return <BarChart data={barData} maxAmt={barData[0].amount} barHeight={140} symbol={gc.symbol} code={gc.code} />
                  })()}
                </>
              )}
            </View>
          )
        })()}

        {/* Utility Tab */}
        {tab === "utility" && (
          <View className="py-3 gap-3">
            {/* Who should pay next */}
            {nextPayer && (
              <View style={{ backgroundColor: "rgba(99,102,241,0.1)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="trending-down-outline" size={22} color={tokens.accentText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#a5b4fc", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 }}>PAY NEXT TO REDUCE DEBT</Text>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: "700" }}>
                    {nextPayer.member.userId === user?.id ? "You" : (nextPayer.member.user?.name ?? "Someone")}
                  </Text>
                  <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
                    {nextPayer.member.userId === user?.id ? "owe" : "owes"} {formatCurrency(nextPayer.amountOwed, gc.symbol, gc.code)} overall
                  </Text>
                </View>
                <View style={{ alignItems: "center", backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, padding: 8 }}>
                  <Text style={{ color: "#a5b4fc", fontSize: 10, fontWeight: "600" }}>should</Text>
                  <Text style={{ color: "#a5b4fc", fontSize: 10, fontWeight: "600" }}>pay next</Text>
                </View>
              </View>
            )}
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
                  const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
                  const sym = (code: string) => CURRENCIES.find((c) => c.code === code)?.symbol ?? `${code} `
                  // Totals are kept per currency — mixed-currency groups must not be summed together
                  const totals: Record<string, number> = {}
                  const shares: Record<string, number> = {}
                  for (const e of expenses) {
                    const cur = e.currency ?? gc.code
                    totals[cur] = (totals[cur] ?? 0) + e.amount
                    const sp = e.splits?.find((x: any) => x.userId === user?.id)
                    shares[cur] = (shares[cur] ?? 0) + (sp?.amount ?? 0)
                  }
                  const fmtTotals = (m: Record<string, number>) =>
                    Object.entries(m).map(([c, v]) => `${sym(c)}${v.toFixed(2)}`).join("<br/>") || `${gc.symbol}0.00`
                  const rows = expenses.map((e: any) => `
                    <tr>
                      <td>${new Date(e.date ?? e.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td>${esc(e.description)}</td>
                      <td>${esc(e.paidBy?.name ?? "?")}</td>
                      <td style="text-align:right;font-weight:600">${sym(e.currency ?? gc.code)}${e.amount.toFixed(2)}</td>
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
                    <h1>${esc(group?.emoji ?? "")} ${esc(group?.name ?? "Group")} — Statement</h1>
                    <div class="subtitle">Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>
                    <div class="summary">
                      <div class="card"><div class="card-label">Total Group Expense</div><div class="card-value">${fmtTotals(totals)}</div></div>
                      <div class="card"><div class="card-label">Your Share</div><div class="card-value" style="color:#6366f1">${fmtTotals(shares)}</div></div>
                    </div>
                    <table>
                      <thead><tr><th>Date</th><th>Expense</th><th>Paid By</th><th style="text-align:right">Amount</th></tr></thead>
                      <tbody>${rows}</tbody>
                    </table>
                    <div class="footer">SplitIT • Amounts shown in each expense's own currency</div>
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

            {/* Smart Debts */}
            <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: smartDebtsEnabled ? "rgba(99,102,241,0.4)" : C.border, padding: 18, gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: smartDebtsEnabled ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 22 }}>⚡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Smart Debts</Text>
                    {smartDebtsEnabled && (
                      <View style={{ backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: "#a5b4fc", fontSize: 10, fontWeight: "700" }}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>
                    {smartDebtsEnabled ? "Minimising transactions in Balances tab" : "Reduce the number of payments needed"}
                  </Text>
                </View>
              </View>
              {!isAdmin ? (
                <Text style={{ color: C.textMuted, fontSize: 12, textAlign: "center" }}>Only group admins can change Smart Debts</Text>
              ) : smartDebtsEnabled ? (
                <TouchableOpacity
                  onPress={async () => {
                    setSmartDebtsLoading(true)
                    try {
                      await balancesApi.toggleSmartDebts(id, false)
                      queryClient.invalidateQueries({ queryKey: ["balances", id] })
                      queryClient.invalidateQueries({ queryKey: ["activity"] })
                      haptic.success()
                      Toast.show({ type: "success", text1: "Smart Debts disabled" })
                    } catch {
                      Toast.show({ type: "error", text1: "Failed to disable Smart Debts" })
                    } finally {
                      setSmartDebtsLoading(false)
                    }
                  }}
                  disabled={smartDebtsLoading}
                  style={{ backgroundColor: "rgba(244,63,94,0.1)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(244,63,94,0.25)", paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  {smartDebtsLoading ? <ActivityIndicator color="#f87171" size="small" /> : (
                    <>
                      <Ionicons name="flash-off-outline" size={18} color="#f87171" />
                      <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 14 }}>Disable Smart Debts</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowSmartDebtsModal(true)}
                  disabled={smartDebtsLoading}
                  style={{ backgroundColor: "#6366f1", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  <Ionicons name="flash-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Enable Smart Debts</Text>
                </TouchableOpacity>
              )}
            </View>

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

      {/* Expense Emoji Reaction Picker — floating */}
      <FloatingContextMenu
        visible={!!reactionPickerState}
        anchor={reactionPickerState?.anchor ?? null}
        emojis={QUICK_REACTION_EMOJIS}
        reactedEmojis={(reactionPickerExp?.reactions ?? []).filter((r: any) => r.userId === user?.id).map((r: any) => r.emoji)}
        onEmojiPress={(emoji) => reactionPickerExp && toggleReaction(reactionPickerExp.id, emoji)}
        onMoreEmoji={() => setExpenseEmojiPickerOpen(true)}
        onDismiss={() => { setReactionPickerState(null); setExpenseEmojiPickerOpen(false) }}
      />

      {/* Full emoji picker for expenses */}
      <EmojiKeyboard
        onEmojiSelected={(e) => {
          if (reactionPickerState?.exp) toggleReaction(reactionPickerState.exp.id, e.emoji)
        }}
        open={expenseEmojiPickerOpen}
        onClose={() => setExpenseEmojiPickerOpen(false)}
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

      {/* Smart Debts Confirmation Modal */}
      <Modal visible={showSmartDebtsModal} transparent animationType="fade" onRequestClose={() => setShowSmartDebtsModal(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Text style={{ fontSize: 28 }}>⚡</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 6 }}>Enable Smart Debts?</Text>
            <Text style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 16, lineHeight: 19 }}>
              Minimises the number of payments needed to settle all debts in this group.
            </Text>
            {/* Example box */}
            <View style={{ backgroundColor: C.iconBg, borderRadius: 14, padding: 14, marginBottom: 20, gap: 6 }}>
              <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 }}>EXAMPLE</Text>
              <View style={{ gap: 4 }}>
                <Text style={{ color: "#f87171", fontSize: 12 }}>❌  A → B ₹100  &  B → C ₹100  (2 payments)</Text>
                <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
                <Text style={{ color: "#4ade80", fontSize: 12 }}>✅  A → C ₹100  (1 payment, B eliminated)</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowSmartDebtsModal(false)}
                style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.borderStrong, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setShowSmartDebtsModal(false)
                  setSmartDebtsLoading(true)
                  try {
                    await balancesApi.toggleSmartDebts(id, true)
                    queryClient.invalidateQueries({ queryKey: ["balances", id] })
                    queryClient.invalidateQueries({ queryKey: ["activity"] })
                    haptic.success()
                    Toast.show({ type: "success", text1: "Smart Debts enabled" })
                  } catch {
                    Toast.show({ type: "error", text1: "Failed to enable Smart Debts" })
                  } finally {
                    setSmartDebtsLoading(false)
                  }
                }}
                style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Enable</Text>
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
      <InAppFullScreenModal visible={showNotes} onRequestClose={() => setShowNotes(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>Group Notes</Text>
            <TouchableOpacity onPress={() => setShowNotes(false)} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color={C.text} />
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
      </InAppFullScreenModal>

      {/* Add Expense Modal */}
      <InAppFullScreenModal visible={showAddExpense} onRequestClose={() => setShowAddExpense(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingHorizontal: 20 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Add Expense</Text>
            <TouchableOpacity onPress={() => { setShowAddExpense(false); resetAddForm() }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color={C.text} />
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
                if (!expDesc.trim() || !expAmount || isNaN(parseAmountInput(expAmount)) || addExpenseMutation.isPending) return true
                const numAmt = parseAmountInput(expAmount)
                const memberIds = members.map((m: any) => m.userId)
                if (splitType === "PERCENTAGE") {
                  const pctTotal = memberIds.reduce((s: number, uid: string) => s + (parseAmountInput(percentageSplits[uid] || "0")), 0)
                  if (Math.abs(pctTotal - 100) > 0.01) return true
                }
                if (splitType === "CUSTOM") {
                  const customTotal = memberIds.reduce((s: number, uid: string) => s + (parseAmountInput(customSplits[uid] || "0")), 0)
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
      </InAppFullScreenModal>

      {/* Edit Expense Modal */}
      <InAppFullScreenModal visible={showEditExpense} onRequestClose={() => setShowEditExpense(false)}>
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
                <Ionicons name="close" size={18} color={C.text} />
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
            {(() => {
              const orig = editOriginal.current
              const splitChanged = !orig ? false : (
                splitType !== orig.splitType ||
                JSON.stringify([...equallyIncluded].sort()) !== JSON.stringify([...orig.equallyIncluded].sort()) ||
                JSON.stringify(percentageSplits) !== JSON.stringify(orig.percentageSplits) ||
                JSON.stringify(customSplits) !== JSON.stringify(orig.customSplits)
              )
              const isDirty = !orig ? false : (
                editDesc.trim() !== orig.desc.trim() ||
                editAmount !== orig.amount ||
                editCurrency !== orig.currency ||
                editCategory !== orig.category ||
                editPaidBy !== orig.paidBy ||
                toLocalDateKey(editDate) !== toLocalDateKey(new Date(orig.date)) ||
                splitChanged
              )
              const canSave = isDirty && !!editDesc.trim() && !!editAmount && !isNaN(parseAmountInput(editAmount)) && !editExpenseMutation.isPending
              return (
                <TouchableOpacity
                  onPress={() => editExpenseMutation.mutate()}
                  disabled={!canSave}
                  style={{ backgroundColor: canSave ? "#6366f1" : "#374151", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center", opacity: canSave ? 1 : 0.5 }}
                >
                  {editExpenseMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Save Changes</Text>}
                </TouchableOpacity>
              )
            })()}
          </View>
        </View>
      </InAppFullScreenModal>

      {/* Add Member Modal — Friends Picker */}
      <InAppFullScreenModal visible={showAddMember} onRequestClose={() => { setShowAddMember(false); setFriendSearch("") }}>
        <View style={{ height: windowH, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Add to {group?.name}</Text>
            <TouchableOpacity onPress={() => { setShowAddMember(false); setFriendSearch("") }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color={C.text} />
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
      </InAppFullScreenModal>

      {/* Floating add button — the one primary action on this screen */}
      {(tab === "expenses" || tab === "balances" || tab === "analytics") && (
        <TouchableOpacity
          onPress={() => { haptic.tap(); resetAddForm(); setShowAddExpense(true) }}
          activeOpacity={0.85}
          accessibilityLabel="Add expense"
          style={{
            position: "absolute", right: 20, bottom: 62 + insets.bottom + 18,
            height: 56, paddingHorizontal: 20, borderRadius: 28, backgroundColor: tokens.accent,
            flexDirection: "row", alignItems: "center", gap: 8,
            shadowColor: tokens.accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Add expense</Text>
        </TouchableOpacity>
      )}

      <Celebration visible={celebrate} onDone={() => setCelebrate(false)} />
      <BottomTabBar activeTab="groups" />
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
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled={true}>
      {/* Amount first — big and centred, currency as a small chip above it */}
      <View style={{ alignItems: "center", paddingTop: 6, paddingBottom: 18 }}>
        <TouchableOpacity
          onPress={() => setShowCurrencyPicker(true)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: activeCurrencyCode !== gc.code ? tokens.accentSoft : C.iconBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 }}
          accessibilityLabel="Change currency"
        >
          <Text style={{ fontSize: 14 }}>{(activeCurrencyInfo as any).flag ?? ""}</Text>
          <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "700" }}>{activeCurrencyCode}</Text>
          <Ionicons name="chevron-down" size={12} color={C.textMuted} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: amount ? C.text : C.textMuted, fontSize: 40, fontWeight: "800", marginRight: 2 }}>{activeCurrencyInfo.symbol}</Text>
          <TextInput
            style={{ color: C.text, fontSize: 44, fontWeight: "800", minWidth: 60, textAlign: "center", fontVariant: ["tabular-nums"], paddingVertical: 0 }}
            placeholder="0"
            placeholderTextColor={C.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount"
          />
        </View>
      </View>

      {/* Description */}
      <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>What was it for?</Text>
      <View style={{ backgroundColor: C.card, borderRadius: tokens.radius.md, paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: desc.trim() ? 8 : 16, flexDirection: "row", alignItems: "center" }}>
        <TextInput
          style={{ color: C.text, fontSize: 15, flex: 1 }}
          placeholder="e.g. Dinner, cab, hotel"
          placeholderTextColor={C.textMuted}
          value={desc}
          onChangeText={(t) => { setDesc(t); setCategory(guessCategory(t)) }}
        />
      </View>
      {desc.trim() ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <Text style={{ fontSize: 16 }}>{categoryEmoji}</Text>
          <Text style={{ color: C.textMuted, fontSize: 12, textTransform: "capitalize" }}>{detectedCategory}</Text>
        </View>
      ) : null}

      {/* Currency picker modal (inline within form fields component) */}
      <InAppFullScreenModal visible={showCurrencyPicker} onRequestClose={() => { setShowCurrencyPicker(false); setCurrencySearch("") }}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Expense Currency</Text>
            <TouchableOpacity onPress={() => { setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color={C.text} />
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
      </InAppFullScreenModal>

      {/* Date */}
      <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Date</Text>
      <TouchableOpacity
        onPress={() => openDatePicker(date, setDate)}
        style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <Ionicons name="calendar-outline" size={18} color={C.textSub} />
        <Text style={{ color: C.text, fontSize: 15 }}>{formatDate(date)}</Text>
      </TouchableOpacity>

      {/* Paid by */}
      <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Paid by</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        {members.map((m: any) => (
          <TouchableOpacity
            key={m.userId}
            onPress={() => setPaidBy(m.userId)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: paidBy === m.userId ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", borderRadius: 12, borderWidth: paidBy === m.userId ? 2 : 1, borderColor: paidBy === m.userId ? "#6366f1" : "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}
          >
            <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={24} />
            <Text style={{ color: paidBy === m.userId ? "#fff" : C.textSub, fontWeight: "600", fontSize: 13 }}>
              {m.userId === user?.id ? "You" : m.user?.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Split section ── */}
      {(() => {
        const numAmount = parseAmountInput(amount) || 0
        const disabled = numAmount <= 0
        const memberIds = members.map((m: any) => m.userId)
        const included = equallyIncluded.length > 0 ? equallyIncluded : memberIds

        const pctTotal = memberIds.reduce((s: number, uid: string) => s + (parseAmountInput(percentageSplits[uid] || "0")), 0)
        const customTotal = memberIds.reduce((s: number, uid: string) => s + (parseAmountInput(customSplits[uid] || "0")), 0)
        const pctError = splitType === "PERCENTAGE" && numAmount > 0 && Math.abs(pctTotal - 100) > 0.01 ? `${pctTotal.toFixed(1)}% of 100%` : null
        const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrencyCode)
        const fmt = (n: number) => isNoDec ? Math.round(n).toString() : n.toFixed(2)
        const customError = splitType === "CUSTOM" && numAmount > 0 && Math.abs(customTotal - numAmount) > (isNoDec ? 0.5 : 0.01) ? `Total ${activeCurrencyInfo.symbol}${fmt(customTotal)} must equal ${activeCurrencyInfo.symbol}${fmt(numAmount)}` : null

        return (
          <View style={{ marginTop: 4, marginBottom: 8 }}>
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              Split{disabled ? <Text style={{ color: C.textMuted, fontWeight: "500" }}>  ·  enter an amount first</Text> : null}
            </Text>

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
                  const pctNum = parseAmountInput(pct) || 0
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

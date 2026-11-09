import { useState, useEffect, useRef } from "react"
import { useKeyboard } from "@/lib/useKeyboard"
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"
import { GroupAvatar } from "@/components/GroupAvatar"
import { View, ScrollView, TouchableOpacity, Modal, ActivityIndicator, FlatList, Platform, useWindowDimensions, Animated, Pressable, BackHandler, StyleSheet, StatusBar, RefreshControl } from "react-native"
import { Text, TextInput } from "@/components/ui/Typography"
import FloatingContextMenu, { MenuAnchor } from "@/components/ui/FloatingContextMenu"
import { InAppFullScreenModal } from "@/components/ui/InAppModal"
import { subscribeChannel } from "@/lib/pusher"
import * as ExpoCrypto from "expo-crypto"
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { InsightsTab } from "@/components/group/InsightsTab"
import { ExpenseFilterPopup } from "@/components/group/ExpenseFilterPopup"
import { MembersPopup } from "@/components/group/MembersPopup"
import { AddMemberSheet } from "@/components/group/AddMemberSheet"
import { ExpenseSheet, type ExpensePayload } from "@/components/group/ExpenseSheet"
import { useLocalSearchParams, router } from "expo-router"
import { usePlus } from "@/lib/plus"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { groupsApi, expensesApi, balancesApi, membersApi, friendsApi, reactionsApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { formatCurrency, formatDate, guessCategory, parseAmountInput, toLocalDateKey } from "@/lib/utils"
import { getExpenseIcon } from "@/lib/expense-icons"
import { ExpenseIcon } from "@/components/ExpenseIcon"
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
import { QueryError } from "@/components/ui/QueryError"
import { haptic } from "@/lib/haptics"
import { useOffline } from "@/context/OfflineContext"
import { BottomTabBar } from "@/components/ui/BottomTabBar"
import { getRate } from "@/lib/exchange"
type Tab = "expenses" | "balances" | "analytics" | "utility"

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { locked: chatLocked } = usePlus() // group chat is a Plus feature
  const insets = useSafeAreaInsets()
  const { height: windowH, width: windowW } = useWindowDimensions()
  const { user } = useAuthStore()
  const C = useTheme()
  const queryClient = useQueryClient()
  const { isOnline, enqueueExpense } = useOffline()
  const [tab, setTab] = useState<Tab>("expenses")
  const [showMembers, setShowMembers] = useState(false) // members popup over the current tab
  // Expenses filter: by who paid and by day
  const [filterMembers, setFilterMembers] = useState<string[]>([])
  const [filterDays, setFilterDays] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterPane, setFilterPane] = useState<"member" | "date">("member")
  const [filterAnchor, setFilterAnchor] = useState<{ top: number; right: number } | null>(null)
  const filterBtnRef = useRef<View>(null)
  const filterCount = filterMembers.length + filterDays.length
  const openFilter = () => {
    filterBtnRef.current?.measureInWindow((x, y, w, h) => {
      // Android's measureInWindow is relative to the area below the status bar; the modal isn't
      const statusBar = Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0
      setFilterAnchor({ top: y + h + 6 + statusBar, right: Math.max(12, windowW - (x + w)) })
      setFilterOpen(true)
    })
  }
  useEffect(() => {
    if (!showMembers) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setShowMembers(false); return true })
    return () => sub.remove()
  }, [showMembers])
  // Each tab/panel starts at the top — otherwise switching kept the previous scroll offset
  const scrollRef = useRef<ScrollView>(null)
  // Keep the inline settle-up amount field above the keyboard
  const scrollYRef = useRef(0)
  const settleInputRef = useRef<any>(null)
  const kbTopRef = useRef(0)
  const revealSettleInput = () => {
    const input = settleInputRef.current
    if (!input || !kbTopRef.current) return
    input.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const overlap = y + h + 100 - kbTopRef.current // 100 leaves room for the hint line below
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollYRef.current + overlap, animated: true })
    })
  }
  const { height: kbHeight, top: kbTop } = useKeyboard({ onShow: revealSettleInput })
  kbTopRef.current = kbTop
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }) }, [tab])

  // Add / Edit expense sheets — the form state lives inside ExpenseSheet
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showEditExpense, setShowEditExpense] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)

  const [showAddMember, setShowAddMember] = useState(false)

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

  const { data: group, isLoading, isError: groupError, refetch: refetchGroup, isFetching: groupFetching } = useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["group", id] }),
      queryClient.invalidateQueries({ queryKey: ["balances", id] }),
    ])
    setRefreshing(false)
  }

  // Real-time reaction updates via Pusher
  useEffect(() => {
    if (!user?.id || !id) return
    const { channel, release } = subscribeChannel(`private-user-${user.id}`)
    const onReaction = (data: { groupId: string }) => {
      if (data.groupId === id) queryClient.invalidateQueries({ queryKey: ["group", id] })
    }
    channel.bind("expense-reaction", onReaction)
    return () => { channel.unbind("expense-reaction", onReaction); release() } // channel is shared: only drop our handler
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
    mutationFn: async (form: ExpensePayload) => {
      // Same id for the online attempt and any offline retry → the server dedupes it
      const clientRequestId = ExpoCrypto.randomUUID()
      const payload = { clientRequestId, ...form }
      if (!isOnline) {
        await enqueueExpense({ id: clientRequestId, groupId: id, createdAt: Date.now(), payload })
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
    mutationFn: (form: ExpensePayload) => expensesApi.update(id, editTarget.id, form),
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

  function confirmRemoveMember(m: any) {
    showConfirm({
      title: "Remove Member",
      message: `Remove ${m.user?.name} from this group?`,
      confirmText: "Remove",
      danger: true,
      onConfirm: () => removeMemberMutation.mutate(m.userId),
    })
  }

  function confirmToggleAdmin(m: any) {
    const isMemberAdmin = m.role === "ADMIN"
    showConfirm({
      title: isMemberAdmin ? "Remove Admin" : "Make Admin",
      message: isMemberAdmin
        ? `Remove admin rights from ${m.user?.name}?`
        : `Make ${m.user?.name} an admin of this group?`,
      confirmText: isMemberAdmin ? "Remove Admin" : "Make Admin",
      danger: false,
      onConfirm: () => makeAdminMutation.mutate({ userId: m.userId, role: isMemberAdmin ? "MEMBER" : "ADMIN" }),
    })
  }

  function addFriendToGroup(other: any) {
    addMemberMutation.mutate(other.email, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["group", id] })
        queryClient.invalidateQueries({ queryKey: ["friends"] })
        Toast.show({ type: "success", text1: `${other.name} added!` })
      },
      onError: (err: any) => {
        Toast.show({ type: "error", text1: err?.response?.data?.error ?? "Failed to add member" })
      },
    })
  }

  // Friends list for picker
  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: () => friendsApi.list().then((r) => (r.data && typeof r.data === "object" ? r.data : {})),
  })
  const allFriends: any[] = (friendsData as any)?.friends ?? []

  function openEditGroup() {
    router.push(`/group/${id}/edit` as any)
  }

  function openEdit(exp: any) {
    setEditTarget(exp)
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

  if (!group && groupError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }} edges={["top"]}>
        <QueryError title="Couldn't load this group" onRetry={() => refetchGroup()} retrying={groupFetching} />
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

  const dayKey = (e: any) => new Date(e.date ?? e.createdAt).toDateString()
  const dayLabel = (e: any) => {
    const d = new Date(e.date ?? e.createdAt)
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" })
  }
  const sortedExpenses = expenses.slice().sort((a: any, b: any) => {
    const dateDiff = new Date(b.date ?? b.createdAt).getTime() - new Date(a.date ?? a.createdAt).getTime()
    if (dateDiff !== 0) return dateDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  const filteredExpenses = sortedExpenses.filter((e: any) =>
    (filterMembers.length === 0 || filterMembers.includes(e.paidById)) &&
    (filterDays.length === 0 || filterDays.includes(dayKey(e))))
  // Distinct days for the date filter, newest first
  const expenseDays: { key: string; label: string; count: number }[] = []
  for (const e of sortedExpenses) {
    const k = dayKey(e)
    const last = expenseDays[expenseDays.length - 1]
    if (last?.key === k) last.count++
    else expenseDays.push({ key: k, label: dayLabel(e), count: 1 })
  }
  const toggleIn = (list: string[], v: string) => list.includes(v) ? list.filter((x) => x !== v) : [...list, v]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: C.iconBg, borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={18} color={C.text} />
          </TouchableOpacity>
          {/* Tap the picture or name to edit the group */}
          <TouchableOpacity
            onPress={() => { haptic.tap(); openEditGroup() }}
            activeOpacity={0.7}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
            accessibilityLabel="Edit group"
          >
            <GroupAvatar emoji={group?.emoji} imageUrl={group?.imageUrl} color={group?.color ?? tokens.accent} size={42} radius={13} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 19, fontWeight: "800" }} numberOfLines={1}>{group?.name}</Text>
              <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
                {members.length} member{members.length === 1 ? "" : "s"} · {gc.code}{group?.description ? ` · ${group.description}` : ""}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { haptic.tap(); setShowMembers(true) }}
            style={{ backgroundColor: C.iconBg, borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="Members"
          >
            <Ionicons name="people-outline" size={18} color={C.text} />
          </TouchableOpacity>
          {/* This group's chat (SplitIT Plus) */}
          <TouchableOpacity
            onPress={() => { haptic.tap(); router.push({ pathname: "/group-chat/[groupId]", params: { groupId: id, name: group?.name ?? "" } } as any) }}
            style={{ backgroundColor: chatLocked ? C.iconBg : "rgba(34,197,94,0.15)", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel={chatLocked ? "Group chat (SplitIT Plus)" : "Group chat"}
          >
            <Ionicons name="chatbubbles" size={17} color={chatLocked ? C.textMuted : C.positive} />
            {chatLocked ? (
              <View style={{ position: "absolute", right: -3, top: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="lock-closed" size={9} color={C.accentText} />
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Your balance + Add expense, side by side */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        {/* Your balance — neutral card; each currency in words, only the amount carries colour */}
        <View style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.lg, paddingHorizontal: 16, paddingVertical: 14 }}>
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
                    <Money amount={net} symbol={ci.symbol} code={ci.code} size={22} color={net > 0 ? C.positive : C.negative} />
                  </View>
                )
              })}
            </View>
          )}
        </View>
          <TouchableOpacity
            onPress={() => { haptic.tap(); setShowAddExpense(true) }}
            activeOpacity={0.85}
            accessibilityLabel="Add expense"
            style={{ width: 84, backgroundColor: tokens.accent, borderRadius: tokens.radius.lg, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 }}
          >
            <Ionicons name="add" size={26} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 16 }}>{"Add\nexpense"}</Text>
          </TouchableOpacity>
        </View>

          <View style={{ flexDirection: "row", backgroundColor: C.iconBg, borderRadius: 12, padding: 3, gap: 4 }}>
            {([["expenses", "Expenses"], ["balances", "Balances"], ["analytics", "Insights"], ["utility", "Utility"]] as [Tab, string][]).map(([t, label]) => (
              <TouchableOpacity
                key={t}
                onPress={() => { haptic.tap(); setTab(t) }}
                style={{ flex: 1, backgroundColor: tab === t ? tokens.accent : "transparent", borderRadius: 10, paddingVertical: 8, alignItems: "center" }}
              >
                <Text style={{ color: tab === t ? "#fff" : C.textSub, fontWeight: "600", fontSize: 13 }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
      </View>

      {/* Tracking Banner */}
      {isTracking && (
        <View style={{ backgroundColor: "rgba(99,102,241,0.12)", borderBottomWidth: 1, borderBottomColor: "rgba(99,102,241,0.2)", paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={{ color: C.accentText, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
            📡 Tracking expenses{trackConfig?.expiresAt ? ` · ends ${formatDate(new Date(trackConfig.expiresAt))}` : ""}
          </Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingBottom: 24 + kbHeight }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y }}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.accent} />}
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
              onAction={() => { setShowAddExpense(true) }}
            />
          ) : (
            <View style={{ gap: 8, paddingVertical: 12 }}>
              {(() => {
                const first = filteredExpenses[0]
                return (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "600" }}>
                      {first ? dayLabel(first) : "No matching expenses"}
                    </Text>
                    <TouchableOpacity
                      ref={filterBtnRef as any}
                      onPress={() => { haptic.tap(); openFilter() }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: filterCount ? tokens.accent : C.iconBg, borderRadius: 10, paddingHorizontal: 10, height: 30 }}
                      accessibilityLabel="Filter expenses"
                    >
                      <Ionicons name="filter" size={15} color={filterCount ? "#fff" : C.text} />
                      {filterCount > 0 && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{filterCount}</Text>}
                    </TouchableOpacity>
                  </View>
                )
              })()}
              {filteredExpenses.length === 0 && (
                <TouchableOpacity onPress={() => { setFilterMembers([]); setFilterDays([]) }} style={{ alignItems: "center", paddingVertical: 30 }}>
                  <Text style={{ color: C.textSub, fontSize: 13 }}>No expenses match these filters.</Text>
                  <Text style={{ color: C.accentText, fontSize: 13, fontWeight: "700", marginTop: 6 }}>Clear filters</Text>
                </TouchableOpacity>
              )}
              {filteredExpenses.map((exp: any, idx: number, sortedList: any[]) => {
                const showDay = idx > 0 && dayKey(sortedList[idx - 1]) !== dayKey(exp)
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
                    <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "600", marginTop: 10, marginBottom: 6 }}>
                      {dayLabel(exp)}
                    </Text>
                  )}
                  <TouchableOpacity
                    ref={(r) => { expenseRefs.current[exp.id] = r }}
                    onPress={() => openEdit(exp)}
                    onLongPress={() => openReactionPicker(exp)}
                    delayLongPress={350}
                    activeOpacity={0.75}
                    style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.lg, padding: 14, gap: 10 }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <ExpenseIcon description={exp.description} />
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
                            <Text style={{ color: myAmount > 0 ? C.positive : C.negative, fontWeight: "700", fontSize: 15, fontVariant: ["tabular-nums"] }}>
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
                    <Text style={{ color: C.accentText, fontWeight: "700", fontSize: 13 }}>Smart Debts Enabled</Text>
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
                            <Text style={{ color: C.accentText, fontSize: 9, fontWeight: "700" }}>DEFAULT</Text>
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
                            <Text style={{ color: isConverted ? C.accentText : "#34d399", fontWeight: "700", fontSize: 11 }}>
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
                        const netColor = net > 0 ? C.positive : net < 0 ? C.negative : "#64748b"
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
                                <View key={di} style={{ borderTopWidth: 1, borderTopColor: C.border }}>
                                  <View style={{ paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
                                    <Avatar name={d.otherUser?.name} email={d.otherUser?.email} image={d.otherUser?.image} size={28} />
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ color: C.textSub, fontSize: 12 }}>
                                        {d.dir === "owes"
                                          ? `${isMe ? "You owe" : `${name} owes`} ${otherName}`
                                          : `${otherName} owes ${isMe ? "you" : name}`}
                                      </Text>
                                      <Text style={{ color: d.dir === "owes" ? C.negative : C.positive, fontWeight: "700", fontSize: 14 }}>
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
                                          <Text style={{ color: C.accentText, fontWeight: "600", fontSize: 11 }}>Summary</Text>
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
                                            ref={settleInputRef}
                                            onFocus={() => setTimeout(revealSettleInput, 300)}
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

        {/* Analytics Tab */}
        {tab === "analytics" && (
          <InsightsTab expenses={expenses} members={members} userId={user?.id} gc={gc} fxRates={fxRates} fxAttempted={fxAttempted} />
        )}

        {/* Utility Tab */}
        {tab === "utility" && (
          <View style={{ gap: 12, paddingVertical: 12 }}>
            {/* Who should pay next */}
            {nextPayer && (
              <View style={{ backgroundColor: "rgba(99,102,241,0.1)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="trending-down-outline" size={22} color={C.accentText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.accentText, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2 }}>PAY NEXT TO REDUCE DEBT</Text>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: "700" }}>
                    {nextPayer.member.userId === user?.id ? "You" : (nextPayer.member.user?.name ?? "Someone")}
                  </Text>
                  <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
                    {nextPayer.member.userId === user?.id ? "owe" : "owes"} {formatCurrency(nextPayer.amountOwed, gc.symbol, gc.code)} overall
                  </Text>
                </View>
                <View style={{ alignItems: "center", backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, padding: 8 }}>
                  <Text style={{ color: C.accentText, fontSize: 10, fontWeight: "600" }}>should</Text>
                  <Text style={{ color: C.accentText, fontSize: 10, fontWeight: "600" }}>pay next</Text>
                </View>
              </View>
            )}
            {/* Write Notes */}
            <TouchableOpacity
              onPress={() => setShowNotes(true)}
              style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="document-text-outline" size={22} color={C.accentText} />
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
                        <Text style={{ color: C.accentText, fontSize: 10, fontWeight: "700" }}>ACTIVE</Text>
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
                  {smartDebtsLoading ? <ActivityIndicator color={C.negative} size="small" /> : (
                    <>
                      <Ionicons name="flash-off-outline" size={18} color={C.negative} />
                      <Text style={{ color: C.negative, fontWeight: "700", fontSize: 14 }}>Disable Smart Debts</Text>
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

            {/* Track Expense — Android only; iOS can't read payment notifications */}
            {Platform.OS === "android" && (
            <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: isTracking ? "rgba(99,102,241,0.4)" : C.border, padding: 18, gap: 14, opacity: otherGroupTracking ? 0.6 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isTracking ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={isTracking ? "radio" : "radio-outline"} size={22} color={otherGroupTracking ? C.textMuted : C.accentText} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Track Expense</Text>
                    {isTracking && (
                      <View style={{ backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                        <Text style={{ color: C.accentText, fontSize: 10, fontWeight: "700" }}>ACTIVE</Text>
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
                <TouchableOpacity accessibilityLabel="Stop tracking"
                  onPress={confirmStopTracking}
                  style={{ backgroundColor: "rgba(244,63,94,0.1)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(244,63,94,0.25)", paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  <Ionicons name="stop-circle-outline" size={18} color={C.negative} />
                  <Text style={{ color: C.negative, fontWeight: "700", fontSize: 14 }}>Stop Tracking</Text>
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
                <TouchableOpacity accessibilityLabel="Pick tracking end date"
                  onPress={openTrackDatePicker}
                  style={{ backgroundColor: "#6366f1", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                >
                  <Ionicons name="radio-outline" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Enable Tracking</Text>
                </TouchableOpacity>
              )}
            </View>
            )}
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

      <ExpenseFilterPopup
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        anchor={filterAnchor}
        pane={filterPane}
        onPane={setFilterPane}
        members={members}
        userId={user?.id}
        expenseDays={expenseDays}
        filterMembers={filterMembers}
        filterDays={filterDays}
        onToggleMember={(uid) => setFilterMembers(toggleIn(filterMembers, uid))}
        onToggleDay={(d) => setFilterDays(toggleIn(filterDays, d))}
        onClear={() => { setFilterMembers([]); setFilterDays([]) }}
        filterCount={filterCount}
      />

      {/* Custom Confirm Dialog */}
      <Modal visible={!!confirmDialog} transparent animationType="fade" onRequestClose={() => setConfirmDialog(null)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20 }}>
            {/* Icon — centered */}
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: confirmDialog?.danger ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name={confirmDialog?.danger ? "warning-outline" : "shield-outline"} size={26} color={confirmDialog?.danger ? C.negative : C.accentText} />
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
                <Text style={{ color: C.negative, fontSize: 12 }}>❌  A → B ₹100  &  B → C ₹100  (2 payments)</Text>
                <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
                <Text style={{ color: C.positive, fontSize: 12 }}>✅  A → C ₹100  (1 payment, B eliminated)</Text>
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
              <Ionicons name="radio" size={26} color={C.accentText} />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>Enable Expense Tracking</Text>
            <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>Auto-detect debit SMS for this group. Pick an end date to begin.</Text>
            <TouchableOpacity accessibilityLabel="Pick end date"
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

      <ExpenseSheet
        mode="add"
        visible={showAddExpense}
        onClose={() => setShowAddExpense(false)}
        members={members}
        gc={gc}
        user={user}
        isPending={addExpenseMutation.isPending}
        onSubmit={(payload) => addExpenseMutation.mutate(payload)}
      />
      <ExpenseSheet
        mode="edit"
        visible={showEditExpense}
        onClose={() => setShowEditExpense(false)}
        members={members}
        gc={gc}
        user={user}
        initial={editTarget}
        isPending={editExpenseMutation.isPending}
        onSubmit={(payload) => editExpenseMutation.mutate(payload)}
        onDelete={() => { setShowEditExpense(false); confirmDelete(editTarget) }}
      />

      <AddMemberSheet
        visible={showAddMember}
        onClose={() => setShowAddMember(false)}
        groupName={group?.name}
        members={members}
        friends={allFriends}
        friendsLoaded={!!friendsData}
        userId={user?.id}
        onAdd={addFriendToGroup}
        adding={addMemberMutation.isPending}
      />

      <Celebration visible={celebrate} message="Paid in full" onDone={() => setCelebrate(false)} />
      <BottomTabBar activeTab="groups" />
      <MembersPopup
        visible={showMembers}
        onClose={() => setShowMembers(false)}
        members={members}
        groupName={group?.name}
        isAdmin={isAdmin}
        userId={user?.id}
        onAddMembers={() => { setShowMembers(false); setShowAddMember(true) }}
        onRemove={confirmRemoveMember}
        onToggleAdmin={confirmToggleAdmin}
        removing={removeMemberMutation.isPending}
        updatingRole={makeAdminMutation.isPending}
      />
    </SafeAreaView>
  )
}

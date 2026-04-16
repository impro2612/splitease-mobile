import { useState } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, RefreshControl, Alert, FlatList,
  useWindowDimensions,
} from "react-native"
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { useLocalSearchParams, router } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { groupsApi, expensesApi, balancesApi, membersApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { formatCurrency, formatDate, CATEGORY_ICONS, CATEGORIES, GROUP_EMOJIS, GROUP_COLORS } from "@/lib/utils"
import { CURRENCIES } from "@/lib/currencies"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"

type Tab = "expenses" | "balances" | "members"

function openDatePicker(current: Date, onChange: (d: Date) => void) {
  DateTimePickerAndroid.open({
    value: current,
    mode: "date",
    is24Hour: true,
    maximumDate: new Date(),
    onChange: (_, selected) => { if (selected) onChange(selected) },
  })
}

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { height: windowH } = useWindowDimensions()
  const { user } = useAuthStore()
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
  const [expCategory, setExpCategory] = useState("general")
  const [expPaidBy, setExpPaidBy] = useState<string>(user?.id ?? "")
  const [expDate, setExpDate] = useState(new Date())

  // Edit Expense modal
  const [showEditExpense, setShowEditExpense] = useState(false)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editDesc, setEditDesc] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editCategory, setEditCategory] = useState("general")
  const [editPaidBy, setEditPaidBy] = useState("")
  const [editDate, setEditDate] = useState(new Date())

  // Add Member modal
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberEmail, setMemberEmail] = useState("")

  // Settle modal
  const [showSettle, setShowSettle] = useState(false)
  const [settleTarget, setSettleTarget] = useState<{ userId: string; name: string; amount: number } | null>(null)
  const [settleNote, setSettleNote] = useState("")

  const { data: group, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })

  const { data: balances = [] } = useQuery({
    queryKey: ["balances", id],
    queryFn: () => balancesApi.get(id).then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled: !!id,
  })

  const addExpenseMutation = useMutation({
    mutationFn: () => expensesApi.add(id, {
      description: expDesc.trim(),
      amount: parseFloat(expAmount),
      category: expCategory,
      paidById: expPaidBy || user!.id,
      splitType: "EQUAL",
      date: expDate.toISOString(),
    }),
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
    mutationFn: () => membersApi.add(id, memberEmail.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      setShowAddMember(false)
      setMemberEmail("")
      Toast.show({ type: "success", text1: "Member added!" })
    },
    onError: () => Toast.show({ type: "error", text1: "User not found or already a member" }),
  })

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
    Alert.alert(
      "Delete Group",
      `Delete "${group?.name}"? All expenses and data will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteGroupMutation.mutate() },
      ]
    )
  }

  function resetAddForm() {
    setExpDesc(""); setExpAmount(""); setExpCategory("general")
    setExpPaidBy(user?.id ?? ""); setExpDate(new Date())
  }

  function openEdit(exp: any) {
    setEditTarget(exp)
    setEditDesc(exp.description)
    setEditAmount(String(exp.amount))
    setEditCategory(exp.category ?? "general")
    setEditPaidBy(exp.paidById)
    setEditDate(new Date(exp.date ?? exp.createdAt))
    setShowEditExpense(true)
  }

  function confirmDelete(exp: any) {
    Alert.alert("Delete Expense", `Delete "${exp.description}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteExpenseMutation.mutate(exp.id) },
    ])
  }

  function openSettle(userId: string, name: string, amount: number) {
    setSettleTarget({ userId, name, amount })
    setShowSettle(true)
  }

  const expenses: any[] = group?.expenses ?? []
  const members: any[] = group?.members ?? []

  let myOwed = 0, myOwes = 0
  for (const exp of expenses) {
    const mySplit = exp.splits?.find((s: any) => s.userId === user?.id)
    if (!mySplit) continue
    if (exp.paidById === user?.id) {
      exp.splits?.forEach((s: any) => { if (s.userId !== user?.id && !s.paid) myOwed += s.amount })
    } else if (!mySplit.paid) {
      myOwes += mySplit.amount
    }
  }
  const myNet = myOwed - myOwes

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-base items-center justify-center" edges={["top"]}>
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    )
  }

  // Shared expense form fields (used in both add and edit modals)
  function ExpenseFormFields({
    desc, setDesc, amount, setAmount, category, setCategory,
    paidBy, setPaidBy, date, setDate,
  }: any) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Description */}
        <Text className="text-slate-300 text-sm font-medium mb-2">Description *</Text>
        <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14 }}>
          <TextInput className="text-white text-base" placeholder="What was this for?" placeholderTextColor="#475569" value={desc} onChangeText={setDesc} />
        </View>

        {/* Amount */}
        <Text className="text-slate-300 text-sm font-medium mb-2">Amount *</Text>
        <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14, flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: "#475569", fontSize: 18, marginRight: 4 }}>$</Text>
          <TextInput className="text-white text-xl font-bold flex-1" placeholder="0.00" placeholderTextColor="#475569" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        </View>

        {/* Date */}
        <Text className="text-slate-300 text-sm font-medium mb-2">Date</Text>
        <TouchableOpacity
          onPress={() => openDatePicker(date, setDate)}
          style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Ionicons name="calendar-outline" size={18} color="#94a3b8" />
          <Text className="text-white text-base">{formatDate(date)}</Text>
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
              <Text style={{ color: paidBy === m.userId ? "#fff" : "#94a3b8", fontWeight: "600", fontSize: 13 }}>
                {m.userId === user?.id ? "You" : m.user?.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category */}
        <Text className="text-slate-300 text-sm font-medium mb-2">Category</Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: category === cat ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", borderRadius: 10, borderWidth: category === cat ? 2 : 1, borderColor: category === cat ? "#6366f1" : "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 7 }}
            >
              <Text style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat]}</Text>
              <Text style={{ color: category === cat ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-base" edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View className="flex-row items-center gap-3 mb-3">
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 8 }}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: (group?.color ?? "#6366f1") + "33", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22 }}>{group?.emoji}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold" numberOfLines={1}>{group?.name}</Text>
            {group?.description ? <Text className="text-muted text-xs">{group.description}</Text> : null}
          </View>
          <TouchableOpacity onPress={openEditGroup} style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 12, padding: 10 }}>
            <Ionicons name="pencil" size={16} color="#a5b4fc" />
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2 mb-3">
          <View style={{ flex: 1, backgroundColor: myNet >= 0 ? "rgba(34,197,94,0.1)" : "rgba(244,63,94,0.1)", borderRadius: 14, borderWidth: 1, borderColor: myNet >= 0 ? "rgba(34,197,94,0.2)" : "rgba(244,63,94,0.2)", padding: 12 }}>
            <Text className="text-muted text-xs mb-0.5">Your balance</Text>
            <Text style={{ color: myNet >= 0 ? "#4ade80" : "#f87171", fontWeight: "800", fontSize: 20 }}>
              {myNet >= 0 ? "+" : ""}{formatCurrency(myNet)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowAddExpense(true)}
            style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", gap: 4 }}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>Add</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-1" style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 3 }}>
          {(["expenses", "balances", "members"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{ flex: 1, backgroundColor: tab === t ? "#6366f1" : "transparent", borderRadius: 10, paddingVertical: 8, alignItems: "center" }}
            >
              <Text style={{ color: tab === t ? "#fff" : "#94a3b8", fontWeight: "600", fontSize: 13, textTransform: "capitalize" }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Expenses Tab */}
        {tab === "expenses" && (
          expenses.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-5xl mb-3">📝</Text>
              <Text className="text-white font-semibold mb-1">No expenses yet</Text>
              <Text className="text-muted text-sm text-center mb-5">Add the first expense for this group</Text>
              <TouchableOpacity onPress={() => setShowAddExpense(true)} className="bg-primary rounded-2xl px-6 py-3">
                <Text className="text-white font-semibold">Add expense</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-2 py-3">
              {expenses.slice().sort((a: any, b: any) => new Date(b.date ?? b.createdAt).getTime() - new Date(a.date ?? a.createdAt).getTime()).map((exp: any) => {
                const mySplit = exp.splits?.find((s: any) => s.userId === user?.id)
                const isPayer = exp.paidById === user?.id
                const payer = members.find((m: any) => m.userId === exp.paidById)
                const myAmount = isPayer ? exp.amount - (mySplit?.amount ?? 0) : -(mySplit?.amount ?? 0)
                return (
                  <TouchableOpacity
                    key={exp.id}
                    onPress={() => openEdit(exp)}
                    activeOpacity={0.75}
                    style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 18 }}>{CATEGORY_ICONS[exp.category] ?? "💸"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className="text-white font-semibold text-sm" numberOfLines={1}>{exp.description}</Text>
                      <Text className="text-muted text-xs mt-0.5">
                        {isPayer ? "You paid" : `${payer?.user?.name ?? "Someone"} paid`}
                      </Text>
                      <Text className="text-muted text-xs">{formatDate(exp.date ?? exp.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: myAmount >= 0 ? "#4ade80" : "#f87171", fontWeight: "700", fontSize: 14 }}>
                        {myAmount >= 0 ? "+" : ""}{formatCurrency(myAmount)}
                      </Text>
                      <Text className="text-muted text-xs">{formatCurrency(exp.amount)} total</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )
        )}

        {/* Balances Tab */}
        {tab === "balances" && (
          <View className="py-3 gap-3">
            {balances.length === 0 ? (
              <View className="items-center py-16">
                <Text className="text-5xl mb-3">✅</Text>
                <Text className="text-white font-semibold mb-1">All settled up!</Text>
                <Text className="text-muted text-sm text-center">No outstanding balances</Text>
              </View>
            ) : (
              <>
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Who owes who</Text>
                {(balances as any[]).map((b: any, i: number) => {
                  const fromMe = b.fromUserId === user?.id
                  const toMe = b.toUserId === user?.id
                  // Use the embedded user objects from the API directly
                  const fromUser = b.fromUser
                  const toUser = b.toUser
                  const fromName = fromMe ? "You" : (fromUser?.name ?? "Someone")
                  const toName = toMe ? "you" : (toUser?.name ?? "someone")
                  return (
                    <View
                      key={i}
                      style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", padding: 14 }}
                    >
                      <View className="flex-row items-center gap-3 mb-3">
                        <Avatar name={fromUser?.name} email={fromUser?.email} size={36} />
                        <View className="flex-1">
                          <Text className="text-white font-semibold text-sm">
                            {fromName} owe{fromMe ? "" : "s"} {toName}
                          </Text>
                          <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 16 }}>{formatCurrency(b.amount)}</Text>
                        </View>
                        <Avatar name={toUser?.name} email={toUser?.email} size={36} />
                      </View>
                      {fromMe && (
                        <TouchableOpacity
                          onPress={() => openSettle(b.toUserId, toUser?.name ?? "them", b.amount)}
                          style={{ backgroundColor: "#6366f1", borderRadius: 10, paddingVertical: 9, alignItems: "center" }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Settle up with {toName}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
              </>
            )}
          </View>
        )}

        {/* Members Tab */}
        {tab === "members" && (
          <View className="py-3 gap-2">
            <TouchableOpacity
              onPress={() => setShowAddMember(true)}
              style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person-add" size={20} color="#a5b4fc" />
              </View>
              <Text style={{ color: "#a5b4fc", fontWeight: "600" }}>Invite member</Text>
            </TouchableOpacity>

            {members.map((m: any) => {
              const isCreator = group?.createdById === m.userId
              const isMe = m.userId === user?.id
              return (
                <View
                  key={m.id}
                  style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={44} />
                  <View style={{ flex: 1 }}>
                    <View className="flex-row items-center gap-2">
                      <Text className="text-white font-semibold">{m.user?.name ?? "Unknown"}</Text>
                      {isMe && <Text style={{ color: "#a5b4fc", fontSize: 10, fontWeight: "600" }}>(you)</Text>}
                    </View>
                    <Text className="text-muted text-xs">{m.user?.email}</Text>
                  </View>
                  {isCreator && (
                    <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "600" }}>Admin</Text>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal visible={showAddExpense} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddExpense(false)}>
        <View className="flex-1 bg-base px-5" style={{ paddingTop: insets.top + 16 }}>
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold">Add Expense</Text>
            <TouchableOpacity onPress={() => { setShowAddExpense(false); resetAddForm() }} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <ExpenseFormFields
            desc={expDesc} setDesc={setExpDesc}
            amount={expAmount} setAmount={setExpAmount}
            category={expCategory} setCategory={setExpCategory}
            paidBy={expPaidBy} setPaidBy={setExpPaidBy}
            date={expDate} setDate={setExpDate}
          />
          <TouchableOpacity
            onPress={() => addExpenseMutation.mutate()}
            disabled={!expDesc.trim() || !expAmount || isNaN(parseFloat(expAmount)) || addExpenseMutation.isPending}
            style={{ backgroundColor: (!expDesc.trim() || !expAmount) ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center", marginBottom: 24 }}
          >
            {addExpenseMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Add Expense</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit Expense Modal */}
      <Modal visible={showEditExpense} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditExpense(false)}>
        <View className="flex-1 bg-base px-5" style={{ paddingTop: insets.top + 16 }}>
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold">Edit Expense</Text>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => { setShowEditExpense(false); confirmDelete(editTarget) }}
                style={{ backgroundColor: "rgba(244,63,94,0.15)", borderRadius: 20, padding: 8 }}
              >
                <Ionicons name="trash-outline" size={18} color="#f87171" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowEditExpense(false)} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <ExpenseFormFields
            desc={editDesc} setDesc={setEditDesc}
            amount={editAmount} setAmount={setEditAmount}
            category={editCategory} setCategory={setEditCategory}
            paidBy={editPaidBy} setPaidBy={setEditPaidBy}
            date={editDate} setDate={setEditDate}
          />
          <TouchableOpacity
            onPress={() => editExpenseMutation.mutate()}
            disabled={!editDesc.trim() || !editAmount || isNaN(parseFloat(editAmount)) || editExpenseMutation.isPending}
            style={{ backgroundColor: (!editDesc.trim() || !editAmount) ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center", marginBottom: 24 }}
          >
            {editExpenseMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Save Changes</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddMember(false)}>
        <View className="flex-1 bg-base px-5" style={{ paddingTop: insets.top + 16 }}>
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold">Invite Member</Text>
            <TouchableOpacity onPress={() => { setShowAddMember(false); setMemberEmail("") }} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text className="text-muted text-sm mb-4">Enter the email address of the person you'd like to add to {group?.name}.</Text>
          <Text className="text-slate-300 text-sm font-medium mb-2">Email address *</Text>
          <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 20 }}>
            <TextInput className="text-white text-base" placeholder="friend@example.com" placeholderTextColor="#475569" value={memberEmail} onChangeText={setMemberEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <TouchableOpacity
            onPress={() => addMemberMutation.mutate()}
            disabled={!memberEmail.trim() || addMemberMutation.isPending}
            style={{ backgroundColor: !memberEmail.trim() ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}
          >
            {addMemberMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Add Member</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Edit Group Modal */}
      <Modal visible={showEditGroup} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditGroup(false)}>
        <View style={{ height: windowH, backgroundColor: "#0a0a1a", paddingTop: insets.top + 16 }}>

          {/* Static top */}
          <View style={{ paddingHorizontal: 20 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Edit Group</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={confirmDeleteGroup}
                  style={{ backgroundColor: "rgba(244,63,94,0.15)", borderRadius: 20, padding: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#f87171" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowEditGroup(false)} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Preview card */}
            <View style={{ backgroundColor: "#1a1a2e", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: editGroupColor + "33", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22 }}>{editGroupEmoji}</Text>
              </View>
              <View>
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>{editGroupName || "Group name"}</Text>
                <Text style={{ color: "#475569", fontSize: 12 }}>{editGroupDesc || "No description"}</Text>
              </View>
            </View>

            {/* Group name */}
            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Group name *</Text>
            <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 48, justifyContent: "center", marginBottom: 10 }}>
              <TextInput style={{ color: "#fff", fontSize: 15 }} placeholder="e.g. NYC Trip, Apartment" placeholderTextColor="#475569" value={editGroupName} onChangeText={setEditGroupName} />
            </View>

            {/* Description */}
            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Description (optional)</Text>
            <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 48, justifyContent: "center", marginBottom: 10 }}>
              <TextInput style={{ color: "#fff", fontSize: 15 }} placeholder="What's this group for?" placeholderTextColor="#475569" value={editGroupDesc} onChangeText={setEditGroupDesc} />
            </View>

            {/* Currency */}
            <Text style={{ color: "#cbd5e1", fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Group Currency</Text>
            <TouchableOpacity
              onPress={() => setShowEditCurrencyPicker(true)}
              style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 18 }}>{CURRENCIES.find(c => c.code === editGroupCurrency)?.flag}</Text>
                <Text style={{ color: "#fff", fontSize: 15 }}>{editGroupCurrency} — {CURRENCIES.find(c => c.code === editGroupCurrency)?.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#475569" />
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
          <View style={{ paddingHorizontal: 20, paddingBottom: 28, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
            <TouchableOpacity
              onPress={() => updateGroupMutation.mutate()}
              disabled={!editGroupName.trim() || updateGroupMutation.isPending}
              style={{ backgroundColor: !editGroupName.trim() ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}
            >
              {updateGroupMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Changes</Text>}
            </TouchableOpacity>
          </View>

        </View>
      </Modal>

      {/* Edit Group Currency Picker */}
      <Modal visible={showEditCurrencyPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditCurrencyPicker(false)}>
        <View style={{ flex: 1, backgroundColor: "#0a0a1a", paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Group Currency</Text>
            <TouchableOpacity onPress={() => { setShowEditCurrencyPicker(false); setEditCurrencySearch("") }} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
            <Ionicons name="search" size={16} color="#475569" style={{ marginRight: 8 }} />
            <TextInput style={{ color: "#fff", flex: 1, fontSize: 15 }} placeholder="Search currency..." placeholderTextColor="#475569" value={editCurrencySearch} onChangeText={setEditCurrencySearch} autoCapitalize="none" />
            {editCurrencySearch.length > 0 && <TouchableOpacity onPress={() => setEditCurrencySearch("")}><Ionicons name="close-circle" size={16} color="#475569" /></TouchableOpacity>}
          </View>
          <FlatList
            data={CURRENCIES.filter(c => c.code.toLowerCase().includes(editCurrencySearch.toLowerCase()) || c.name.toLowerCase().includes(editCurrencySearch.toLowerCase()))}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setEditGroupCurrency(item.code); setShowEditCurrencyPicker(false); setEditCurrencySearch("") }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" }}
              >
                <Text style={{ fontSize: 24 }}>{item.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontWeight: "600" }}>{item.code}</Text>
                  <Text style={{ color: "#475569", fontSize: 12 }}>{item.name}</Text>
                </View>
                {editGroupCurrency === item.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Settle Up Modal */}
      <Modal visible={showSettle} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettle(false)}>
        <View className="flex-1 bg-base px-5" style={{ paddingTop: insets.top + 16 }}>
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold">Settle Up</Text>
            <TouchableOpacity onPress={() => { setShowSettle(false); setSettleNote("") }} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          {settleTarget && (
            <>
              <View style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 20, alignItems: "center", marginBottom: 20 }}>
                <Text className="text-muted text-sm mb-1">You're paying</Text>
                <Text className="text-white text-2xl font-bold mb-1">{settleTarget.name}</Text>
                <Text style={{ color: "#6366f1", fontSize: 32, fontWeight: "800" }}>{formatCurrency(settleTarget.amount)}</Text>
              </View>
              <Text className="text-slate-300 text-sm font-medium mb-2">Note (optional)</Text>
              <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 20 }}>
                <TextInput className="text-white text-base" placeholder="e.g. Venmo, Cash…" placeholderTextColor="#475569" value={settleNote} onChangeText={setSettleNote} />
              </View>
              <TouchableOpacity
                onPress={() => settleMutation.mutate()}
                disabled={settleMutation.isPending}
                style={{ backgroundColor: "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}
              >
                {settleMutation.isPending ? <ActivityIndicator color="#fff" /> : (
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text className="text-white font-bold text-base">Confirm Settlement</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}

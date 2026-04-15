import { useState } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, RefreshControl, Alert,
} from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { groupsApi, expensesApi, balancesApi, membersApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { formatCurrency, formatRelativeTime, CATEGORY_ICONS, CATEGORIES } from "@/lib/utils"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"

type Tab = "expenses" | "balances" | "members"

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()

  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>("expenses")

  // Modals
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showSettle, setShowSettle] = useState(false)
  const [settleTarget, setSettleTarget] = useState<{ userId: string; name: string; amount: number } | null>(null)

  // Add Expense form
  const [expDesc, setExpDesc] = useState("")
  const [expAmount, setExpAmount] = useState("")
  const [expCategory, setExpCategory] = useState("general")
  const [expPaidBy, setExpPaidBy] = useState<string>(user?.id ?? "")

  // Add Member form
  const [memberEmail, setMemberEmail] = useState("")

  // Settle form
  const [settleNote, setSettleNote] = useState("")

  const { data: group, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })

  const { data: balances = [] } = useQuery({
    queryKey: ["balances", id],
    queryFn: () => balancesApi.get(id).then((r) => r.data),
    enabled: !!id,
  })

  const addExpenseMutation = useMutation({
    mutationFn: () => expensesApi.add(id, {
      description: expDesc.trim(),
      amount: parseFloat(expAmount),
      category: expCategory,
      paidById: expPaidBy || user!.id,
      splitType: "EQUAL",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["balances", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      setShowAddExpense(false)
      resetExpenseForm()
      Toast.show({ type: "success", text1: "Expense added!" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to add expense" }),
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
      setShowSettle(false)
      setSettleNote("")
      setSettleTarget(null)
      Toast.show({ type: "success", text1: "Settlement recorded!" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to record settlement" }),
  })

  function resetExpenseForm() {
    setExpDesc(""); setExpAmount(""); setExpCategory("general"); setExpPaidBy(user?.id ?? "")
  }

  function openSettle(userId: string, name: string, amount: number) {
    setSettleTarget({ userId, name, amount })
    setShowSettle(true)
  }

  const expenses: any[] = group?.expenses ?? []
  const members: any[] = group?.members ?? []

  // My balance summary
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

  return (
    <SafeAreaView className="flex-1 bg-base" edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View className="flex-row items-center gap-3 mb-3">
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 8 }}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold" numberOfLines={1}>{group?.name}</Text>
            {group?.description ? <Text className="text-muted text-xs">{group.description}</Text> : null}
          </View>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: (group?.color ?? "#6366f1") + "33", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22 }}>{group?.emoji}</Text>
          </View>
        </View>

        {/* Balance summary */}
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

        {/* Tabs */}
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
              {expenses.slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((exp: any) => {
                const mySplit = exp.splits?.find((s: any) => s.userId === user?.id)
                const isPayer = exp.paidById === user?.id
                const payer = members.find((m: any) => m.userId === exp.paidById)
                const myAmount = isPayer ? exp.amount - (mySplit?.amount ?? 0) : -(mySplit?.amount ?? 0)
                return (
                  <View
                    key={exp.id}
                    style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 18 }}>{CATEGORY_ICONS[exp.category] ?? "💸"}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className="text-white font-semibold text-sm" numberOfLines={1}>{exp.description}</Text>
                      <Text className="text-muted text-xs mt-0.5">
                        {isPayer ? "You paid" : `${payer?.user?.name ?? "Someone"} paid`} · {formatRelativeTime(exp.createdAt)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: myAmount >= 0 ? "#4ade80" : "#f87171", fontWeight: "700", fontSize: 14 }}>
                        {myAmount >= 0 ? "+" : ""}{formatCurrency(myAmount)}
                      </Text>
                      <Text className="text-muted text-xs">{formatCurrency(exp.amount)} total</Text>
                    </View>
                  </View>
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
                {balances.map((b: any, i: number) => {
                  const fromMe = b.fromUserId === user?.id
                  const toMe = b.toUserId === user?.id
                  const fromName = fromMe ? "You" : (members.find((m: any) => m.userId === b.fromUserId)?.user?.name ?? "Someone")
                  const toName = toMe ? "you" : (members.find((m: any) => m.userId === b.toUserId)?.user?.name ?? "Someone")
                  const fromMember = members.find((m: any) => m.userId === b.fromUserId)
                  const toMember = members.find((m: any) => m.userId === b.toUserId)
                  return (
                    <View
                      key={i}
                      style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", padding: 14 }}
                    >
                      <View className="flex-row items-center gap-3 mb-3">
                        <Avatar name={fromMember?.user?.name} email={fromMember?.user?.email} size={36} />
                        <View className="flex-1">
                          <Text className="text-white font-semibold text-sm">
                            {fromName} owe{fromMe ? "" : "s"} {toName}
                          </Text>
                          <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 16 }}>{formatCurrency(b.amount)}</Text>
                        </View>
                        <Avatar name={toMember?.user?.name} email={toMember?.user?.email} size={36} />
                      </View>
                      {fromMe && (
                        <TouchableOpacity
                          onPress={() => openSettle(b.toUserId, toMember?.user?.name ?? "them", b.amount)}
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
            <TouchableOpacity onPress={() => { setShowAddExpense(false); resetExpenseForm() }} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Description */}
            <Text className="text-slate-300 text-sm font-medium mb-2">Description *</Text>
            <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14 }}>
              <TextInput className="text-white text-base" placeholder="What was this for?" placeholderTextColor="#475569" value={expDesc} onChangeText={setExpDesc} />
            </View>

            {/* Amount */}
            <Text className="text-slate-300 text-sm font-medium mb-2">Amount *</Text>
            <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14, flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: "#475569", fontSize: 18, marginRight: 4 }}>$</Text>
              <TextInput className="text-white text-xl font-bold flex-1" placeholder="0.00" placeholderTextColor="#475569" value={expAmount} onChangeText={setExpAmount} keyboardType="decimal-pad" />
            </View>

            {/* Paid by */}
            <Text className="text-slate-300 text-sm font-medium mb-2">Paid by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {members.map((m: any) => (
                <TouchableOpacity
                  key={m.userId}
                  onPress={() => setExpPaidBy(m.userId)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: expPaidBy === m.userId ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", borderRadius: 12, borderWidth: expPaidBy === m.userId ? 2 : 1, borderColor: expPaidBy === m.userId ? "#6366f1" : "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}
                >
                  <Avatar name={m.user?.name} email={m.user?.email} size={24} />
                  <Text style={{ color: expPaidBy === m.userId ? "#fff" : "#94a3b8", fontWeight: "600", fontSize: 13 }}>
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
                  onPress={() => setExpCategory(cat)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: expCategory === cat ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", borderRadius: 10, borderWidth: expCategory === cat ? 2 : 1, borderColor: expCategory === cat ? "#6366f1" : "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 7 }}
                >
                  <Text style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat]}</Text>
                  <Text style={{ color: expCategory === cat ? "#fff" : "#94a3b8", fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => addExpenseMutation.mutate()}
              disabled={!expDesc.trim() || !expAmount || isNaN(parseFloat(expAmount)) || addExpenseMutation.isPending}
              style={{ backgroundColor: (!expDesc.trim() || !expAmount) ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center", marginBottom: 24 }}
            >
              {addExpenseMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Add Expense</Text>}
            </TouchableOpacity>
          </ScrollView>
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
            <TextInput
              className="text-white text-base"
              placeholder="friend@example.com"
              placeholderTextColor="#475569"
              value={memberEmail}
              onChangeText={setMemberEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
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
                <TextInput
                  className="text-white text-base"
                  placeholder="e.g. Venmo, Cash…"
                  placeholderTextColor="#475569"
                  value={settleNote}
                  onChangeText={setSettleNote}
                />
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

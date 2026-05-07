import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, FlatList } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { useTheme } from "@/lib/theme"
import { useAuthStore } from "@/store/auth"
import { groupsApi, expensesApi } from "@/lib/api"
import { CURRENCIES, NO_DECIMAL_CURRENCIES } from "@/lib/currencies"
import { formatDate } from "@/lib/utils"
import { getNativePendingSuggestionById, clearNativePendingSuggestionById } from "@/lib/nativeTrackExpense"
import Toast from "react-native-toast-message"

export default function ConfirmExpense() {
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const { suggestionId, groupId } = useLocalSearchParams<{ suggestionId: string; groupId: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("")
  const [paidById, setPaidById] = useState<string>("")
  const [date, setDate] = useState(new Date())
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => groupsApi.get(groupId).then((r) => r.data),
    enabled: !!groupId,
  })

  const members: any[] = group?.members ?? []
  const gc = CURRENCIES.find((c) => c.code === (group?.currency ?? "USD")) ?? CURRENCIES[0]

  // Once group loads, set currency default to group currency (may be overridden by SMS currency below)
  useEffect(() => {
    if (group && !currency) setCurrency(group.currency ?? "USD")
  }, [group])

  // Load suggestion by its unique ID — prevents loading a newer overwritten suggestion
  useEffect(() => {
    if (!suggestionId) return
    getNativePendingSuggestionById(suggestionId).then((s: any) => {
      if (!s) return
      setDescription(s.merchant || "")
      setAmount(String(s.amount || ""))
      if (s.date) setDate(new Date(s.date))
      if (s.currency) setCurrency(s.currency)
    })
  }, [suggestionId])

  useEffect(() => {
    if (user?.id) setPaidById(user.id)
  }, [user?.id])

  const activeCurrencyCode = currency || gc.code
  const activeCurrencyInfo = CURRENCIES.find((c) => c.code === activeCurrencyCode) ?? gc

  const addMutation = useMutation({
    mutationFn: async () => {
      const numAmount = parseFloat(amount)
      if (!numAmount || numAmount <= 0) throw new Error("Invalid amount")
      const memberIds = members.map((m: any) => m.userId)
      const n = memberIds.length
      const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrencyCode)
      let splits: any[]
      if (isNoDec) {
        const totalUnits = Math.round(numAmount)
        const baseUnits = Math.floor(totalUnits / n)
        const extra = totalUnits - baseUnits * n
        splits = memberIds.map((uid: string, i: number) => ({
          userId: uid,
          amount: baseUnits + (i < extra ? 1 : 0),
        }))
      } else {
        const totalCents = Math.round(numAmount * 100)
        const baseCents = Math.floor(totalCents / n)
        const extra = totalCents - baseCents * n
        splits = memberIds.map((uid: string, i: number) => ({
          userId: uid,
          amount: (baseCents + (i < extra ? 1 : 0)) / 100,
        }))
      }
      return expensesApi.add(groupId, {
        description: description.trim() || "Expense",
        amount: numAmount,
        currency: activeCurrencyCode,
        category: "other",
        paidById,
        splitType: "EXACT",
        splits,
        date: date.toISOString(),
      })
    },
    onSuccess: async () => {
      await clearNativePendingSuggestionById(suggestionId)
      queryClient.invalidateQueries({ queryKey: ["group", groupId] })
      queryClient.invalidateQueries({ queryKey: ["balances", groupId] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      Toast.show({ type: "success", text1: "Expense added!" })
      router.back()
    },
    onError: () => {
      Toast.show({ type: "error", text1: "Failed to add expense" })
    },
  })

  function openDatePicker() {
    DateTimePickerAndroid.open({
      value: date,
      mode: "date",
      maximumDate: new Date(),
      onChange: (_, selected) => { if (selected) setDate(selected) },
    })
  }

  async function dismiss() {
    await clearNativePendingSuggestionById(suggestionId)
    router.back()
  }

  if (groupLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    )
  }

  if (!group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Ionicons name="alert-circle-outline" size={48} color={C.textSub} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginTop: 16, textAlign: "center" }}>Group not found</Text>
        <Text style={{ color: C.textSub, fontSize: 14, marginTop: 8, textAlign: "center" }}>This group may have been deleted or you may no longer have access.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, backgroundColor: "#6366f1", borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const isForeignCurrency = activeCurrencyCode !== gc.code

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 }}>
        <TouchableOpacity onPress={dismiss} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="close" size={20} color={C.textSub} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>Confirm Expense</Text>
          <Text style={{ color: "#a5b4fc", fontSize: 12, marginTop: 1 }}>📡 Detected from SMS · {group?.name}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingTop: 8 }}>
          {/* Description */}
          <View>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Merchant / what was it for?"
              placeholderTextColor={C.textMuted}
              style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 15, padding: 14 }}
            />
          </View>

          {/* Amount + Currency picker */}
          <View>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Amount</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {/* Currency chip — tappable */}
              <TouchableOpacity
                onPress={() => setShowCurrencyPicker(true)}
                style={{
                  backgroundColor: C.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isForeignCurrency ? "rgba(99,102,241,0.5)" : C.border,
                  paddingHorizontal: 12,
                  height: 52,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 4,
                }}
              >
                <Text style={{ color: C.text, fontSize: 16, fontWeight: "700" }}>{activeCurrencyInfo.symbol}</Text>
                <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600" }}>{activeCurrencyCode}</Text>
                <Ionicons name="chevron-down" size={11} color={C.textMuted} />
              </TouchableOpacity>
              <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 52, justifyContent: "center" }}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={C.textMuted}
                  style={{ color: C.text, fontSize: 22, fontWeight: "700" }}
                />
              </View>
            </View>
            {/* Foreign currency hint */}
            {isForeignCurrency && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                <Ionicons name="information-circle-outline" size={14} color="#a5b4fc" />
                <Text style={{ color: "#a5b4fc", fontSize: 12 }}>
                  Detected currency: {activeCurrencyCode} · Group default is {gc.code}
                </Text>
              </View>
            )}
          </View>

          {/* Paid by */}
          <View>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Paid by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {members.map((m: any) => (
                  <TouchableOpacity
                    key={m.userId}
                    onPress={() => setPaidById(m.userId)}
                    style={{
                      backgroundColor: paidById === m.userId ? "#6366f1" : C.card,
                      borderRadius: 12, borderWidth: 1,
                      borderColor: paidById === m.userId ? "#6366f1" : C.border,
                      paddingHorizontal: 14, paddingVertical: 10,
                    }}
                  >
                    <Text style={{ color: paidById === m.userId ? "#fff" : C.text, fontWeight: "600", fontSize: 13 }}>
                      {m.userId === user?.id ? "You" : (m.user?.name?.split(" ")[0] ?? m.user?.email ?? "?")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Split */}
          <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="git-branch-outline" size={18} color={C.textSub} />
            <Text style={{ color: C.text, fontSize: 14, flex: 1 }}>Split equally among {members.length} members</Text>
          </View>

          {/* Date */}
          <View>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Date</Text>
            <TouchableOpacity
              onPress={openDatePicker}
              style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <Ionicons name="calendar-outline" size={18} color={C.textSub} />
              <Text style={{ color: C.text, fontSize: 15 }}>{formatDate(date)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: insets.bottom + 120 }} />
      </ScrollView>

      {/* Bottom buttons */}
      <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(24, insets.bottom + 12), gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
        <TouchableOpacity
          onPress={() => addMutation.mutate()}
          disabled={addMutation.isPending}
          style={{ backgroundColor: "#6366f1", borderRadius: 16, height: 52, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
        >
          {addMutation.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={dismiss}
          style={{ height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: C.textSub, fontSize: 14 }}>Dismiss suggestion</Text>
        </TouchableOpacity>
      </View>

      {/* Currency picker modal */}
      <Modal
        visible={showCurrencyPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowCurrencyPicker(false); setCurrencySearch("") }}
      >
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Expense Currency</Text>
            <TouchableOpacity
              onPress={() => { setShowCurrencyPicker(false); setCurrencySearch("") }}
              style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
            <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={{ color: C.text, flex: 1, fontSize: 15 }}
              placeholder="Search currency..."
              placeholderTextColor={C.textMuted}
              value={currencySearch}
              onChangeText={setCurrencySearch}
              autoCapitalize="none"
            />
            {currencySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCurrencySearch("")}>
                <Ionicons name="close-circle" size={16} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {/* Group default currency pinned at top */}
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
            data={CURRENCIES.filter((c) =>
              currencySearch
                ? c.code.toLowerCase().includes(currencySearch.toLowerCase()) || c.name.toLowerCase().includes(currencySearch.toLowerCase())
                : c.code !== gc.code
            )}
            keyExtractor={(item) => item.code}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              !currencySearch
                ? <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>OTHER CURRENCIES</Text>
                : null
            }
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
    </SafeAreaView>
  )
}

import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native"
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
import { clearNativePendingSuggestion } from "@/lib/nativeTrackExpense"
import Toast from "react-native-toast-message"

export default function ConfirmExpense() {
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const { suggestionId, groupId } = useLocalSearchParams<{ suggestionId: string; groupId: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paidById, setPaidById] = useState<string>("")
  const [date, setDate] = useState(new Date())

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => groupsApi.get(groupId).then((r) => r.data),
    enabled: !!groupId,
  })

  const members: any[] = group?.members ?? []
  const gc = CURRENCIES.find((c) => c.code === (group?.currency ?? "USD")) ?? CURRENCIES[0]

  // Load suggestion from native SharedPreferences
  useEffect(() => {
    import("@/lib/nativeTrackExpense").then(({ getNativePendingSuggestion }) => {
      getNativePendingSuggestion().then((s: any) => {
        if (!s) return
        setDescription(s.merchant || "")
        setAmount(String(s.amount || ""))
        if (s.date) setDate(new Date(s.date))
      })
    })
  }, [suggestionId])

  useEffect(() => {
    if (user?.id) setPaidById(user.id)
  }, [user?.id])

  const addMutation = useMutation({
    mutationFn: async () => {
      const numAmount = parseFloat(amount)
      if (!numAmount || numAmount <= 0) throw new Error("Invalid amount")
      const memberIds = members.map((m: any) => m.userId)
      const n = memberIds.length
      const isNoDec = NO_DECIMAL_CURRENCIES.has(gc.code)
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
        category: "other",
        paidById,
        splitType: "EXACT",
        splits,
        date: date.toISOString(),
      })
    },
    onSuccess: async () => {
      await clearNativePendingSuggestion()
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
    await clearNativePendingSuggestion()
    router.back()
  }

  if (groupLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    )
  }

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

          {/* Amount */}
          <View>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Amount ({gc.code})</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder={`0.00`}
              placeholderTextColor={C.textMuted}
              style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 22, fontWeight: "700", padding: 14 }}
            />
          </View>

          {/* Paid by */}
          <View>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Paid by</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
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
    </SafeAreaView>
  )
}

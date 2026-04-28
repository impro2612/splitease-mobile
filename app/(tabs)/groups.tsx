import { useState, useEffect } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator, Alert, FlatList,
  useWindowDimensions, Keyboard, TouchableWithoutFeedback,
} from "react-native"
import { router } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { groupsApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { formatCurrency, GROUP_EMOJIS, GROUP_COLORS } from "@/lib/utils"
import { CURRENCIES } from "@/lib/currencies"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"
import { useTheme } from "@/lib/theme"
import { getRate } from "@/lib/exchange"

export default function Groups() {
  const { user, currency: defaultCurrency } = useAuthStore()
  const C = useTheme()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const { height: windowH } = useWindowDimensions()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("💰")
  const [color, setColor] = useState("#6366f1")
  const [groupCurrency, setGroupCurrency] = useState(defaultCurrency)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")
  const [search, setSearch] = useState("")

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  // FX rates keyed by "USD->INR" etc, for cross-currency balance conversion
  const [fxRates, setFxRates] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!groups.length) return
    const pairs: { from: string; to: string }[] = []
    for (const g of groups) {
      const defaultCode = g.currency ?? "USD"
      for (const e of (g.expenses ?? [])) {
        const expCur = e.currency ?? defaultCode
        if (expCur !== defaultCode) {
          const key = `${expCur}->${defaultCode}`
          if (!fxRates[key]) pairs.push({ from: expCur, to: defaultCode })
        }
      }
    }
    const uniquePairs = pairs.filter((p, i) => pairs.findIndex(x => x.from === p.from && x.to === p.to) === i)
    if (!uniquePairs.length) return
    Promise.all(uniquePairs.map(async ({ from, to }) => {
      const rate = await getRate(from, to)
      return { key: `${from}->${to}`, rate }
    })).then((results) => {
      setFxRates((prev) => {
        const next = { ...prev }
        for (const r of results) if (r.rate !== null) next[r.key] = r.rate
        return next
      })
    })
  }, [groups])

  function closeCreate() {
    Keyboard.dismiss()
    setShowCreate(false)
    setName(""); setDescription(""); setEmoji("💰"); setColor("#6366f1"); setGroupCurrency(defaultCurrency)
    setCurrencySearch("")
  }

  const createMutation = useMutation({
    mutationFn: () => groupsApi.create({ name: name.trim(), description, emoji, color, currency: groupCurrency }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["activity"] })
      closeCreate()
      Toast.show({ type: "success", text1: "Group created! 🎉" })
      router.push(`/group/${res.data.id}`)
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to create group" }),
  })

  function getGroupBalance(group: any): number {
    const defaultCode = group.currency ?? "USD"
    let owed = 0, owes = 0
    for (const expense of (group.expenses ?? [])) {
      const mySplit = expense.splits?.find((s: any) => s.userId === user?.id)
      if (!mySplit) continue
      const expCur = expense.currency ?? defaultCode
      const rate = expCur === defaultCode ? 1 : (fxRates[`${expCur}->${defaultCode}`] ?? null)
      if (rate === null) continue // skip until rate loaded
      if (expense.paidById === user?.id) {
        expense.splits?.forEach((s: any) => { if (s.userId !== user?.id && !s.paid) owed += s.amount * rate })
      } else if (!mySplit.paid) {
        owes += mySplit.amount * rate
      }
    }
    return owed - owes
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: "700" }}>Groups</Text>
          <Text style={{ color: C.textSub, fontSize: 13 }}>{groups.length} group{groups.length !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          className="bg-primary rounded-2xl px-4 py-2.5 flex-row items-center gap-2"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text className="text-white font-semibold text-sm">New Group</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 46 }}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, color: C.text, fontSize: 14 }}
            placeholder="Search groups..."
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
        ) : groups.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 80 }}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>👥</Text>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "600", marginBottom: 8 }}>No groups yet</Text>
            <Text style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 24 }}>Create a group to start splitting expenses</Text>
            <TouchableOpacity onPress={() => setShowCreate(true)} style={{ backgroundColor: "#6366f1", borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: C.text, fontWeight: "600" }}>Create first group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12, paddingBottom: 24 }}>
            {groups
              .filter((g: any) => !search.trim() || g.name?.toLowerCase().includes(search.toLowerCase()))
              .map((group: any) => {
              const balance = getGroupBalance(group)
              const gc = CURRENCIES.find(c => c.code === (group.currency ?? "USD")) ?? CURRENCIES[0]
              return (
                <TouchableOpacity
                  key={group.id}
                  onPress={() => router.push(`/group/${group.id}`)}
                  style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 16 }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: group.color + "33", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 24 }}>{group.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{group.name}</Text>
                      {group.description ? <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{group.description}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="people-outline" size={12} color={C.textMuted} />
                        <Text style={{ color: C.textSub, fontSize: 12 }}>{group.members?.length ?? 0}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="receipt-outline" size={12} color={C.textMuted} />
                        <Text style={{ color: C.textSub, fontSize: 12 }}>{group._count?.expenses ?? 0}</Text>
                      </View>
                    </View>
                    <Text style={{ color: balance > 0 ? "#4ade80" : balance < 0 ? "#f87171" : C.textMuted, fontWeight: "700", fontSize: 14 }}>
                      {balance > 0 ? "+" : balance < 0 ? "-" : ""}{balance !== 0 ? formatCurrency(Math.abs(balance), gc.symbol, gc.code) : "Settled"}
                    </Text>
                  </View>

                  {/* Member avatars */}
                  <View style={{ flexDirection: "row", marginTop: 8, marginLeft: 2 }}>
                    {group.members?.slice(0, 5).map((m: any, i: number) => (
                      <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                        <Avatar name={m.user.name} email={m.user.email} image={m.user.image} size={24} />
                      </View>
                    ))}
                    {(group.members?.length ?? 0) > 5 && (
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.iconBg, marginLeft: -8, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 9, color: C.textSub }}>+{group.members.length - 5}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
            {search.trim() && groups.filter((g: any) => g.name?.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="search-outline" size={40} color={C.textMuted} style={{ marginBottom: 12 }} />
                <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>No groups match "{search}"</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Group Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeCreate}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ height: windowH, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Create Group</Text>
              <TouchableOpacity onPress={closeCreate} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
                <Ionicons name="close" size={18} color={C.text} />
              </TouchableOpacity>
            </View>
            <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color + "33", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </View>
              <View>
                <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{name || "Group name"}</Text>
                <Text style={{ color: C.textSub, fontSize: 12 }}>{description || "No description"}</Text>
              </View>
            </View>
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Group name *</Text>
            <View style={{ backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 48, justifyContent: "center", marginBottom: 10 }}>
              <TextInput style={{ color: C.text, fontSize: 15 }} placeholder="e.g. NYC Trip, Apartment" placeholderTextColor={C.textMuted} value={name} onChangeText={setName} />
            </View>
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Description (optional)</Text>
            <View style={{ backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 48, justifyContent: "center", marginBottom: 10 }}>
              <TextInput style={{ color: C.text, fontSize: 15 }} placeholder="What's this group for?" placeholderTextColor={C.textMuted} value={description} onChangeText={setDescription} />
            </View>
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Group Currency</Text>
            <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={{ backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 18 }}>{CURRENCIES.find(c => c.code === groupCurrency)?.flag}</Text>
                <Text style={{ color: C.text, fontSize: 15 }}>{groupCurrency} — {CURRENCIES.find(c => c.code === groupCurrency)?.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 6, marginTop: 2 }}>Icon</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {GROUP_EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => setEmoji(e)} style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: emoji === e ? "rgba(99,102,241,0.3)" : C.iconBg, borderWidth: emoji === e ? 2 : 1, borderColor: emoji === e ? "#6366f1" : C.border, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 21 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 8 }}>Color</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {GROUP_COLORS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: C.isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)" }} />
              ))}
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(28, insets.bottom + 16), paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
            <TouchableOpacity onPress={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} style={{ backgroundColor: !name.trim() ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}>
              {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Create Group</Text>}
            </TouchableOpacity>
          </View>
        </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal visible={showCurrencyPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Group Currency</Text>
            <TouchableOpacity onPress={() => { setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
            <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
            <TextInput style={{ color: C.text, flex: 1, fontSize: 14 }} placeholder="Search currency..." placeholderTextColor={C.textMuted} value={currencySearch} onChangeText={setCurrencySearch} autoCapitalize="none" />
            {currencySearch.length > 0 && <TouchableOpacity onPress={() => setCurrencySearch("")}><Ionicons name="close-circle" size={16} color={C.textMuted} /></TouchableOpacity>}
          </View>
          <FlatList
            data={CURRENCIES.filter(c => c.code.toLowerCase().includes(currencySearch.toLowerCase()) || c.name.toLowerCase().includes(currencySearch.toLowerCase()))}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 20) }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => { setGroupCurrency(item.code); setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                  <Text style={{ fontSize: 16, color: C.text, fontWeight: "600" }}>{item.symbol}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600" }}>{item.code}</Text>
                  <Text style={{ color: C.textSub, fontSize: 12 }}>{item.name}</Text>
                </View>
                <Text style={{ fontSize: 24, marginRight: groupCurrency === item.code ? 8 : 0 }}>{item.flag}</Text>
                {groupCurrency === item.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  )
}

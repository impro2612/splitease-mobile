import { useState } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, RefreshControl, ActivityIndicator, Alert, FlatList,
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

export default function Groups() {
  const { user, currency: defaultCurrency } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("💰")
  const [color, setColor] = useState("#6366f1")
  const [groupCurrency, setGroupCurrency] = useState(defaultCurrency)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")

  const { data: groups = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const createMutation = useMutation({
    mutationFn: () => groupsApi.create({ name: name.trim(), description, emoji, color, currency: groupCurrency }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      setShowCreate(false)
      setName(""); setDescription(""); setEmoji("💰"); setColor("#6366f1"); setGroupCurrency(defaultCurrency)
      Toast.show({ type: "success", text1: "Group created! 🎉" })
      router.push(`/group/${res.data.id}`)
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to create group" }),
  })

  function getGroupBalance(group: any) {
    let owed = 0, owes = 0
    for (const expense of (group.expenses ?? [])) {
      const mySplit = expense.splits?.find((s: any) => s.userId === user?.id)
      if (!mySplit) continue
      if (expense.paidById === user?.id) {
        expense.splits?.forEach((s: any) => { if (s.userId !== user?.id && !s.paid) owed += s.amount })
      } else if (!mySplit.paid) {
        owes += mySplit.amount
      }
    }
    return owed - owes
  }

  return (
    <SafeAreaView className="flex-1 bg-base" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-white text-2xl font-bold">Groups</Text>
          <Text className="text-muted text-sm">{groups.length} group{groups.length !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          className="bg-primary rounded-2xl px-4 py-2.5 flex-row items-center gap-2"
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text className="text-white font-semibold text-sm">New Group</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-5"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color="#6366f1" className="mt-10" />
        ) : groups.length === 0 ? (
          <View className="items-center py-20">
            <Text className="text-6xl mb-4">👥</Text>
            <Text className="text-white text-lg font-semibold mb-2">No groups yet</Text>
            <Text className="text-muted text-sm text-center mb-6">Create a group to start splitting expenses</Text>
            <TouchableOpacity onPress={() => setShowCreate(true)} className="bg-primary rounded-2xl px-6 py-3">
              <Text className="text-white font-semibold">Create first group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="gap-3 pb-6">
            {groups.map((group: any) => {
              const balance = getGroupBalance(group)
              const gc = CURRENCIES.find(c => c.code === (group.currency ?? "USD")) ?? CURRENCIES[0]
              return (
                <TouchableOpacity
                  key={group.id}
                  onPress={() => router.push(`/group/${group.id}`)}
                  style={{ backgroundColor: "#1a1a2e", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16 }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3">
                    <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: group.color + "33", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 24 }}>{group.emoji}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-base" numberOfLines={1}>{group.name}</Text>
                      {group.description ? <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{group.description}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#475569" />
                  </View>

                  <View className="flex-row items-center justify-between mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
                    <View className="flex-row items-center gap-3">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="people-outline" size={12} color="#475569" />
                        <Text className="text-muted text-xs">{group.members?.length ?? 0}</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="receipt-outline" size={12} color="#475569" />
                        <Text className="text-muted text-xs">{group._count?.expenses ?? 0}</Text>
                      </View>
                    </View>
                    <Text style={{ color: balance > 0 ? "#4ade80" : balance < 0 ? "#f87171" : "#475569", fontWeight: "700", fontSize: 14 }}>
                      {balance > 0 ? `+${formatCurrency(balance, gc.symbol, gc.code)}` : balance < 0 ? formatCurrency(balance, gc.symbol, gc.code) : "Settled"}
                    </Text>
                  </View>

                  {/* Member avatars */}
                  <View className="flex-row mt-2" style={{ marginLeft: 2 }}>
                    {group.members?.slice(0, 5).map((m: any, i: number) => (
                      <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                        <Avatar name={m.user.name} email={m.user.email} image={m.user.image} size={24} />
                      </View>
                    ))}
                    {(group.members?.length ?? 0) > 5 && (
                      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)", marginLeft: -8, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 9, color: "#94a3b8" }}>+{group.members.length - 5}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>

      {/* Create Group Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View className="flex-1 bg-base" style={{ paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text className="text-white text-xl font-bold">Create Group</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <View style={{ marginHorizontal: 20, backgroundColor: "#1a1a2e", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: color + "33", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 26 }}>{emoji}</Text>
            </View>
            <View>
              <Text className="text-white font-semibold text-base">{name || "Group name"}</Text>
              <Text className="text-muted text-xs">{description || "No description"}</Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            {/* Name */}
            <Text className="text-slate-300 text-sm font-medium mb-2">Group name *</Text>
            <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14 }}>
              <TextInput className="text-white text-base" placeholder="e.g. NYC Trip, Apartment" placeholderTextColor="#475569" value={name} onChangeText={setName} />
            </View>

            {/* Description */}
            <Text className="text-slate-300 text-sm font-medium mb-2">Description (optional)</Text>
            <View style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14 }}>
              <TextInput className="text-white text-base" placeholder="What's this group for?" placeholderTextColor="#475569" value={description} onChangeText={setDescription} />
            </View>

            {/* Currency */}
            <Text className="text-slate-300 text-sm font-medium mb-2">Group Currency</Text>
            <TouchableOpacity
              onPress={() => setShowCurrencyPicker(true)}
              style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 16, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 20 }}>{CURRENCIES.find(c => c.code === groupCurrency)?.flag}</Text>
                <Text className="text-white text-base">{groupCurrency} — {CURRENCIES.find(c => c.code === groupCurrency)?.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#475569" />
            </TouchableOpacity>

            {/* Emoji */}
            <Text className="text-slate-300 text-sm font-medium mb-3">Icon</Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {GROUP_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: emoji === e ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)", borderWidth: emoji === e ? 2 : 1, borderColor: emoji === e ? "#6366f1" : "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Color */}
            <Text className="text-slate-300 text-sm font-medium mb-3">Color</Text>
            <View className="flex-row flex-wrap gap-2 mb-8">
              {GROUP_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: "rgba(255,255,255,0.6)" }}
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
              style={{ backgroundColor: !name.trim() ? "#374151" : "#6366f1", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}
            >
              {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Create Group</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      {/* Currency Picker Modal */}
      <Modal visible={showCurrencyPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View className="flex-1 bg-base" style={{ paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text className="text-white text-xl font-bold">Group Currency</Text>
            <TouchableOpacity onPress={() => { setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
            <Ionicons name="search" size={16} color="#475569" style={{ marginRight: 8 }} />
            <TextInput className="text-white flex-1 text-base" placeholder="Search currency..." placeholderTextColor="#475569" value={currencySearch} onChangeText={setCurrencySearch} autoCapitalize="none" />
            {currencySearch.length > 0 && <TouchableOpacity onPress={() => setCurrencySearch("")}><Ionicons name="close-circle" size={16} color="#475569" /></TouchableOpacity>}
          </View>
          <FlatList
            data={CURRENCIES.filter(c => c.code.toLowerCase().includes(currencySearch.toLowerCase()) || c.name.toLowerCase().includes(currencySearch.toLowerCase()))}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setGroupCurrency(item.code); setShowCurrencyPicker(false); setCurrencySearch("") }}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                  <Text style={{ fontSize: 16, color: "#fff", fontWeight: "600" }}>{item.symbol}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-white font-semibold">{item.code}</Text>
                  <Text className="text-muted text-xs">{item.name}</Text>
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

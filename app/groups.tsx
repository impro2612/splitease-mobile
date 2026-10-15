import { useState, useEffect } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator,
} from "react-native"
import { router } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { groupsApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { formatCurrency } from "@/lib/utils"
import { CURRENCIES } from "@/lib/currencies"
import { Avatar } from "@/components/ui/Avatar"
import { useTheme } from "@/lib/theme"
import { useOffline } from "@/context/OfflineContext"
import { getRate } from "@/lib/exchange"
import { BottomTabBar } from "@/components/ui/BottomTabBar"

export default function Groups() {
  const { user } = useAuthStore()
  const C = useTheme()
  const { isOnline } = useOffline()
  const [search, setSearch] = useState("")

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const [fxRates, setFxRates] = useState<Record<string, number>>({})

  // The server returns the caller's net balance per currency (expenses AND settlements).
  // Convert foreign-currency parts into the group's own currency for the card total.
  useEffect(() => {
    if (!groups.length) return
    const pairs: { from: string; to: string }[] = []
    for (const g of groups) {
      const defaultCode = g.currency ?? "USD"
      for (const cur of Object.keys(g.myBalance ?? {})) {
        if (cur !== defaultCode && !fxRates[`${cur}->${defaultCode}`]) pairs.push({ from: cur, to: defaultCode })
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  function getGroupBalance(group: any): number {
    const defaultCode = group.currency ?? "USD"
    let net = 0
    for (const [cur, amount] of Object.entries((group.myBalance ?? {}) as Record<string, number>)) {
      const rate = cur === defaultCode ? 1 : (fxRates[`${cur}->${defaultCode}`] ?? null)
      if (rate === null) continue
      net += amount * rate
    }
    return Math.round(net * 100) / 100
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: C.text, fontSize: 24, fontWeight: "700" }}>Groups</Text>
            <Text style={{ color: C.textSub, fontSize: 13 }}>{groups.length} group{groups.length !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity
            onPress={isOnline ? () => router.push("/create-group" as any) : undefined}
            disabled={!isOnline}
            className="bg-primary rounded-2xl px-4 py-2.5 flex-row items-center gap-2"
            style={{ opacity: isOnline ? 1 : 0.4 }}
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
              <TouchableOpacity onPress={isOnline ? () => router.push("/create-group" as any) : undefined} disabled={!isOnline} style={{ backgroundColor: "#6366f1", borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12, opacity: isOnline ? 1 : 0.4 }}>
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
      </SafeAreaView>
      <BottomTabBar />
    </View>
  )
}

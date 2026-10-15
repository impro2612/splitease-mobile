import { useState, useEffect } from "react"
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native"
import { Text, TextInput } from "@/components/ui/Typography"
import { router } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { groupsApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { describeBalance } from "@/lib/utils"
import { CURRENCIES } from "@/lib/currencies"
import { Avatar } from "@/components/ui/Avatar"
import { useTheme } from "@/lib/theme"
import { useOffline } from "@/context/OfflineContext"
import { getRate } from "@/lib/exchange"
import { EmptyState } from "@/components/ui/EmptyState"
import { SkeletonRow } from "@/components/ui/Skeleton"
import { tokens } from "@/lib/theme"

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
            <Text style={{ color: C.text, fontSize: 26, fontWeight: "800" }}>Groups</Text>
            <Text style={{ color: C.textSub, fontSize: 13 }}>{groups.length} group{groups.length !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity
            onPress={isOnline ? () => router.push("/create-group" as any) : undefined}
            disabled={!isOnline}
            style={{ backgroundColor: tokens.accent, borderRadius: tokens.radius.md, paddingHorizontal: 16, height: 42, flexDirection: "row", alignItems: "center", gap: 6, opacity: isOnline ? 1 : 0.4 }}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>New group</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
          <View style={{ backgroundColor: C.card, borderRadius: tokens.radius.md, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 46 }}>
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
            <View style={{ paddingTop: 8 }}><SkeletonRow /><SkeletonRow /><SkeletonRow /></View>
          ) : groups.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No groups yet"
              subtitle="Create a group for a trip, your flat, or anything you share costs on."
              actionLabel="Create a group"
              actionIcon="add"
              onAction={() => router.push("/create-group" as any)}
              disabled={!isOnline}
            />
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
                    style={{ backgroundColor: C.card, borderRadius: tokens.radius.lg, padding: tokens.space.lg }}
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

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
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
                      <Text style={{ color: balance > 0 ? C.positive : balance < 0 ? C.negative : C.textMuted, fontWeight: "700", fontSize: 14 }}>
                        {describeBalance(balance, gc.symbol, gc.code)}
                      </Text>
                    </View>

                    {/* Member avatars */}
                    <View style={{ flexDirection: "row", marginTop: 8, marginLeft: 2 }}>
                      {group.members?.slice(0, 5).map((m: any, i: number) => (
                        <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: 16, borderWidth: 2, borderColor: C.card }}>
                          <Avatar name={m.user.name} email={m.user.email} image={m.user.image} size={26} />
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
    </View>
  )
}

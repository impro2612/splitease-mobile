import { View, ScrollView, TouchableOpacity, RefreshControl } from "react-native"
import { Text } from "@/components/ui/Typography"
import { useState, useEffect, useCallback } from "react"
import { router } from "expo-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "@/store/auth"
import { groupsApi, dashboardApi } from "@/lib/api"
import { formatCurrency, currencySymbol } from "@/lib/utils"
import { CURRENCIES } from "@/lib/currencies"
import { Avatar } from "@/components/ui/Avatar"
import { Money } from "@/components/ui/Money"
import { Skeleton, SkeletonRow } from "@/components/ui/Skeleton"
import { SafeAreaView } from "react-native-safe-area-context"
import { tokens, useTheme } from "@/lib/theme"
import { getRate } from "@/lib/exchange"
import { ActivityFeed, type ActivityItem } from "@/components/ActivityFeed"

type Person = {
  user: { id: string; name: string | null; email: string; image: string | null }
  nets: Record<string, number> // + = they owe you
  groups: { id: string; name: string; emoji: string }[]
}

/** "₹3,475" or "₹225 + $40" — currencies are listed, never added together. */
function joinAmounts(nets: Record<string, number>, pick: (v: number) => boolean) {
  return Object.entries(nets)
    .filter(([, v]) => pick(v))
    .map(([code, v]) => formatCurrency(v, currencySymbol(code), code))
    .join(" + ")
}

export default function Home() {
  const { user, currency } = useAuthStore()
  const C = useTheme()
  const queryClient = useQueryClient()
  const display = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]
  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [refreshing, setRefreshing] = useState(false)

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
  })
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["balance-summary"],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
  })
  const { data: activityItems = [] } = useQuery<ActivityItem[]>({
    queryKey: ["activity"],
    queryFn: () => dashboardApi.activity().then((r) => r.data),
    staleTime: 0,
  })

  // Rates to express the overall position in the user's display currency
  useEffect(() => {
    if (!summary?.perCurrency) return
    const missing = Object.keys(summary.perCurrency).filter((c) => c !== display.code && !fxRates[c])
    if (missing.length === 0) return
    Promise.all(missing.map(async (cur) => ({ cur, rate: await getRate(cur, display.code) }))).then((res) => {
      setFxRates((prev) => {
        const next = { ...prev }
        for (const r of res) if (r.rate !== null) next[r.cur] = r.rate
        return next
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, display.code])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["groups"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
    ])
    setRefreshing(false)
  }, [queryClient])

  // Overall net in the display currency; currencies without a rate are listed separately
  let totalOwed = 0
  let totalOwe = 0
  const unconverted: string[] = []
  for (const [cur, { owe, owed }] of Object.entries((summary?.perCurrency ?? {}) as Record<string, { owe: number; owed: number }>)) {
    const rate = cur === display.code ? 1 : (fxRates[cur] ?? null)
    if (rate === null) {
      if (owed - owe) unconverted.push(`${owed - owe > 0 ? "+" : "−"}${formatCurrency(owed - owe, currencySymbol(cur), cur)}`)
      continue
    }
    totalOwed += owed * rate
    totalOwe += owe * rate
  }
  totalOwed = Math.round(totalOwed * 100) / 100
  totalOwe = Math.round(totalOwe * 100) / 100
  const net = Math.round((totalOwed - totalOwe) * 100) / 100
  const settled = Math.abs(net) < 0.005 && unconverted.length === 0
  const people: Person[] = summary?.people ?? []
  const owesYou = people.filter((p) => Object.values(p.nets).some((v) => v > 0))
  const youOwe = people.filter((p) => Object.values(p.nets).some((v) => v < 0))
  const activeGroups = groups.filter((g: any) => Object.keys(g.myBalance ?? {}).length > 0).length

  const openPerson = (p: Person) => {
    const g = p.groups[0]
    if (g) router.push(`/group/${g.id}` as any)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: tokens.space.xl, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.accent} />}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: "800" }} numberOfLines={1}>
              Hey, {user?.name?.split(" ")[0] ?? "there"} 👋
            </Text>
            <Text style={{ color: C.textSub, fontSize: 14, marginTop: 2 }}>Here's your overview</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)} accessibilityLabel="Profile and settings">
            <Avatar name={user?.name} email={user?.email} image={user?.image} size={44} />
          </TouchableOpacity>
        </View>

        {/* Net balance — neutral card, only the number carries colour */}
        <View style={{ backgroundColor: C.card, borderRadius: tokens.radius.xl, padding: tokens.space.xl }}>
          <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600" }}>Net balance</Text>
          {summaryLoading ? (
            <Skeleton width={190} height={36} style={{ marginTop: 10 }} />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 6 }}>
              {!settled && (
                <Text style={{ color: net < 0 ? tokens.negative : tokens.positive, fontSize: 34, fontWeight: "800" }}>{net < 0 ? "−" : "+"}</Text>
              )}
              <Money amount={net} symbol={display.symbol} code={display.code} size={36} color={settled ? C.text : net < 0 ? tokens.negative : tokens.positive} />
            </View>
          )}
          {!summaryLoading && (
            <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
              {settled ? "All settled up" : net < 0 ? "You owe others" : "Others owe you"}
              {unconverted.length ? ` · plus ${unconverted.join(", ")} (no exchange rate)` : ""}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          {[
            { label: "You're owed", icon: "trending-up" as const, value: totalOwed, color: tokens.positive, sign: "+" },
            { label: "You owe", icon: "trending-down" as const, value: totalOwe, color: tokens.negative, sign: "−" },
          ].map((c) => (
            <View key={c.label} style={{ flex: 1, backgroundColor: C.card, borderRadius: tokens.radius.lg, padding: tokens.space.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Ionicons name={c.icon} size={14} color={c.color} />
                <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500" }}>{c.label}</Text>
              </View>
              {summaryLoading ? (
                <Skeleton width={90} height={22} />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                  {c.value > 0 && <Text style={{ color: c.color, fontSize: 20, fontWeight: "800" }}>{c.sign}</Text>}
                  <Money amount={c.value} symbol={display.symbol} code={display.code} size={21} color={c.value > 0 ? c.color : C.textSub} />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* People — the actionable part */}
        {(youOwe.length > 0 || owesYou.length > 0) && (
          <View style={{ marginTop: 26 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 10 }}>People</Text>
            {[...youOwe, ...owesYou.filter((p) => !youOwe.includes(p))].map((p) => {
              const iOwe = joinAmounts(p.nets, (v) => v < 0)
              const theyOwe = joinAmounts(p.nets, (v) => v > 0)
              const name = p.user.name ?? p.user.email
              return (
                <TouchableOpacity
                  key={p.user.id}
                  onPress={() => openPerson(p)}
                  activeOpacity={0.75}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: tokens.radius.lg, padding: tokens.space.md + 2, marginBottom: 8 }}
                >
                  <Avatar name={p.user.name} email={p.user.email} image={p.user.image} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>{name}</Text>
                    {iOwe ? <Text style={{ color: tokens.negative, fontSize: 13, fontWeight: "600", marginTop: 2 }}>You owe {iOwe}</Text> : null}
                    {theyOwe ? <Text style={{ color: tokens.positive, fontSize: 13, fontWeight: "600", marginTop: 2 }}>Owes you {theyOwe}</Text> : null}
                    <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {p.groups.map((g) => `${g.emoji} ${g.name}`).join(" · ")}
                    </Text>
                  </View>
                  {iOwe ? (
                    <View style={{ backgroundColor: tokens.accentSoft, borderRadius: tokens.radius.sm, paddingHorizontal: 12, paddingVertical: 7 }}>
                      <Text style={{ color: tokens.accentText, fontSize: 12, fontWeight: "700" }}>Settle up</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* Groups shortcuts */}
        <View style={{ marginTop: 26 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: "700" }}>Your groups</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/groups" as any)}>
              <Text style={{ color: tokens.accentText, fontSize: 13, fontWeight: "600" }}>See all</Text>
            </TouchableOpacity>
          </View>
          {groupsLoading ? (
            <SkeletonRow />
          ) : groups.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push("/create-group" as any)}
              style={{ backgroundColor: C.card, borderRadius: tokens.radius.lg, padding: tokens.space.lg, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: tokens.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="add" size={22} color={tokens.accentText} />
              </View>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: "600" }}>Create your first group</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {groups.slice(0, 8).map((g: any) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => router.push(`/group/${g.id}` as any)}
                  style={{ backgroundColor: C.card, borderRadius: tokens.radius.lg, padding: tokens.space.md + 2, width: 140 }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: (g.color ?? tokens.accent) + "26", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Text style={{ fontSize: 20 }}>{g.emoji}</Text>
                  </View>
                  <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>{g.name}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{g.members?.length ?? 0} members</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Recent activity */}
        <View style={{ marginTop: 26 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: "700" }}>Recent activity</Text>
            {activityItems.length > 5 && (
              <TouchableOpacity onPress={() => router.push("/(tabs)/activity" as any)}>
                <Text style={{ color: tokens.accentText, fontSize: 13, fontWeight: "600" }}>See all</Text>
              </TouchableOpacity>
            )}
          </View>
          {activityItems.length === 0 ? (
            <Text style={{ color: C.textMuted, fontSize: 13, paddingVertical: 12 }}>Nothing yet — add an expense to get started.</Text>
          ) : (
            <ActivityFeed items={activityItems} userId={user?.id ?? ""} limit={5} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

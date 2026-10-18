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
import { usePlus } from "@/lib/plus"

type Person = {
  user: { id: string; name: string | null; email: string; image: string | null }
  nets: Record<string, number> // + = they owe you
  groups: { id: string; name: string; emoji: string; nets?: Record<string, number> }[]
}

/** "₹3,475" or "₹225 + $40" — currencies are listed, never added together. */
function joinAmounts(nets: Record<string, number>, pick: (v: number) => boolean) {
  return Object.entries(nets)
    .filter(([, v]) => pick(v))
    .map(([code, v]) => formatCurrency(v, currencySymbol(code), code))
    .join(" + ")
}

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

/** "Sunday, 19 Oct" */
function todayLabel() {
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })
}

/** Small plan badge tucked under the profile photo; tapping it opens the Plus page. */
function PlanPill({ plan }: { plan: "plus" | "trial" | "free" }) {
  const C = useTheme()
  const look = plan === "plus"
    ? { label: "SplitIT Plus", icon: "sparkles" as const, bg: tokens.accent, fg: "#ffffff", border: tokens.accent }
    : plan === "trial"
      ? { label: "Free trial", icon: "sparkles-outline" as const, bg: C.isDark ? "#25264a" : "#eef0ff", fg: C.accentText, border: tokens.accentBorder }
      : { label: "Free", icon: "lock-open-outline" as const, bg: C.card, fg: C.textSub, border: C.borderStrong }
  return (
    <TouchableOpacity
      onPress={() => router.push("/plus" as any)}
      activeOpacity={0.8}
      accessibilityLabel={`${look.label}. Open SplitIT Plus`}
      style={{
        flexDirection: "row", alignItems: "center", gap: 3, marginTop: -8,
        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
        backgroundColor: look.bg, borderWidth: 1, borderColor: look.border,
        shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
      }}
    >
      <Ionicons name={look.icon} size={9} color={look.fg} />
      <Text style={{ color: look.fg, fontSize: 9, fontWeight: "800" }} numberOfLines={1}>{look.label}</Text>
    </TouchableOpacity>
  )
}

export default function Home() {
  const { user, currency } = useAuthStore()
  const C = useTheme()
  const queryClient = useQueryClient()
  const display = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0]
  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [refreshing, setRefreshing] = useState(false)
  const { status: plus } = usePlus()
  const trialEndingSoon = plus?.plan === "trial" && plus.daysLeft != null && plus.daysLeft <= 7

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
  })
  const { data: summary, isLoading: summaryLoading, isError: summaryFailed } = useQuery({
    queryKey: ["balance-summary"],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
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
  // A failed load must not read as "₹0 · All settled up"
  const noSummary = summaryFailed && !summary
  const people: Person[] = summary?.people ?? []
  const owesYou = people.filter((p) => Object.values(p.nets).some((v) => v > 0))
  const youOwe = people.filter((p) => Object.values(p.nets).some((v) => v < 0))
  // Open the group the balance lives in: where you owe them first, then where they owe you
  const openPerson = (p: Person) => {
    const has = (pick: (v: number) => boolean) => p.groups.find((g) => Object.values(g.nets ?? {}).some(pick))
    const g = has((v) => v < 0) ?? has((v) => v > 0) ?? p.groups[0]
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
            <Text style={{ color: C.textSub, fontSize: 14 }}>{todayLabel()}</Text>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: "800", marginTop: 2 }} numberOfLines={1}>
              {greeting()}, {user?.name?.split(" ")[0] ?? "there"}
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)} accessibilityLabel="Profile and settings">
              <Avatar name={user?.name} email={user?.email} image={user?.image} size={44} />
            </TouchableOpacity>
            {plus && <PlanPill plan={plus.plan} />}
          </View>
        </View>

        {trialEndingSoon && (
          <TouchableOpacity
            onPress={() => router.push("/plus" as any)}
            activeOpacity={0.8}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 14, borderRadius: tokens.radius.lg, backgroundColor: tokens.accentSoft, borderWidth: 1, borderColor: tokens.accentBorder }}
          >
            <Ionicons name="sparkles" size={20} color={C.accentText} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: "700" }}>
                {plus!.daysLeft === 1 ? "Free Plus ends tomorrow" : `Free Plus ends in ${plus!.daysLeft} days`}
              </Text>
              <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>Splitting stays free. Keep everything else from ₹49/month.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.accentText} />
          </TouchableOpacity>
        )}

        {/* Net balance — neutral card, only the number carries colour */}
        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.xl, padding: tokens.space.xl }}>
          <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600" }}>Net balance</Text>
          {summaryLoading ? (
            <Skeleton width={190} height={36} style={{ marginTop: 10 }} />
          ) : noSummary ? (
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginTop: 8 }}>Couldn't load balances</Text>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 6 }}>
              <Money amount={net} symbol={display.symbol} code={display.code} size={36} color={settled ? C.text : net < 0 ? C.negative : C.positive} />
            </View>
          )}
          {!summaryLoading && (
            <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
              {noSummary ? "Check your connection and pull down to retry"
                : settled ? "All settled up"
                : net < 0 ? "You owe others"
                : net > 0 ? "Others owe you"
                : "Balanced in your currency"}
              {!noSummary && unconverted.length ? ` · plus ${unconverted.join(", ")} (no exchange rate)` : ""}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          {[
            { label: "You're owed", icon: "trending-up" as const, value: totalOwed, color: C.positive },
            { label: "You owe", icon: "trending-down" as const, value: totalOwe, color: C.negative },
          ].map((c) => (
            <View key={c.label} style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.lg, padding: tokens.space.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Ionicons name={c.icon} size={14} color={c.color} />
                <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500" }}>{c.label}</Text>
              </View>
              {summaryLoading ? (
                <Skeleton width={90} height={22} />
              ) : noSummary ? (
                <Text style={{ color: C.textMuted, fontSize: 21, fontWeight: "800" }}>—</Text>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "baseline" }}>
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
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.lg, padding: tokens.space.md + 2, marginBottom: 8 }}
                >
                  <Avatar name={p.user.name} email={p.user.email} image={p.user.image} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>{name}</Text>
                    {iOwe ? <Text style={{ color: C.negative, fontSize: 13, fontWeight: "600", marginTop: 2 }}>You owe {iOwe}</Text> : null}
                    {theyOwe ? <Text style={{ color: C.positive, fontSize: 13, fontWeight: "600", marginTop: 2 }}>Owes you {theyOwe}</Text> : null}
                    <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                      {p.groups.map((g) => `${g.emoji} ${g.name}`).join(" · ")}
                    </Text>
                  </View>
                  {iOwe ? (
                    <View style={{ backgroundColor: tokens.accentSoft, borderRadius: tokens.radius.sm, paddingHorizontal: 12, paddingVertical: 7 }}>
                      <Text style={{ color: C.accentText, fontSize: 12, fontWeight: "700" }}>Settle up</Text>
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
              <Text style={{ color: C.accentText, fontSize: 13, fontWeight: "600" }}>See all</Text>
            </TouchableOpacity>
          </View>
          {groupsLoading ? (
            <SkeletonRow />
          ) : groups.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push("/create-group" as any)}
              style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.lg, padding: tokens.space.lg, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: tokens.accentSoft, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="add" size={22} color={C.accentText} />
              </View>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: "600" }}>Create your first group</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {groups.slice(0, 8).map((g: any) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => router.push(`/group/${g.id}` as any)}
                  style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.lg, padding: tokens.space.md + 2, width: 140 }}
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

      </ScrollView>
    </SafeAreaView>
  )
}

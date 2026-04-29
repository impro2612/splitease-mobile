import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from "react-native"
import { useState, useEffect } from "react"
import { router } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "@/store/auth"
import { groupsApi, dashboardApi } from "@/lib/api"
import { formatCurrency, formatRelativeTime, getExpenseEmoji } from "@/lib/utils"
import { CURRENCIES } from "@/lib/currencies"
import { Avatar } from "@/components/ui/Avatar"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { getRate } from "@/lib/exchange"

type ActivityItem = {
  id: string
  type: string
  actorId: string
  targetUserId?: string | null
  groupId?: string | null
  meta: Record<string, any>
  createdAt: string
  actor: { id: string; name: string | null; image: string | null }
  targetUser?: { id: string; name: string | null; image: string | null } | null
  group?: { id: string; name: string; emoji: string; color: string } | null
}

function ActivityRow({ item, userId, C }: { item: ActivityItem; userId: string; C: any }) {
  const m = item.meta
  const isMe = item.actorId === userId
  const actorName = isMe ? "You" : (item.actor.name ?? "Someone")
  const time = formatRelativeTime(item.createdAt)

  switch (item.type) {
    case "expense_added": {
      const curr = CURRENCIES.find(c => c.code === m.currency) ?? CURRENCIES[0]
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: C.iconBg }]}>
            <Text style={{ fontSize: 18 }}>{getExpenseEmoji(m.description ?? "")}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} added "{m.description}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
              {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
          <Text style={{ color: "#a5b4fc", fontWeight: "700", fontSize: 13 }}>
            {formatCurrency(m.amount, curr.symbol, curr.code)}
          </Text>
        </View>
      )
    }

    case "expense_edited": {
      const curr = CURRENCIES.find(c => c.code === m.currency) ?? CURRENCIES[0]
      const expenseName = m.newDescription ?? m.description
      const fmtD = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      const changed = m.oldDescription && m.newDescription
        ? `"${m.oldDescription}" → "${m.newDescription}"`
        : m.oldAmount != null && m.newAmount != null
          ? `${formatCurrency(m.oldAmount, curr.symbol, curr.code)} → ${formatCurrency(m.newAmount, curr.symbol, curr.code)}`
          : m.oldPaidByName != null && m.newPaidByName != null
            ? `${m.oldPaidByName} → ${m.newPaidByName}`
            : m.oldDate && m.newDate
              ? `${fmtD(m.oldDate)} → ${fmtD(m.newDate)}`
              : m.oldCurrency && m.newCurrency
                ? `${m.oldCurrency} → ${m.newCurrency}`
                : `"${expenseName}"`
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(245,158,11,0.12)" }]}>
            <Ionicons name="create-outline" size={18} color="#fbbf24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} edited {changed}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              "{m.newDescription ?? m.description}" · {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
        </View>
      )
    }

    case "expense_deleted": {
      const curr = CURRENCIES.find(c => c.code === m.currency) ?? CURRENCIES[0]
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(244,63,94,0.12)" }]}>
            <Ionicons name="trash-outline" size={18} color="#f87171" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} deleted "{m.description}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
              {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
          <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 13 }}>
            -{formatCurrency(m.amount, curr.symbol, curr.code)}
          </Text>
        </View>
      )
    }

    case "settlement": {
      const curr = CURRENCIES.find(c => c.code === m.currency) ?? CURRENCIES[0]
      const toName = m.toUserName ?? item.targetUser?.name ?? "someone"
      const isTarget = item.targetUserId === userId
      const desc = isMe
        ? `You settled with ${toName}`
        : isTarget
          ? `${actorName} settled with you`
          : `${actorName} settled with ${toName}`
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(34,197,94,0.12)" }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#4ade80" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>{desc}</Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
              {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
          <Text style={{ color: "#4ade80", fontWeight: "700", fontSize: 13 }}>
            {formatCurrency(m.amount, curr.symbol, curr.code)}
          </Text>
        </View>
      )
    }

    case "group_created": {
      const emoji = item.group?.emoji ?? m.groupEmoji ?? "💰"
      const name = item.group?.name ?? m.groupName ?? "a group"
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
            <Text style={{ fontSize: 18 }}>{emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} created group "{name}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
          <Ionicons name="people-outline" size={18} color="#a5b4fc" />
        </View>
      )
    }

    case "group_renamed": {
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
            <Text style={{ fontSize: 18 }}>{item.group?.emoji ?? m.groupEmoji ?? "💰"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} renamed "{m.oldName}" → "{m.newName}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "group_deleted": {
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(244,63,94,0.12)" }]}>
            <Ionicons name="trash-outline" size={18} color="#f87171" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} deleted group "{m.groupName}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "member_joined": {
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(34,197,94,0.1)" }]}>
            <Ionicons name="person-add-outline" size={18} color="#4ade80" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} joined {item.group?.name ?? m.groupName}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "friend_request_sent": {
      const toName = m.toUserName ?? item.targetUser?.name ?? "someone"
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
            <Ionicons name="person-add-outline" size={18} color="#a5b4fc" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {isMe ? `You sent a friend request to ${toName}` : `${actorName} sent you a friend request`}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "friend_accepted": {
      const otherName = isMe
        ? (item.targetUser?.name ?? "someone")
        : actorName
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(34,197,94,0.12)" }]}>
            <Ionicons name="people-outline" size={18} color="#4ade80" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {isMe ? `You and ${otherName} are now friends` : `${actorName} accepted your friend request`}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "smart_debts_toggled": {
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
            <Ionicons name="git-network-outline" size={18} color="#a5b4fc" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} {m.enabled ? "enabled" : "disabled"} smart debts
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
              {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
        </View>
      )
    }

    default:
      return null
  }
}

const rowStyle = (C: any) => ({
  backgroundColor: C.card,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: C.border,
  padding: 14,
  marginBottom: 8,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
})

const iconBox = {
  width: 40,
  height: 40,
  borderRadius: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
}

export default function Dashboard() {
  const { user, currency } = useAuthStore()
  const C = useTheme()
  const currencyInfo = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0]

  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const { data: summary } = useQuery({
    queryKey: ["balance-summary"],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
  })

  const { data: activityItems = [] } = useQuery<ActivityItem[]>({
    queryKey: ["activity"],
    queryFn: () => dashboardApi.activity().then((r) => r.data),
    staleTime: 0,
  })

  useEffect(() => {
    if (!summary?.perCurrency) return
    const displayCode = currency ?? "USD"
    const nonDefault = Object.keys(summary.perCurrency).filter(
      (c) => c !== displayCode && !fxRates[c]
    )
    if (nonDefault.length === 0) return
    Promise.all(
      nonDefault.map(async (cur) => ({ currency: cur, rate: await getRate(cur, displayCode) }))
    ).then((results) => {
      setFxRates((prev) => {
        const next = { ...prev }
        for (const r of results) if (r.rate !== null) next[r.currency] = r.rate
        return next
      })
    })
  }, [summary, currency])

  let totalOwed = 0
  let totalOwe = 0
  if (summary?.perCurrency) {
    const displayCode = currency ?? "USD"
    for (const [cur, { owe, owed }] of Object.entries(summary.perCurrency as Record<string, { owe: number; owed: number }>)) {
      const rate = cur === displayCode ? 1 : (fxRates[cur] ?? null)
      if (rate === null) continue
      totalOwe += owe * rate
      totalOwed += owed * rate
    }
  }
  const net = totalOwed - totalOwe

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: "700" }}>
            Hey, {user?.name?.split(" ")[0] ?? "there"} 👋
          </Text>
          <Text style={{ color: C.textSub, fontSize: 13, marginTop: 2 }}>Here's your overview</Text>
        </View>
        <Avatar name={user?.name} email={user?.email} image={user?.image} size={42} />
      </View>

      {/* Balance cards */}
      <View style={{ paddingHorizontal: 20, marginTop: 10, gap: 8 }}>
        <View style={{ backgroundColor: net >= 0 ? "rgba(34,197,94,0.1)" : "rgba(244,63,94,0.1)", borderRadius: 16, borderWidth: 1, borderColor: net >= 0 ? "rgba(34,197,94,0.2)" : "rgba(244,63,94,0.2)", padding: 14 }}>
          <Text style={{ color: C.textSub, fontSize: 10, fontWeight: "500", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Net balance</Text>
          <Text style={{ color: net >= 0 ? "#4ade80" : "#f87171", fontSize: 26, fontWeight: "800" }}>
            {net >= 0 ? "+" : "-"}{formatCurrency(Math.abs(net), currencyInfo.symbol, currencyInfo.code)}
          </Text>
          <Text style={{ color: C.textSub, fontSize: 11, marginTop: 2 }}>
            {net > 0 ? "Others owe you" : net < 0 ? "You owe others" : "All settled up! ✅"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(34,197,94,0.15)", padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <Ionicons name="trending-up" size={13} color="#4ade80" />
              <Text style={{ color: C.textSub, fontSize: 11 }}>You're owed</Text>
            </View>
            <Text style={{ color: "#4ade80", fontSize: 17, fontWeight: "700" }}>+{formatCurrency(totalOwed, currencyInfo.symbol, currencyInfo.code)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(244,63,94,0.08)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(244,63,94,0.15)", padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <Ionicons name="trending-down" size={13} color="#f87171" />
              <Text style={{ color: C.textSub, fontSize: 11 }}>You owe</Text>
            </View>
            <Text style={{ color: "#f87171", fontSize: 17, fontWeight: "700" }}>-{formatCurrency(totalOwe, currencyInfo.symbol, currencyInfo.code)}</Text>
          </View>
        </View>
      </View>

      {/* Groups quick access */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>Your Groups</Text>
          <TouchableOpacity onPress={() => router.push("/groups")}>
            <Text style={{ color: "#6366f1", fontSize: 13 }}>View all / Create</Text>
          </TouchableOpacity>
        </View>
        {isLoading ? (
          <ActivityIndicator color="#6366f1" />
        ) : groups.length === 0 ? (
          <TouchableOpacity
            onPress={() => router.push("/groups")}
            style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: "center" }}
          >
            <Text style={{ fontSize: 36, marginBottom: 8 }}>👥</Text>
            <Text style={{ color: C.textSub, fontSize: 13 }}>No groups yet — tap to create one</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
            {groups.slice(0, 6).map((g: any) => (
              <TouchableOpacity
                key={g.id}
                onPress={() => router.push(`/group/${g.id}`)}
                style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginHorizontal: 4, width: 130 }}
              >
                <Text style={{ fontSize: 28, marginBottom: 8 }}>{g.emoji}</Text>
                <Text style={{ color: C.text, fontWeight: "500", fontSize: 13 }} numberOfLines={1}>{g.name}</Text>
                <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{g.members?.length ?? 0} members</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Recent Activity */}
      <View style={{ flex: 1, marginTop: 20, paddingHorizontal: 20 }}>
        <Text style={{ color: C.text, fontWeight: "600", fontSize: 15, marginBottom: 12 }}>Recent Activity</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {activityItems.length === 0 ? (
            <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>📝</Text>
              <Text style={{ color: C.textSub, fontSize: 13 }}>No activity yet</Text>
            </View>
          ) : (
            activityItems.map((item) => (
              <ActivityRow key={item.id} item={item} userId={user?.id ?? ""} C={C} />
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

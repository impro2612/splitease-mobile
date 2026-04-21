import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from "react-native"
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

export default function Dashboard() {
  const { user, currency } = useAuthStore()
  const C = useTheme()
  const currencyInfo = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0]

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const { data: summary } = useQuery({
    queryKey: ["balance-summary", currency],
    queryFn: () => dashboardApi.summary(currency).then((r) => r.data),
  })

  const totalOwed: number = summary?.totalOwed ?? 0
  const totalOwe: number = summary?.totalOwe ?? 0
  const net: number = summary?.net ?? 0

  const activityItems: any[] = []
  for (const g of groups) {
    const gc = CURRENCIES.find((c: any) => c.code === (g.currency ?? "USD")) ?? CURRENCIES[0]
    for (const e of (g.expenses ?? [])) {
      activityItems.push({ type: "expense", date: e.createdAt, expense: e, group: g, gc })
    }
    activityItems.push({ type: "group_created", date: g.createdAt, group: g, gc })
    for (const m of (g.members ?? [])) {
      const joinedAt = new Date(m.joinedAt).getTime()
      const createdAt = new Date(g.createdAt).getTime()
      if (Math.abs(joinedAt - createdAt) > 5000) {
        activityItems.push({ type: "member_joined", date: m.joinedAt, member: m, group: g, gc })
      }
    }
  }

  const recentActivity = activityItems
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15)

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
            {net >= 0 ? "+" : "-"}{formatCurrency(net, currencyInfo.symbol, currencyInfo.code)}
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
          <TouchableOpacity onPress={() => router.push("/(tabs)/groups")}>
            <Text style={{ color: "#6366f1", fontSize: 13 }}>View all</Text>
          </TouchableOpacity>
        </View>
        {isLoading ? (
          <ActivityIndicator color="#6366f1" />
        ) : groups.length === 0 ? (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/groups")}
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
          {recentActivity.length === 0 ? (
            <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>📝</Text>
              <Text style={{ color: C.textSub, fontSize: 13 }}>No activity yet</Text>
            </View>
          ) : (
            recentActivity.map((item: any) => {
              if (item.type === "expense") {
                const expense = item.expense
                const expCurr = CURRENCIES.find((c: any) => c.code === (expense.currency ?? item.gc.code)) ?? item.gc
                const mySplit = expense.splits?.find((s: any) => s.userId === user?.id)
                const isPayer = expense.paidById === user?.id
                const myNet = isPayer ? expense.amount - (mySplit?.amount ?? 0) : -(mySplit?.amount ?? 0)
                return (
                  <View key={`exp-${expense.id}`} style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 18 }}>{getExpenseEmoji(expense.description)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>{expense.description}</Text>
                      <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{item.group.name} · {formatRelativeTime(expense.createdAt)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: myNet >= 0 ? "#4ade80" : "#f87171", fontWeight: "700", fontSize: 14 }}>
                        {myNet >= 0 ? "+" : "-"}{formatCurrency(Math.abs(myNet), expCurr.symbol, expCurr.code)}
                      </Text>
                      <Text style={{ color: C.textSub, fontSize: 12 }}>{formatCurrency(expense.amount, expCurr.symbol, expCurr.code)}</Text>
                    </View>
                  </View>
                )
              }
              if (item.type === "group_created") {
                return (
                  <View key={`grp-${item.group.id}`} style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: item.group.color + "33", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 18 }}>{item.group.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>Group "{item.group.name}" created</Text>
                      <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{item.gc.code} · {formatRelativeTime(item.group.createdAt)}</Text>
                    </View>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="people" size={18} color="#a5b4fc" />
                    </View>
                  </View>
                )
              }
              if (item.type === "member_joined") {
                return (
                  <View key={`mem-${item.group.id}-${item.member.userId}`} style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(34,197,94,0.1)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="person-add" size={18} color="#4ade80" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
                        {item.member.user?.name ?? item.member.user?.email ?? "Someone"} joined {item.group.name}
                      </Text>
                      <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{formatRelativeTime(item.member.joinedAt)}</Text>
                    </View>
                  </View>
                )
              }
              return null
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

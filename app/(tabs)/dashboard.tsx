import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native"
import { router } from "expo-router"
import { useQuery } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "@/store/auth"
import { groupsApi, dashboardApi } from "@/lib/api"
import { formatCurrency, formatRelativeTime, CATEGORY_ICONS } from "@/lib/utils"
import { Avatar } from "@/components/ui/Avatar"
import { SafeAreaView } from "react-native-safe-area-context"

export default function Dashboard() {
  const { user } = useAuthStore()

  const { data: groups = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list().then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["balance-summary"],
    queryFn: () => dashboardApi.summary().then((r) => r.data),
  })

  const totalOwed: number = summary?.totalOwed ?? 0
  const totalOwe: number = summary?.totalOwe ?? 0
  const net: number = summary?.net ?? 0

  const handleRefresh = () => {
    refetch()
    refetchSummary()
  }

  // Recent expenses across all groups (last 10)
  const allExpenses = groups
    .flatMap((g: any) => (g.expenses ?? []).map((e: any) => ({ ...e, groupName: g.name })))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  return (
    <SafeAreaView className="flex-1 bg-base" edges={["top"]}>
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-white text-2xl font-bold">
              Hey, {user?.name?.split(" ")[0] ?? "there"} 👋
            </Text>
            <Text className="text-muted text-sm mt-0.5">Here's your overview</Text>
          </View>
          <Avatar name={user?.name} email={user?.email} image={user?.image} size={42} />
        </View>

        {/* Balance cards */}
        <View className="px-5 mt-4 gap-3">
          {/* Net balance */}
          <View
            style={{ backgroundColor: net >= 0 ? "rgba(34,197,94,0.1)" : "rgba(244,63,94,0.1)", borderRadius: 20, borderWidth: 1, borderColor: net >= 0 ? "rgba(34,197,94,0.2)" : "rgba(244,63,94,0.2)", padding: 20 }}
          >
            <Text className="text-muted text-xs font-medium uppercase tracking-wider mb-1">Net balance</Text>
            <Text style={{ color: net >= 0 ? "#4ade80" : "#f87171", fontSize: 34, fontWeight: "800" }}>
              {net >= 0 ? "+" : ""}{formatCurrency(net)}
            </Text>
            <Text className="text-muted text-xs mt-1">
              {net > 0 ? "Others owe you" : net < 0 ? "You owe others" : "All settled up! ✅"}
            </Text>
          </View>

          {/* Owed / Owes row */}
          <View className="flex-row gap-3">
            <View style={{ flex: 1, backgroundColor: "rgba(34,197,94,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(34,197,94,0.15)", padding: 16 }}>
              <View className="flex-row items-center gap-1.5 mb-1">
                <Ionicons name="trending-up" size={14} color="#4ade80" />
                <Text className="text-muted text-xs">You're owed</Text>
              </View>
              <Text style={{ color: "#4ade80", fontSize: 20, fontWeight: "700" }}>+{formatCurrency(totalOwed)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "rgba(244,63,94,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(244,63,94,0.15)", padding: 16 }}>
              <View className="flex-row items-center gap-1.5 mb-1">
                <Ionicons name="trending-down" size={14} color="#f87171" />
                <Text className="text-muted text-xs">You owe</Text>
              </View>
              <Text style={{ color: "#f87171", fontSize: 20, fontWeight: "700" }}>-{formatCurrency(totalOwe)}</Text>
            </View>
          </View>
        </View>

        {/* Groups quick access */}
        <View className="px-5 mt-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white font-semibold text-base">Your Groups</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/groups")}>
              <Text className="text-primary text-sm">View all</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color="#6366f1" />
          ) : groups.length === 0 ? (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/groups")}
              style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 24, alignItems: "center" }}
            >
              <Text className="text-4xl mb-2">👥</Text>
              <Text className="text-muted text-sm">No groups yet — tap to create one</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              {groups.slice(0, 6).map((g: any) => (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => router.push(`/group/${g.id}`)}
                  style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14, marginHorizontal: 4, width: 130 }}
                >
                  <Text className="text-2xl mb-2">{g.emoji}</Text>
                  <Text className="text-white font-medium text-sm" numberOfLines={1}>{g.name}</Text>
                  <Text className="text-muted text-xs mt-0.5">{g.members?.length ?? 0} members</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Recent activity */}
        <View className="px-5 mt-6 mb-8">
          <Text className="text-white font-semibold text-base mb-3">Recent Activity</Text>
          {allExpenses.length === 0 ? (
            <View style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 24, alignItems: "center" }}>
              <Text className="text-4xl mb-2">📝</Text>
              <Text className="text-muted text-sm">No expenses yet</Text>
            </View>
          ) : (
            allExpenses.map((expense: any) => {
              const mySplit = expense.splits?.find((s: any) => s.userId === user?.id)
              const isPayer = expense.paidById === user?.id
              const myNet = isPayer ? expense.amount - (mySplit?.amount ?? 0) : -(mySplit?.amount ?? 0)
              return (
                <View
                  key={expense.id}
                  style={{ backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 18 }}>{CATEGORY_ICONS[expense.category] ?? "💸"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-white text-sm font-medium" numberOfLines={1}>{expense.description}</Text>
                    <Text className="text-muted text-xs mt-0.5">{expense.groupName} · {formatRelativeTime(expense.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: myNet >= 0 ? "#4ade80" : "#f87171", fontWeight: "700", fontSize: 14 }}>
                      {myNet >= 0 ? "+" : ""}{formatCurrency(myNet)}
                    </Text>
                    <Text className="text-muted text-xs">{formatCurrency(expense.amount)}</Text>
                  </View>
                </View>
              )
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

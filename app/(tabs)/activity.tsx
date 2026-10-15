import { useCallback, useState } from "react"
import { View, ScrollView, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Text } from "@/components/ui/Typography"
import { dashboardApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { tokens, useTheme } from "@/lib/theme"
import { ActivityFeed, type ActivityItem } from "@/components/ActivityFeed"
import { EmptyState } from "@/components/ui/EmptyState"
import { SkeletonRow } from "@/components/ui/Skeleton"

export default function Activity() {
  const C = useTheme()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data: items = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ["activity"],
    queryFn: () => dashboardApi.activity().then((r) => r.data),
    staleTime: 0,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ["activity"] })
    setRefreshing(false)
  }, [queryClient])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: tokens.space.xl, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: C.text, fontSize: 26, fontWeight: "800" }}>Activity</Text>
        <Text style={{ color: C.textSub, fontSize: 13, marginTop: 2 }}>Everything that happened across your groups</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: tokens.space.xl, paddingBottom: 32, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.accent} />}
      >
        {isLoading ? (
          <>{[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}</>
        ) : items.length === 0 ? (
          <EmptyState icon="pulse-outline" title="No activity yet" subtitle="Expenses, settlements and group changes will show up here." />
        ) : (
          <ActivityFeed items={items} userId={user?.id ?? ""} />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

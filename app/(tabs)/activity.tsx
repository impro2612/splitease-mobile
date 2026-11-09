import { useCallback, useState } from "react"
import { View, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Text } from "@/components/ui/Typography"
import { dashboardApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { tokens, useTheme } from "@/lib/theme"
import { ActivityFeed, type ActivityItem } from "@/components/ActivityFeed"
import { EmptyState } from "@/components/ui/EmptyState"
import { SkeletonRow } from "@/components/ui/Skeleton"
import { QueryError } from "@/components/ui/QueryError"

export default function Activity() {
  const C = useTheme()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data: items = [], isLoading, isError, refetch, isFetching } = useQuery<ActivityItem[]>({
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
      <ActivityFeed
        items={isLoading || isError ? [] : items}
        userId={user?.id ?? ""}
        contentContainerStyle={{ paddingHorizontal: tokens.space.xl, paddingBottom: 32, paddingTop: 8, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.accent} />}
        ListEmptyComponent={
          isLoading ? (
            <View>{[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}</View>
          ) : isError ? (
            <QueryError title="Couldn't load activity" onRetry={() => refetch()} retrying={isFetching} />
          ) : (
            <EmptyState icon="pulse-outline" title="No activity yet" subtitle="Expenses, settlements and group changes will show up here." />
          )
        }
      />
    </SafeAreaView>
  )
}

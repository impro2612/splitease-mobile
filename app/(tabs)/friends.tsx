import { useState } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl,
} from "react-native"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { friendsApi, usersApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"

type Tab = "friends" | "requests" | "search"

export default function Friends() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>("friends")
  const [searchQ, setSearchQ] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const { data: friendsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      // Backfill friendships from shared groups, then fetch
      await friendsApi.sync().catch(() => {})
      const r = await friendsApi.list()
      return r.data && typeof r.data === "object" && !Array.isArray(r.data) ? r.data : {}
    },
  })

  const friends: any[] = friendsData?.friends ?? []
  const incoming: any[] = friendsData?.incoming ?? []
  const outgoing: any[] = friendsData?.outgoing ?? []

  const sendMutation = useMutation({
    mutationFn: (addresseeId: string) => friendsApi.send(addresseeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] })
      Toast.show({ type: "success", text1: "Friend request sent!" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to send request" }),
  })

  const respondMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "reject" }) =>
      friendsApi.respond(id, action),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["friends"] })
      Toast.show({ type: "success", text1: vars.action === "accept" ? "Friend added!" : "Request rejected" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to respond" }),
  })

  async function doSearch() {
    if (!searchQ.trim() || searchQ.trim().length < 2) return
    setSearching(true)
    try {
      const res = await usersApi.search(searchQ.trim())
      setSearchResults(res.data)
    } catch {
      Toast.show({ type: "error", text1: "Search failed" })
    } finally {
      setSearching(false)
    }
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "friends", label: "Friends", badge: friends.length },
    { key: "requests", label: "Requests", badge: incoming.length || undefined },
    { key: "search", label: "Add" },
  ]

  return (
    <SafeAreaView className="flex-1 bg-base" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <Text className="text-white text-2xl font-bold">Friends</Text>
        <Text className="text-muted text-sm">{friends.length} friend{friends.length !== 1 ? "s" : ""}</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-5 gap-2 mb-4">
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{
              flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
              backgroundColor: tab === t.key ? "#6366f1" : "rgba(255,255,255,0.06)",
              borderRadius: 12, paddingVertical: 9, gap: 6,
            }}
          >
            <Text style={{ color: tab === t.key ? "#fff" : "#94a3b8", fontWeight: "600", fontSize: 13 }}>{t.label}</Text>
            {t.badge ? (
              <View style={{ backgroundColor: tab === t.key ? "rgba(255,255,255,0.3)" : "#6366f1", borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{t.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1 px-5"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366f1" />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Friends Tab */}
        {tab === "friends" && (
          isLoading ? (
            <ActivityIndicator color="#6366f1" className="mt-10" />
          ) : friends.length === 0 ? (
            <View className="items-center py-20">
              <Text className="text-5xl mb-4">🤝</Text>
              <Text className="text-white text-lg font-semibold mb-2">No friends yet</Text>
              <Text className="text-muted text-sm text-center mb-6">Search for people to add as friends</Text>
              <TouchableOpacity onPress={() => setTab("search")} className="bg-primary rounded-2xl px-6 py-3">
                <Text className="text-white font-semibold">Find friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-2 pb-6">
              {friends.map((f: any) => {
                const other = f.requesterId === user?.id ? f.addressee : f.requester
                return (
                  <View
                    key={f.id}
                    style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                  >
                    <Avatar name={other?.name} email={other?.email} image={other?.image} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text className="text-white font-semibold">{other?.name ?? "Unknown"}</Text>
                      <Text className="text-muted text-xs">{other?.email}</Text>
                    </View>
                    <View style={{ backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "600" }}>Friends</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )
        )}

        {/* Requests Tab */}
        {tab === "requests" && (
          <View className="gap-4 pb-6">
            {incoming.length > 0 && (
              <View>
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Incoming ({incoming.length})</Text>
                <View className="gap-2">
                  {incoming.map((r: any) => (
                    <View
                      key={r.id}
                      style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.2)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      <Avatar name={r.requester?.name} email={r.requester?.email} image={r.requester?.image} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text className="text-white font-semibold">{r.requester?.name}</Text>
                        <Text className="text-muted text-xs">{r.requester?.email}</Text>
                      </View>
                      <View className="flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => respondMutation.mutate({ id: r.id, action: "accept" })}
                          disabled={respondMutation.isPending}
                          style={{ backgroundColor: "#6366f1", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}
                        >
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => respondMutation.mutate({ id: r.id, action: "reject" })}
                          disabled={respondMutation.isPending}
                          style={{ backgroundColor: "rgba(244,63,94,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}
                        >
                          <Ionicons name="close" size={16} color="#f87171" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {outgoing.length > 0 && (
              <View>
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Sent ({outgoing.length})</Text>
                <View className="gap-2">
                  {outgoing.map((r: any) => (
                    <View
                      key={r.id}
                      style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      <Avatar name={r.addressee?.name} email={r.addressee?.email} image={r.addressee?.image} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text className="text-white font-semibold">{r.addressee?.name}</Text>
                        <Text className="text-muted text-xs">{r.addressee?.email}</Text>
                      </View>
                      <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "600" }}>Pending</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {incoming.length === 0 && outgoing.length === 0 && (
              <View className="items-center py-20">
                <Text className="text-5xl mb-4">📬</Text>
                <Text className="text-white text-lg font-semibold mb-2">No requests</Text>
                <Text className="text-muted text-sm text-center">Friend requests will appear here</Text>
              </View>
            )}
          </View>
        )}

        {/* Search/Add Tab */}
        {tab === "search" && (
          <View className="pb-6">
            <View className="flex-row gap-2 mb-4">
              <View style={{ flex: 1, backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 50 }}>
                <Ionicons name="search" size={16} color="#475569" style={{ marginRight: 8 }} />
                <TextInput
                  className="text-white flex-1 text-base"
                  placeholder="Search by name or email…"
                  placeholderTextColor="#475569"
                  value={searchQ}
                  onChangeText={setSearchQ}
                  onSubmitEditing={doSearch}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {searchQ.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQ(""); setSearchResults([]) }}>
                    <Ionicons name="close-circle" size={16} color="#475569" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={doSearch}
                style={{ backgroundColor: "#6366f1", borderRadius: 14, width: 50, alignItems: "center", justifyContent: "center" }}
              >
                {searching ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="search" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 && (
              <View className="gap-2">
                {searchResults.map((u: any) => {
                  const alreadyFriend = friends.some((f: any) =>
                    f.requesterId === u.id || f.addresseeId === u.id
                  )
                  const sentRequest = outgoing.some((r: any) => r.addresseeId === u.id)
                  const isMe = u.id === user?.id
                  return (
                    <View
                      key={u.id}
                      style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      <Avatar name={u.name} email={u.email} image={u.image} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text className="text-white font-semibold">{u.name}</Text>
                        <Text className="text-muted text-xs">{u.email}</Text>
                      </View>
                      {isMe ? (
                        <Text className="text-muted text-xs">You</Text>
                      ) : alreadyFriend ? (
                        <View style={{ backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "600" }}>Friends</Text>
                        </View>
                      ) : sentRequest ? (
                        <View style={{ backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "600" }}>Sent</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => sendMutation.mutate(u.id)}
                          disabled={sendMutation.isPending}
                          style={{ backgroundColor: "#6366f1", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4 }}
                        >
                          <Ionicons name="person-add" size={13} color="#fff" />
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
              </View>
            )}

            {searchResults.length === 0 && searchQ.length >= 2 && !searching && (
              <View className="items-center py-16">
                <Text className="text-4xl mb-3">🔍</Text>
                <Text className="text-white font-semibold mb-1">No results</Text>
                <Text className="text-muted text-sm text-center">No users found for "{searchQ}"</Text>
              </View>
            )}

            {searchQ.length === 0 && (
              <View className="items-center py-16">
                <Text className="text-4xl mb-3">👤</Text>
                <Text className="text-white font-semibold mb-1">Find people</Text>
                <Text className="text-muted text-sm text-center">Search by name or email address</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

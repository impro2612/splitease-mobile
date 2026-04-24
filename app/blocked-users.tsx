import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { blocksApi } from "@/lib/api"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"
import { useState } from "react"
import { Modal, Pressable } from "react-native"

export default function BlockedUsers() {
  const C = useTheme()
  const queryClient = useQueryClient()
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["blocks"],
    queryFn: () => blocksApi.list().then((r) => r.data),
    staleTime: 0,
  })

  const blocks: any[] = data?.blocks ?? []

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => blocksApi.unblock(userId),
    onSuccess: () => {
      refetch()
      queryClient.invalidateQueries({ queryKey: ["friends"] })
      setConfirmTarget(null)
      Toast.show({ type: "success", text1: "User unblocked" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to unblock" }),
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 18 }}>Blocked Users</Text>
          {!isLoading && (
            <Text style={{ color: C.textSub, fontSize: 12 }}>{blocks.length} {blocks.length === 1 ? "person" : "people"} blocked</Text>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 10 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 60 }} />
        ) : blocks.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="ban" size={34} color="#f87171" />
            </View>
            <Text style={{ color: C.text, fontWeight: "700", fontSize: 17, marginBottom: 6 }}>No blocked users</Text>
            <Text style={{ color: C.textSub, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
              Users you block will appear here.{"\n"}You can unblock them at any time.
            </Text>
          </View>
        ) : (
          blocks.map((b: any) => (
            <View
              key={b.id}
              style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Avatar name={b.blocked?.name} email={b.blocked?.email} image={b.blocked?.image} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>{b.blocked?.name ?? "Unknown"}</Text>
                <Text style={{ color: C.textSub, fontSize: 12 }} numberOfLines={1}>{b.blocked?.email}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setConfirmTarget({ id: b.blocked?.id, name: b.blocked?.name ?? "this user" })}
                disabled={unblockMutation.isPending}
                style={{ backgroundColor: "rgba(244,63,94,0.12)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(244,63,94,0.2)" }}
              >
                <Text style={{ color: "#f87171", fontWeight: "600", fontSize: 13 }}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Unblock confirmation modal */}
      <Modal visible={!!confirmTarget} transparent animationType="fade" onRequestClose={() => setConfirmTarget(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 28 }} onPress={() => setConfirmTarget(null)}>
          <Pressable style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border }} onPress={() => {}}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name="ban" size={26} color="#f87171" />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>Unblock User</Text>
            <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>
              Unblock <Text style={{ color: C.text, fontWeight: "600" }}>{confirmTarget?.name}</Text>? They will be able to find and message you again.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setConfirmTarget(null)}
                disabled={unblockMutation.isPending}
                style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmTarget && unblockMutation.mutate(confirmTarget.id)}
                disabled={unblockMutation.isPending}
                style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}
              >
                {unblockMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Unblock</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

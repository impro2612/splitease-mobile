import { useState } from "react"
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { blocksApi } from "@/lib/api"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"

export default function BlockedUsers() {
  const C = useTheme()
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["blocks"],
    queryFn: () => blocksApi.list().then((r) => r.data),
  })

  const blocks: any[] = data?.blocks ?? []

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => blocksApi.unblock(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks"] })
      queryClient.invalidateQueries({ queryKey: ["friends"] })
      Toast.show({ type: "success", text1: "User unblocked" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to unblock" }),
  })

  function confirmUnblock(userId: string, name: string) {
    Alert.alert(
      "Unblock User",
      `Unblock ${name}? They will be able to find and message you again.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unblock", onPress: () => unblockMutation.mutate(userId) },
      ]
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 18 }}>Blocked Users</Text>
          <Text style={{ color: C.textSub, fontSize: 12 }}>{blocks.length} blocked</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 16, paddingBottom: 32, gap: 10 }}>
          {isLoading ? (
            <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
          ) : blocks.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🚫</Text>
              <Text style={{ color: C.text, fontWeight: "700", fontSize: 16, marginBottom: 6 }}>No blocked users</Text>
              <Text style={{ color: C.textSub, fontSize: 13, textAlign: "center" }}>
                Users you block will appear here
              </Text>
            </View>
          ) : (
            blocks.map((b: any) => (
              <View
                key={b.id}
                style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Avatar name={b.blocked?.name} email={b.blocked?.email} image={b.blocked?.image} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{b.blocked?.name ?? "Unknown"}</Text>
                  <Text style={{ color: C.textSub, fontSize: 12 }}>{b.blocked?.email}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => confirmUnblock(b.blocked?.id, b.blocked?.name ?? "this user")}
                  disabled={unblockMutation.isPending}
                  style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
                >
                  <Text style={{ color: "#a5b4fc", fontWeight: "600", fontSize: 13 }}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

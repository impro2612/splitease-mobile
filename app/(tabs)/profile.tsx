import { useState } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Switch,
} from "react-native"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"

export default function Profile() {
  const { user, signOut, setUser } = useAuthStore()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? "")
  const [notifications, setNotifications] = useState(true)

  const updateMutation = useMutation({
    mutationFn: () => api.patch("/api/auth/me", { name: name.trim() }),
    onSuccess: (res) => {
      setUser(res.data)
      setEditing(false)
      Toast.show({ type: "success", text1: "Profile updated!" })
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to update profile" }),
  })

  function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut()
          queryClient.clear()
        },
      },
    ])
  }

  const stats = [
    { label: "Groups", icon: "people", value: "—" },
    { label: "Expenses", icon: "receipt", value: "—" },
    { label: "Settled", icon: "checkmark-circle", value: "—" },
  ]

  return (
    <SafeAreaView className="flex-1 bg-base" edges={["top"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-3">
          <Text className="text-white text-2xl font-bold">Profile</Text>
        </View>

        {/* Avatar + Info Card */}
        <View className="px-5 mb-4">
          <View
            style={{ backgroundColor: "#1a1a2e", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 20, alignItems: "center" }}
          >
            <View style={{ position: "relative", marginBottom: 14 }}>
              <Avatar name={user?.name} email={user?.email} image={user?.image} size={80} />
              <View style={{ position: "absolute", bottom: 0, right: 0, backgroundColor: "#6366f1", borderRadius: 12, padding: 5, borderWidth: 2, borderColor: "#0a0a1a" }}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </View>

            {editing ? (
              <View className="w-full gap-3">
                <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingHorizontal: 14, height: 48, justifyContent: "center" }}>
                  <TextInput
                    className="text-white text-base"
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => { setEditing(false); setName(user?.name ?? "") }}
                    style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, height: 42, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text className="text-muted font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateMutation.mutate()}
                    disabled={!name.trim() || updateMutation.isPending}
                    style={{ flex: 1, backgroundColor: "#6366f1", borderRadius: 12, height: 42, alignItems: "center", justifyContent: "center" }}
                  >
                    {updateMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white font-semibold">Save</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Text className="text-white text-xl font-bold mb-1">{user?.name ?? "—"}</Text>
                <Text className="text-muted text-sm mb-4">{user?.email}</Text>
                <TouchableOpacity
                  onPress={() => setEditing(true)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }}
                >
                  <Ionicons name="pencil" size={14} color="#a5b4fc" />
                  <Text style={{ color: "#a5b4fc", fontWeight: "600", fontSize: 13 }}>Edit Profile</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Settings */}
        <View className="px-5 mb-4">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">Preferences</Text>
          <View style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="notifications" size={18} color="#a5b4fc" />
              </View>
              <Text className="text-white flex-1">Push Notifications</Text>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: "#374151", true: "#6366f1" }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(34,197,94,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="card" size={18} color="#4ade80" />
              </View>
              <Text className="text-white flex-1">Default Currency</Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-muted text-sm">USD</Text>
                <Ionicons name="chevron-forward" size={14} color="#475569" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(6,182,212,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="color-palette" size={18} color="#22d3ee" />
              </View>
              <Text className="text-white flex-1">Appearance</Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-muted text-sm">Dark</Text>
                <Ionicons name="chevron-forward" size={14} color="#475569" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View className="px-5 mb-4">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 ml-1">About</Text>
          <View style={{ backgroundColor: "#1a1a2e", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(245,158,11,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="star" size={18} color="#fcd34d" />
              </View>
              <Text className="text-white flex-1">Rate SplitEase</Text>
              <Ionicons name="chevron-forward" size={14} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(139,92,246,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="shield-checkmark" size={18} color="#c084fc" />
              </View>
              <Text className="text-white flex-1">Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={14} color="#475569" />
            </TouchableOpacity>

            <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="information-circle" size={18} color="#94a3b8" />
              </View>
              <Text className="text-white flex-1">Version</Text>
              <Text className="text-muted text-sm">1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <View className="px-5 mb-10">
          <TouchableOpacity
            onPress={handleSignOut}
            style={{ backgroundColor: "rgba(244,63,94,0.12)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(244,63,94,0.2)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 }}
          >
            <Ionicons name="log-out-outline" size={18} color="#f87171" />
            <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 15 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

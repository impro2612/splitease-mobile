import { useState } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Switch, Modal, FlatList,
} from "react-native"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"
import { CURRENCIES } from "@/lib/currencies"

export default function Profile() {
  const { user, signOut, setUser, currency, setCurrency } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? "")
  const [notifications, setNotifications] = useState(true)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

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
    setShowSignOutConfirm(true)
  }

  async function doSignOut() {
    setShowSignOutConfirm(false)
    await signOut()
    queryClient.clear()
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

            <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(34,197,94,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="card" size={18} color="#4ade80" />
              </View>
              <Text className="text-white flex-1">Default Currency</Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-muted text-sm">{currency}</Text>
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

      {/* Currency Picker Modal */}
      <Modal visible={showCurrencyPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View className="flex-1 bg-base" style={{ paddingTop: insets.top + 16 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text className="text-white text-xl font-bold">Select Currency</Text>
            <TouchableOpacity onPress={() => { setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1a1a2e", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
            <Ionicons name="search" size={16} color="#475569" style={{ marginRight: 8 }} />
            <TextInput
              className="text-white flex-1 text-base"
              placeholder="Search currency..."
              placeholderTextColor="#475569"
              value={currencySearch}
              onChangeText={setCurrencySearch}
              autoCapitalize="none"
            />
            {currencySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCurrencySearch("")}>
                <Ionicons name="close-circle" size={16} color="#475569" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={CURRENCIES.filter(c =>
              c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
              c.name.toLowerCase().includes(currencySearch.toLowerCase())
            )}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setCurrency(item.code); setShowCurrencyPicker(false); setCurrencySearch("") }}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                  <Text style={{ fontSize: 16, color: "#fff", fontWeight: "600" }}>{item.symbol}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text className="text-white font-semibold">{item.code}</Text>
                  <Text className="text-muted text-xs">{item.name}</Text>
                </View>
                <Text style={{ fontSize: 24, marginRight: currency === item.code ? 8 : 0 }}>{item.flag}</Text>
                {currency === item.code && (
                  <Ionicons name="checkmark-circle" size={20} color="#6366f1" />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Sign Out Confirm Dialog */}
      <Modal visible={showSignOutConfirm} transparent animationType="fade" onRequestClose={() => setShowSignOutConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: "#1a1a2e", borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name="log-out-outline" size={26} color="#f87171" />
            </View>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>Sign Out</Text>
            <Text style={{ color: "#94a3b8", fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>Are you sure you want to sign out?</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowSignOutConfirm(false)}
                style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: "#94a3b8", fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doSignOut}
                style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

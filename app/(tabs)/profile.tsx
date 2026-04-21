import React, { useState, useEffect } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Switch, Modal, FlatList, Image,
} from "react-native"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import * as ImagePicker from "expo-image-picker"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import { useAuthStore, type ThemePref } from "@/store/auth"
import { api, authApi, pushApi } from "@/lib/api"
import { Avatar } from "@/components/ui/Avatar"
import Toast from "react-native-toast-message"
import { CURRENCIES } from "@/lib/currencies"
import { useTheme } from "@/lib/theme"

const NOTIF_PREF_KEY = "notifications_enabled"

const PRIVACY_POLICY = `SPLITEASE PRIVACY POLICY
Last updated: April 18, 2026

1. INFORMATION WE COLLECT
We collect information you provide directly: name, email address, phone number, and profile photo. We also collect expense data, group memberships, and payment settlement records you create within the app.

2. HOW WE USE YOUR INFORMATION
Your information is used solely to operate the SplitEase service — to calculate balances, send notifications about shared expenses, and facilitate settlements between group members. We do not sell, rent, or share your personal data with third parties for marketing purposes.

3. DATA STORAGE & SECURITY
All data is stored on secured servers. Passwords are hashed using bcrypt and never stored in plain text. Profile photos are stored as encrypted data within our database. We use industry-standard TLS encryption for all data in transit.

4. PUSH NOTIFICATIONS
With your permission, we send push notifications for new expenses, payment requests, and settlement confirmations. You can disable notifications at any time from the Profile screen or your device settings.

5. CHAT & MESSAGES
All direct messages between users are end-to-end encrypted using AES-256 encryption. SplitEase cannot read the content of your private messages.

6. DATA SHARING
We share data only with:
• Service providers necessary to operate the app (hosting, notification delivery)
• Other group members — only the information required for expense splitting (name, profile photo)
We never share your data with advertisers or data brokers.

7. DATA RETENTION
Your data is retained as long as your account is active. You may request deletion of your account and all associated data by contacting support. Deleted data is permanently removed within 30 days.

8. YOUR RIGHTS
You have the right to: access your personal data, correct inaccurate data, request deletion, and withdraw consent for notifications at any time.

9. CHILDREN'S PRIVACY
SplitEase is not directed to children under 13. We do not knowingly collect information from children under 13.

10. CHANGES TO THIS POLICY
We will notify you of material changes to this policy via in-app notification. Continued use of the app after changes constitutes acceptance.

11. CONTACT
For privacy questions or data requests, contact us at: privacy@splitease.app`

export default function Profile() {
  const { user, signOut, setUser, currency, setCurrency, theme, setTheme } = useAuthStore()
  const queryClient = useQueryClient()
  const insets = useSafeAreaInsets()
  const C = useTheme()

  // Notifications
  const [notifications, setNotifications] = useState(true)
  useEffect(() => {
    AsyncStorage.getItem(NOTIF_PREF_KEY).then((val) => {
      if (val !== null) setNotifications(val === "true")
    })
  }, [])

  // Currency picker
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")

  // Edit profile modal
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState(user?.name ?? "")
  const [editEmail, setEditEmail] = useState(user?.email ?? "")
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  // Appearance picker
  const [showAppearance, setShowAppearance] = useState(false)

  // Privacy Policy modal
  const [showPrivacy, setShowPrivacy] = useState(false)

  // Sign out confirm
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  // Delete account confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const deleteAccountMutation = useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: async () => {
      setShowDeleteConfirm(false)
      queryClient.clear()
      await signOut()
    },
    onError: () => Toast.show({ type: "error", text1: "Failed to delete account" }),
  })

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  async function handleNotificationsToggle(enabled: boolean) {
    setNotifications(enabled)
    await AsyncStorage.setItem(NOTIF_PREF_KEY, String(enabled))
    if (enabled) {
      if (!Device.isDevice) return
      const { status: existing } = await Notifications.getPermissionsAsync()
      const { status } = existing === "granted"
        ? { status: existing }
        : await Notifications.requestPermissionsAsync()
      if (status !== "granted") { setNotifications(false); return }
      const token = await Notifications.getExpoPushTokenAsync().catch(() => null)
      if (token?.data) await pushApi.saveToken(token.data).catch(() => {})
    } else {
      await pushApi.clearToken().catch(() => {})
    }
  }

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Toast.show({ type: "error", text1: "Permission required", text2: "Allow photo access to set a profile picture" })
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.35,
      base64: true,
    })
    if (result.canceled || !result.assets?.[0]?.base64) return

    setUploadingAvatar(true)
    try {
      const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`
      const res = await api.patch("/api/auth/me", { image: dataUrl })
      setUser(res.data)
      Toast.show({ type: "success", text1: "Profile photo updated!" })
    } catch {
      Toast.show({ type: "error", text1: "Failed to upload photo" })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, any> = {}
      if (editName.trim() !== (user?.name ?? "")) body.name = editName.trim()
      if (editEmail.trim().toLowerCase() !== user?.email) body.email = editEmail.trim()
      if (showPasswordSection && newPassword) {
        if (newPassword !== confirmPassword) throw new Error("pw_mismatch")
        body.currentPassword = currentPassword
        body.newPassword = newPassword
      }
      if (Object.keys(body).length === 0) throw new Error("no_change")
      return api.patch("/api/auth/me", body)
    },
    onSuccess: (res) => {
      setUser(res.data)
      setShowEdit(false)
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
      setShowPasswordSection(false)
      Toast.show({ type: "success", text1: "Profile updated!" })
    },
    onError: (e: any) => {
      if (e.message === "no_change") { setShowEdit(false); return }
      if (e.message === "pw_mismatch") { Toast.show({ type: "error", text1: "Passwords don't match" }); return }
      const msg = e?.response?.data?.error ?? "Failed to update profile"
      Toast.show({ type: "error", text1: msg })
    },
  })

  function openEdit() {
    setEditName(user?.name ?? "")
    setEditEmail(user?.email ?? "")
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
    setShowPasswordSection(false)
    setShowEdit(true)
  }

  async function doSignOut() {
    setShowSignOutConfirm(false)
    await signOut()
    queryClient.clear()
  }

  const themeLabel = theme === "light" ? "Light" : theme === "system" ? "System" : "Dark"

  // ─── Shared style helpers ────────────────────────────────────────────────────
  const cardStyle = { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" as const }
  const rowStyle = { flexDirection: "row" as const, alignItems: "center" as const, padding: 16 }
  const divider = { borderBottomWidth: 1, borderBottomColor: C.border }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ color: C.text, fontSize: 24, fontWeight: "700" }}>Profile</Text>
        </View>

        {/* Avatar + Info Card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: "center" }}>
            <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar} style={{ position: "relative", marginBottom: 14 }}>
              {user?.image ? (
                <Image source={{ uri: user.image }} style={{ width: 80, height: 80, borderRadius: 40 }} />
              ) : (
                <Avatar name={user?.name} email={user?.email} size={80} />
              )}
              <View style={{ position: "absolute", bottom: 0, right: 0, backgroundColor: "#6366f1", borderRadius: 12, padding: 5, borderWidth: 2, borderColor: C.bg }}>
                {uploadingAvatar
                  ? <ActivityIndicator color="#fff" size="small" style={{ width: 12, height: 12 }} />
                  : <Ionicons name="camera" size={12} color="#fff" />}
              </View>
            </TouchableOpacity>

            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700", marginBottom: 4 }}>{user?.name ?? "—"}</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 16 }}>{user?.email}</Text>

            <TouchableOpacity
              onPress={openEdit}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }}
            >
              <Ionicons name="pencil" size={14} color="#a5b4fc" />
              <Text style={{ color: "#a5b4fc", fontWeight: "600", fontSize: 13 }}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preferences */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>Preferences</Text>
          <View style={cardStyle}>
            <View style={{ ...rowStyle, ...divider }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="notifications" size={18} color="#a5b4fc" />
              </View>
              <Text style={{ color: C.text, flex: 1 }}>Push Notifications</Text>
              <Switch value={notifications} onValueChange={handleNotificationsToggle} trackColor={{ false: "#374151", true: "#6366f1" }} thumbColor="#fff" />
            </View>

            <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={{ ...rowStyle, ...divider }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(34,197,94,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="card" size={18} color="#4ade80" />
              </View>
              <Text style={{ color: C.text, flex: 1 }}>Default Currency</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: C.textSub, fontSize: 13 }}>{currency}</Text>
                <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowAppearance(true)} style={rowStyle}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(6,182,212,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="color-palette" size={18} color="#22d3ee" />
              </View>
              <Text style={{ color: C.text, flex: 1 }}>Appearance</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: C.textSub, fontSize: 13 }}>{themeLabel}</Text>
                <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>About</Text>
          <View style={cardStyle}>
            <TouchableOpacity
              onPress={() => Toast.show({ type: "info", text1: "Coming soon!", text2: "Rating will be available when we launch on the Play Store" })}
              style={{ ...rowStyle, ...divider }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(245,158,11,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="star" size={18} color="#fcd34d" />
              </View>
              <Text style={{ color: C.text, flex: 1 }}>Rate SplitEase</Text>
              <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowPrivacy(true)} style={{ ...rowStyle, ...divider }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(139,92,246,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="shield-checkmark" size={18} color="#c084fc" />
              </View>
              <Text style={{ color: C.text, flex: 1 }}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
            </TouchableOpacity>

            <View style={rowStyle}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="information-circle" size={18} color={C.textSub} />
              </View>
              <Text style={{ color: C.text, flex: 1 }}>Version</Text>
              <Text style={{ color: C.textSub, fontSize: 13 }}>{Constants.expoConfig?.version ?? "—"}</Text>
            </View>
          </View>
        </View>

        {/* Sign Out + Delete Account */}
        <View style={{ paddingHorizontal: 20, marginBottom: 40, gap: 10 }}>
          <TouchableOpacity
            onPress={() => setShowSignOutConfirm(true)}
            style={{ backgroundColor: "rgba(244,63,94,0.12)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(244,63,94,0.2)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16 }}
          >
            <Ionicons name="log-out-outline" size={18} color="#f87171" />
            <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 15 }}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowDeleteConfirm(true)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 }}
          >
            <Ionicons name="trash-outline" size={14} color={C.textMuted} />
            <Text style={{ color: C.textMuted, fontSize: 13 }}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Edit Profile Modal ──────────────────────────────────────────────────── */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEdit(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 24 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setShowEdit(false)} style={{ backgroundColor: C.card, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 16) }} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Full Name</Text>
            <View style={{ backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.inputBorder, paddingHorizontal: 14, height: 48, justifyContent: "center", marginBottom: 16 }}>
              <TextInput style={{ color: C.text, fontSize: 15 }} value={editName} onChangeText={setEditName} placeholder="Your name" placeholderTextColor={C.textMuted} autoCapitalize="words" />
            </View>

            {/* Email */}
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>Email Address</Text>
            <View style={{ backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.inputBorder, paddingHorizontal: 14, height: 48, justifyContent: "center", marginBottom: 24 }}>
              <TextInput style={{ color: C.text, fontSize: 15 }} value={editEmail} onChangeText={setEditEmail} placeholder="you@email.com" placeholderTextColor={C.textMuted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </View>

            {/* Divider */}
            <View style={{ borderTopWidth: 1, borderTopColor: C.border, marginBottom: 20 }} />

            {/* Change Password toggle */}
            {!showPasswordSection ? (
              <TouchableOpacity
                onPress={() => setShowPasswordSection(true)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 48, marginBottom: 28 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="lock-closed-outline" size={18} color={C.textSub} />
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: "500" }}>Change Password</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={{ marginBottom: 28 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600" }}>Change Password</Text>
                  <TouchableOpacity onPress={() => { setShowPasswordSection(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("") }}>
                    <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "600" }}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                {/* Current Password */}
                <View style={{ backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.inputBorder, paddingHorizontal: 14, height: 48, flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <TextInput style={{ flex: 1, color: C.text, fontSize: 15 }} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" placeholderTextColor={C.textMuted} secureTextEntry={!showCurrentPw} />
                  <TouchableOpacity onPress={() => setShowCurrentPw(!showCurrentPw)}>
                    <Ionicons name={showCurrentPw ? "eye-off-outline" : "eye-outline"} size={18} color={C.textSub} />
                  </TouchableOpacity>
                </View>

                {/* New Password */}
                <View style={{ backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: C.inputBorder, paddingHorizontal: 14, height: 48, flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <TextInput style={{ flex: 1, color: C.text, fontSize: 15 }} value={newPassword} onChangeText={setNewPassword} placeholder="New password (min. 6 chars)" placeholderTextColor={C.textMuted} secureTextEntry={!showNewPw} />
                  <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)}>
                    <Ionicons name={showNewPw ? "eye-off-outline" : "eye-outline"} size={18} color={C.textSub} />
                  </TouchableOpacity>
                </View>

                {/* Confirm New Password */}
                <View style={{ backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1, borderColor: confirmPassword && confirmPassword !== newPassword ? "rgba(248,113,113,0.5)" : C.inputBorder, paddingHorizontal: 14, height: 48, flexDirection: "row", alignItems: "center" }}>
                  <TextInput style={{ flex: 1, color: C.text, fontSize: 15 }} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={C.textMuted} secureTextEntry={!showConfirmPw} />
                  <TouchableOpacity onPress={() => setShowConfirmPw(!showConfirmPw)}>
                    <Ionicons name={showConfirmPw ? "eye-off-outline" : "eye-outline"} size={18} color={C.textSub} />
                  </TouchableOpacity>
                </View>
                {confirmPassword && confirmPassword !== newPassword && (
                  <Text style={{ color: "#f87171", fontSize: 11, marginTop: 4 }}>Passwords do not match</Text>
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              style={{ height: 50, backgroundColor: "#6366f1", borderRadius: 14, alignItems: "center", justifyContent: "center", opacity: updateMutation.isPending ? 0.7 : 1 }}
            >
              {updateMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Appearance Picker Modal ──────────────────────────────────────────────── */}
      <Modal visible={showAppearance} transparent animationType="fade" onRequestClose={() => setShowAppearance(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>Appearance</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 20 }}>Choose how SplitEase looks</Text>

            {(["dark", "light", "system"] as ThemePref[]).map((opt) => {
              const labels: Record<ThemePref, string> = { dark: "Dark", light: "Light", system: "System default" }
              const icons: Record<ThemePref, React.ComponentProps<typeof Ionicons>["name"]> = { dark: "moon", light: "sunny", system: "phone-portrait" }
              const isSelected = theme === opt
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => { setTheme(opt); setShowAppearance(false) }}
                  style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: opt === "system" ? 0 : 1, borderBottomColor: C.border, gap: 14 }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isSelected ? "rgba(99,102,241,0.2)" : C.iconBg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={icons[opt]} size={18} color={isSelected ? "#6366f1" : C.textSub} />
                  </View>
                  <Text style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: isSelected ? "700" : "400" }}>{labels[opt]}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
                </TouchableOpacity>
              )
            })}

            <TouchableOpacity onPress={() => setShowAppearance(false)} style={{ marginTop: 16, height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: C.textSub, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Currency Picker Modal ────────────────────────────────────────────────── */}
      <Modal visible={showCurrencyPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Select Currency</Text>
            <TouchableOpacity onPress={() => { setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ backgroundColor: C.card, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
            <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
            <TextInput style={{ color: C.text, flex: 1, fontSize: 14 }} placeholder="Search currency..." placeholderTextColor={C.textMuted} value={currencySearch} onChangeText={setCurrencySearch} autoCapitalize="none" />
            {currencySearch.length > 0 && <TouchableOpacity onPress={() => setCurrencySearch("")}><Ionicons name="close-circle" size={16} color={C.textMuted} /></TouchableOpacity>}
          </View>
          <FlatList
            data={CURRENCIES.filter(c => c.code.toLowerCase().includes(currencySearch.toLowerCase()) || c.name.toLowerCase().includes(currencySearch.toLowerCase()))}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 20) }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setCurrency(item.code); setShowCurrencyPicker(false); setCurrencySearch("") }}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                  <Text style={{ fontSize: 16, color: C.text, fontWeight: "600" }}>{item.symbol}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600" }}>{item.code}</Text>
                  <Text style={{ color: C.textSub, fontSize: 12 }}>{item.name}</Text>
                </View>
                <Text style={{ fontSize: 24, marginRight: currency === item.code ? 8 : 0 }}>{item.flag}</Text>
                {currency === item.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* ── Privacy Policy Modal ─────────────────────────────────────────────────── */}
      <Modal visible={showPrivacy} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPrivacy(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Privacy Policy</Text>
            <TouchableOpacity onPress={() => setShowPrivacy(false)} style={{ backgroundColor: C.card, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 16) }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 22 }}>{PRIVACY_POLICY}</Text>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Sign Out Confirm ─────────────────────────────────────────────────────── */}
      <Modal visible={showSignOutConfirm} transparent animationType="fade" onRequestClose={() => setShowSignOutConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name="log-out-outline" size={26} color="#f87171" />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>Sign Out</Text>
            <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>Are you sure you want to sign out?</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setShowSignOutConfirm(false)} style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={doSignOut} style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Account Confirm ───────────────────────────────────────────────── */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name="trash" size={26} color="#f87171" />
            </View>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 8, textAlign: "center" }}>Delete Account</Text>
            <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 24, textAlign: "center" }}>
              This will permanently delete your account, all your expenses, groups you created, and all associated data. This cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleteAccountMutation.isPending}
                style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ color: C.textSub, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteAccountMutation.mutate()}
                disabled={deleteAccountMutation.isPending}
                style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}
              >
                {deleteAccountMutation.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

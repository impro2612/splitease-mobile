import { useState } from "react"
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { authApi } from "@/lib/api"

const signInLogo = require("@/assets/Photoroom.png")

const COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+1", country: "USA / Canada", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+60", country: "Malaysia", flag: "🇲🇾" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+82", country: "South Korea", flag: "🇰🇷" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+52", country: "Mexico", flag: "🇲🇽" },
  { code: "+62", country: "Indonesia", flag: "🇮🇩" },
  { code: "+63", country: "Philippines", flag: "🇵🇭" },
  { code: "+66", country: "Thailand", flag: "🇹🇭" },
  { code: "+84", country: "Vietnam", flag: "🇻🇳" },
  { code: "+92", country: "Pakistan", flag: "🇵🇰" },
  { code: "+94", country: "Sri Lanka", flag: "🇱🇰" },
  { code: "+977", country: "Nepal", flag: "🇳🇵" },
  { code: "+880", country: "Bangladesh", flag: "🇧🇩" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+46", country: "Sweden", flag: "🇸🇪" },
  { code: "+41", country: "Switzerland", flag: "🇨🇭" },
  { code: "+64", country: "New Zealand", flag: "🇳🇿" },
  { code: "+972", country: "Israel", flag: "🇮🇱" },
  { code: "+7", country: "Russia", flag: "🇷🇺" },
]

export default function CompleteProfile() {
  const C = useTheme()
  const [countryCode, setCountryCode] = useState("+91")
  const [phone, setPhone] = useState("")
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 6) { setError("Please enter a valid phone number"); return }
    setLoading(true); setError("")
    try {
      await authApi.savePhone(`${countryCode}${digits}`)
      router.replace("/(tabs)/dashboard")
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const selected = COUNTRY_CODES.find(c => c.code === countryCode) ?? COUNTRY_CODES[0]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center" }}>
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 36 }}>
            <Image source={signInLogo} style={{ width: 72, height: 72, marginBottom: 20 }} resizeMode="contain" />
            <Text style={{ color: C.text, fontSize: 26, fontWeight: "700", textAlign: "center" }}>
              One last step! 👋
            </Text>
            <Text style={{ color: C.textSub, fontSize: 15, marginTop: 10, textAlign: "center", lineHeight: 22 }}>
              Add your phone number so your friends can find you on SplitIT when they sync their contacts.
            </Text>
          </View>

          {/* Phone row */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            {/* Country code picker */}
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 14, height: 56 }}
            >
              <Text style={{ fontSize: 20 }}>{selected.flag}</Text>
              <Text style={{ color: C.text, fontWeight: "600", fontSize: 14 }}>{countryCode}</Text>
              <Ionicons name="chevron-down" size={14} color={C.textMuted} />
            </TouchableOpacity>

            {/* Phone number input */}
            <View style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 16, height: 56, justifyContent: "center" }}>
              <TextInput
                style={{ color: C.text, fontSize: 16 }}
                placeholder="Phone number"
                placeholderTextColor={C.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {error ? (
            <View style={{ backgroundColor: "rgba(244,63,94,0.1)", borderWidth: 1, borderColor: "rgba(244,63,94,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14 }}>
              <Text style={{ color: "#f87171", fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          {/* Save button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            style={{ height: 56, backgroundColor: "#6366f1", borderRadius: 16, alignItems: "center", justifyContent: "center", opacity: loading ? 0.7 : 1 }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Save & Continue</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Country code picker modal */}
      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPicker(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "700" }}>Select Country Code</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={COUNTRY_CODES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setCountryCode(item.code); setShowPicker(false) }}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)", backgroundColor: item.code === countryCode ? "rgba(99,102,241,0.1)" : "transparent" }}
              >
                <Text style={{ fontSize: 26 }}>{item.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{item.country}</Text>
                </View>
                <Text style={{ color: "#6366f1", fontWeight: "700", fontSize: 15 }}>{item.code}</Text>
                {item.code === countryCode && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  )
}

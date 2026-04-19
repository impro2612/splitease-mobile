import { useState } from "react"
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, ActivityIndicator,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "@/store/auth"
import { useTheme } from "@/lib/theme"

export default function SignUp() {
  const { signUp } = useAuthStore()
  const C = useTheme()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthColors = ["transparent", "#f43f5e", "#f59e0b", "#22c55e"]

  async function handleSignUp() {
    if (!name || !email || !phone || !password) { setError("All fields are required"); return }
    if (phone.replace(/[^\d]/g, "").length < 7) { setError("Enter a valid phone number"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true); setError("")
    try {
      await signUp(name.trim(), email.trim().toLowerCase(), phone.trim(), password)
      router.replace("/(tabs)/dashboard")
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 14 }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior="padding">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 48 }}>
          {/* Logo */}
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 36 }}>💸</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 28, fontWeight: "700" }}>Create account</Text>
            <Text style={{ color: C.textSub, fontSize: 15, marginTop: 4 }}>Start splitting for free</Text>
          </View>

          {/* Name */}
          <View style={inputStyle}>
            <Ionicons name="person-outline" size={18} color={C.textSub} />
            <TextInput style={{ flex: 1, color: C.text, fontSize: 15, marginLeft: 12 }} placeholder="Full name" placeholderTextColor={C.textMuted} value={name} onChangeText={setName} autoCapitalize="words" />
          </View>

          {/* Email */}
          <View style={inputStyle}>
            <Ionicons name="mail-outline" size={18} color={C.textSub} />
            <TextInput style={{ flex: 1, color: C.text, fontSize: 15, marginLeft: 12 }} placeholder="you@email.com" placeholderTextColor={C.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </View>

          {/* Phone */}
          <View style={inputStyle}>
            <Ionicons name="call-outline" size={18} color={C.textSub} />
            <TextInput style={{ flex: 1, color: C.text, fontSize: 15, marginLeft: 12 }} placeholder="+1 234 567 8900" placeholderTextColor={C.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoCorrect={false} />
          </View>

          {/* Password */}
          <View style={inputStyle}>
            <Ionicons name="lock-closed-outline" size={18} color={C.textSub} />
            <TextInput style={{ flex: 1, color: C.text, fontSize: 15, marginLeft: 12 }} placeholder="Min. 6 characters" placeholderTextColor={C.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={C.textSub} />
            </TouchableOpacity>
          </View>

          {/* Strength bar */}
          {password.length > 0 && (
            <View style={{ flexDirection: "row", gap: 6, marginTop: -8, marginBottom: 14 }}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ height: 4, flex: 1, borderRadius: 4, backgroundColor: i <= strength ? strengthColors[strength] : C.border }} />
              ))}
            </View>
          )}

          {error ? (
            <View style={{ backgroundColor: "rgba(244,63,94,0.1)", borderWidth: 1, borderColor: "rgba(244,63,94,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14 }}>
              <Text style={{ color: "#f87171", fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleSignUp}
            disabled={loading}
            style={{ height: 56, backgroundColor: "#6366f1", borderRadius: 16, alignItems: "center", justifyContent: "center", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Create Account</Text>}
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24 }}>
            <Text style={{ color: C.textSub }}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: "#6366f1", fontWeight: "600" }}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

import { useState } from "react"
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, ActivityIndicator, ScrollView, Platform,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { authApi } from "@/lib/api"
import { useTheme } from "@/lib/theme"

type Step = "email" | "otp"

export default function ForgotPassword() {
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function handleSendCode() {
    if (!email.trim()) { setError("Please enter your email"); return }
    setLoading(true); setError("")
    try {
      await authApi.forgotPassword(email.trim().toLowerCase())
      setStep("otp")
    } catch (e: any) {
      if (!e?.response) {
        setError("No internet connection. Please check your network and try again.")
      } else {
        setError("Something went wrong. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    if (!otp.trim()) { setError("Please enter the code"); return }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true); setError("")
    try {
      await authApi.resetPassword({ email: email.trim().toLowerCase(), token: otp.trim(), newPassword })
      setSuccess("Password reset! You can now sign in.")
      setTimeout(() => router.replace("/(auth)/signin"), 2000)
    } catch (e: any) {
      if (!e?.response) {
        setError("No internet connection. Please check your network and try again.")
      } else {
        setError(e.response.data?.error ?? "Invalid or expired code")
      }
    } finally {
      setLoading(false)
    }
  }

  const inputRow = { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 16 }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 48 }}>
          {/* Back */}
          <TouchableOpacity
            onPress={() => step === "otp" ? setStep("email") : router.back()}
            style={{ position: "absolute", top: insets.top + 16, left: 24, backgroundColor: C.iconBg, borderRadius: 12, padding: 10 }}
          >
            <Ionicons name="arrow-back" size={18} color={C.text} />
          </TouchableOpacity>

          {/* Icon */}
          <View style={{ marginBottom: 40 }}>
            <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 16, alignSelf: "center" }}>
              <Ionicons name={step === "email" ? "mail-outline" : "shield-checkmark-outline"} size={36} color="#6366f1" />
            </View>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: "700", textAlign: "center" }}>
              {step === "email" ? "Forgot password?" : "Enter your code"}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
              {step === "email"
                ? "Enter your email and we'll send you a reset code"
                : `We sent a 6-digit code to\n${email}`}
            </Text>
          </View>

          {step === "email" ? (
            <View>
              <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Email address</Text>
              <View style={inputRow}>
                <Ionicons name="mail-outline" size={18} color={C.textSub} />
                <TextInput
                  style={{ flex: 1, color: C.text, fontSize: 15, marginLeft: 12 }}
                  placeholder="you@email.com"
                  placeholderTextColor={C.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {error ? (
                <View style={{ backgroundColor: "rgba(244,63,94,0.1)", borderWidth: 1, borderColor: "rgba(244,63,94,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}>
                  <Text style={{ color: "#f87171", fontSize: 13 }}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleSendCode}
                disabled={loading}
                style={{ height: 56, backgroundColor: "#6366f1", borderRadius: 16, alignItems: "center", justifyContent: "center", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Send Reset Code</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>6-digit code</Text>
              <View style={inputRow}>
                <Ionicons name="keypad-outline" size={18} color={C.textSub} />
                <TextInput
                  style={{ flex: 1, color: C.text, fontSize: 20, fontWeight: "700", marginLeft: 12, letterSpacing: 6 }}
                  placeholder="000000"
                  placeholderTextColor={C.textMuted}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>New password</Text>
              <View style={inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textSub} />
                <TextInput
                  style={{ flex: 1, color: C.text, fontSize: 15, marginLeft: 12 }}
                  placeholder="At least 6 characters"
                  placeholderTextColor={C.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={C.textSub} />
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={{ backgroundColor: "rgba(244,63,94,0.1)", borderWidth: 1, borderColor: "rgba(244,63,94,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}>
                  <Text style={{ color: "#f87171", fontSize: 13 }}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={{ backgroundColor: "rgba(34,197,94,0.1)", borderWidth: 1, borderColor: "rgba(34,197,94,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}>
                  <Text style={{ color: "#4ade80", fontSize: 13 }}>{success}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleReset}
                disabled={loading}
                style={{ height: 56, backgroundColor: "#6366f1", borderRadius: 16, alignItems: "center", justifyContent: "center", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Reset Password</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendCode} disabled={loading} style={{ marginTop: 16, alignItems: "center" }}>
                <Text style={{ color: "#6366f1", fontSize: 14 }}>Didn't get the code? Resend</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

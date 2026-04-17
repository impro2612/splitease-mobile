import { useState } from "react"
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { authApi } from "@/lib/api"

type Step = "email" | "otp"

export default function ForgotPassword() {
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
    } catch {
      setError("Something went wrong. Please try again.")
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
      setError(e?.response?.data?.error ?? "Invalid or expired code")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-base" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          {/* Back button */}
          <TouchableOpacity
            onPress={() => step === "otp" ? setStep("email") : router.back()}
            style={{ position: "absolute", top: 56, left: 24, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 10 }}
          >
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>

          {/* Icon */}
          <View className="items-center mb-10">
            <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name={step === "email" ? "mail-outline" : "shield-checkmark-outline"} size={36} color="#6366f1" />
            </View>
            <Text className="text-3xl font-bold text-white">
              {step === "email" ? "Forgot password?" : "Enter your code"}
            </Text>
            <Text className="text-muted text-sm mt-2 text-center">
              {step === "email"
                ? "Enter your email and we'll send you a reset code"
                : `We sent a 6-digit code to\n${email}`}
            </Text>
          </View>

          {step === "email" ? (
            <View>
              <Text className="text-slate-300 text-sm font-medium mb-2">Email address</Text>
              <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 h-14 mb-4">
                <Ionicons name="mail-outline" size={18} color="#94a3b8" />
                <TextInput
                  className="flex-1 text-white text-base ml-3"
                  placeholder="you@email.com"
                  placeholderTextColor="#475569"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {error ? (
                <View className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                  <Text className="text-red-400 text-sm">{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleSendCode}
                disabled={loading}
                className="h-14 bg-primary rounded-2xl items-center justify-center"
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Send Reset Code</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {/* OTP input */}
              <Text className="text-slate-300 text-sm font-medium mb-2">6-digit code</Text>
              <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 h-14 mb-4">
                <Ionicons name="keypad-outline" size={18} color="#94a3b8" />
                <TextInput
                  className="flex-1 text-white text-xl font-bold ml-3 tracking-widest"
                  placeholder="000000"
                  placeholderTextColor="#475569"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              {/* New password */}
              <Text className="text-slate-300 text-sm font-medium mb-2">New password</Text>
              <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 h-14 mb-4">
                <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                <TextInput
                  className="flex-1 text-white text-base ml-3"
                  placeholder="At least 6 characters"
                  placeholderTextColor="#475569"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {error ? (
                <View className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                  <Text className="text-red-400 text-sm">{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-4">
                  <Text className="text-green-400 text-sm">{success}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleReset}
                disabled={loading}
                className="h-14 bg-primary rounded-2xl items-center justify-center"
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Reset Password</Text>}
              </TouchableOpacity>

              {/* Resend */}
              <TouchableOpacity onPress={handleSendCode} disabled={loading} style={{ marginTop: 16, alignItems: "center" }}>
                <Text style={{ color: "#6366f1", fontSize: 14 }}>Didn't get the code? Resend</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

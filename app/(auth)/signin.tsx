import { useState, useEffect } from "react"
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"

export default function SignIn() {
  const { signIn } = useAuthStore()
  const [email, setEmail] = useState("")

  // Fire a cheap GET to warm the serverless function while the user types,
  // so the bcrypt + DB work happens on an already-running container.
  useEffect(() => {
    api.get("/api/auth/mobile-signin").catch(() => {})
  }, [])
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSignIn() {
    if (!email || !password) { setError("Please fill in all fields"); return }
    setLoading(true); setError("")
    try {
      await signIn(email.trim().toLowerCase(), password)
      router.replace("/(tabs)/dashboard")
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-base"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          {/* Logo */}
          <View className="items-center mb-10">
            <View className="w-20 h-20 rounded-3xl bg-primary items-center justify-center mb-4 shadow-lg">
              <Text className="text-4xl">💸</Text>
            </View>
            <Text className="text-3xl font-bold text-white">Welcome back</Text>
            <Text className="text-muted text-base mt-1">Sign in to continue splitting</Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            {/* Email */}
            <View>
              <Text className="text-slate-300 text-sm font-medium mb-2">Email</Text>
              <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 h-14">
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
            </View>

            {/* Password */}
            <View>
              <Text className="text-slate-300 text-sm font-medium mb-2">Password</Text>
              <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 h-14">
                <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" />
                <TextInput
                  className="flex-1 text-white text-base ml-3"
                  placeholder="Your password"
                  placeholderTextColor="#475569"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <Text className="text-red-400 text-sm">{error}</Text>
              </View>
            ) : null}

            {/* Sign in button */}
            <TouchableOpacity
              onPress={handleSignIn}
              disabled={loading}
              className="h-14 bg-primary rounded-2xl items-center justify-center mt-2 shadow-lg"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign up link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-muted">Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
              <Text className="text-primary font-semibold">Create one</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

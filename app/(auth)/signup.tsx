import { useState } from "react"
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "@/store/auth"

export default function SignUp() {
  const { signUp } = useAuthStore()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3
  const strengthColor = strength === 1 ? "bg-danger" : strength === 2 ? "bg-warning" : "bg-success"

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

  return (
    <KeyboardAvoidingView className="flex-1 bg-base" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          {/* Logo */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-3xl bg-primary items-center justify-center mb-4">
              <Text className="text-4xl">💸</Text>
            </View>
            <Text className="text-3xl font-bold text-white">Create account</Text>
            <Text className="text-muted text-base mt-1">Start splitting for free</Text>
          </View>

          <View className="space-y-4">
            {/* Name */}
            <View>
              <Text className="text-slate-300 text-sm font-medium mb-2">Full name</Text>
              <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 h-14">
                <Ionicons name="person-outline" size={18} color="#94a3b8" />
                <TextInput
                  className="flex-1 text-white text-base ml-3"
                  placeholder="John Doe"
                  placeholderTextColor="#475569"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

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

            {/* Phone */}
            <View>
              <Text className="text-slate-300 text-sm font-medium mb-2">Phone number</Text>
              <View className="flex-row items-center bg-card border border-border rounded-2xl px-4 h-14">
                <Ionicons name="call-outline" size={18} color="#94a3b8" />
                <TextInput
                  className="flex-1 text-white text-base ml-3"
                  placeholder="+1 234 567 8900"
                  placeholderTextColor="#475569"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
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
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#475569"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              {/* Strength bar */}
              {password.length > 0 && (
                <View className="flex-row gap-1 mt-2">
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i <= strength ? strengthColor : "bg-white/10"}`}
                    />
                  ))}
                </View>
              )}
            </View>

            {error ? (
              <View className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <Text className="text-red-400 text-sm">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSignUp}
              disabled={loading}
              className="h-14 bg-primary rounded-2xl items-center justify-center mt-2"
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-8">
            <Text className="text-muted">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-primary font-semibold">Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

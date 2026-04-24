import { useState, useEffect } from "react"
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  KeyboardAvoidingView, ActivityIndicator, Platform,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import { GoogleSignin } from "@react-native-google-signin/google-signin"
import { useAuthStore } from "@/store/auth"
import { api } from "@/lib/api"
import { useTheme } from "@/lib/theme"
import { GoogleLogo } from "@/components/ui/GoogleLogo"

const signInLogo = require("@/assets/Photoroom.png")

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
})

export default function SignIn() {
  const { signIn, googleSignIn } = useAuthStore()
  const C = useTheme()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    api.get("/api/auth/mobile-signin").catch(() => {})
  }, [])

  async function handleSignIn() {
    if (!email || !password) { setError("Please fill in all fields"); return }
    setLoading(true); setError("")
    try {
      await signIn(email.trim().toLowerCase(), password)
      router.replace("/(tabs)/dashboard")
    } catch (e: any) {
      if (!e?.response) {
        setError("No internet connection. Please check your network and try again.")
      } else {
        setError(e.response.data?.error ?? "Invalid email or password")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true); setError("")
    try {
      await GoogleSignin.hasPlayServices()
      const userInfo = await GoogleSignin.signIn()
      const idToken = userInfo.data?.idToken
      if (!idToken) throw new Error("No ID token returned")
      await googleSignIn(idToken)
      router.replace("/(tabs)/dashboard")
    } catch (e: any) {
      if (e.code === "SIGN_IN_CANCELLED") {
        // user cancelled — no error shown
      } else {
        setError("Google sign-in failed. Please try again.")
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 48 }}>
            {/* Logo */}
            <View style={{ marginBottom: 40 }}>
              <Image source={signInLogo} style={{ width: 80, height: 80, marginBottom: 16, alignSelf: "center" }} resizeMode="contain" />
              <Text style={{ color: C.text, fontSize: 28, fontWeight: "700", textAlign: "center" }}>Welcome back</Text>
              <Text style={{ color: C.textSub, fontSize: 15, marginTop: 4, textAlign: "center" }}>Sign in to continue splitting</Text>
            </View>

            {/* Email */}
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Email</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 16 }}>
              <Ionicons name="mail-outline" size={18} color={C.textSub} />
              <TextInput style={{ flex: 1, color: C.text, fontSize: 15, marginLeft: 12 }} placeholder="you@email.com" placeholderTextColor={C.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </View>

            {/* Password */}
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Password</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 8 }}>
              <Ionicons name="lock-closed-outline" size={18} color={C.textSub} />
              <TextInput style={{ flex: 1, color: C.text, fontSize: 15, marginLeft: 12 }} placeholder="Your password" placeholderTextColor={C.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={C.textSub} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as any)} style={{ marginBottom: 20 }}>
              <Text style={{ color: "#6366f1", fontSize: 13, textAlign: "right" }}>Forgot password?</Text>
            </TouchableOpacity>

            {error ? (
              <View style={{ backgroundColor: "rgba(244,63,94,0.1)", borderWidth: 1, borderColor: "rgba(244,63,94,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}>
                <Text style={{ color: "#f87171", fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            {/* Sign In button */}
            <TouchableOpacity
              onPress={handleSignIn}
              disabled={loading || googleLoading}
              style={{ height: 56, backgroundColor: "#6366f1", borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 4, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Sign In</Text>}
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Text style={{ color: C.textMuted, fontSize: 13 }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>

            {/* Google SSO button */}
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading}
              style={{ height: 56, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, opacity: googleLoading ? 0.7 : 1 }}
            >
              {googleLoading ? (
                <ActivityIndicator color={C.text} />
              ) : (
                <>
                  <GoogleLogo size={22} />
                  <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 32 }}>
              <Text style={{ color: C.textSub }}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
                <Text style={{ color: "#6366f1", fontWeight: "600" }}>Create one</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

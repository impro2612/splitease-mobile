import { useEffect } from "react"
import { View, Text, ActivityIndicator } from "react-native"
import { router } from "expo-router"
import { useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"

export default function GmailConnected() {
  const queryClient = useQueryClient()

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["gmail-status"] })
    queryClient.invalidateQueries({ queryKey: ["tx-summary"] })
    queryClient.invalidateQueries({ queryKey: ["transactions"] })

    const t = setTimeout(() => {
      router.replace("/(tabs)/expenses")
    }, 1500)

    return () => clearTimeout(t)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: "#0a0a1a", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(34,197,94,0.15)", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="checkmark-circle" size={44} color="#22c55e" />
      </View>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Gmail Connected!</Text>
      <Text style={{ color: "#94a3b8", fontSize: 14 }}>Your transactions will sync automatically.</Text>
      <ActivityIndicator color="#6366f1" style={{ marginTop: 8 }} />
    </View>
  )
}

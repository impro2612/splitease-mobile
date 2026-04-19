import { Redirect } from "expo-router"
import { useAuthStore } from "@/store/auth"
import { View, ActivityIndicator } from "react-native"
import { useTheme } from "@/lib/theme"

export default function Index() {
  const { user, loading } = useAuthStore()
  const C = useTheme()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    )
  }

  return <Redirect href={user ? "/(tabs)/dashboard" : "/(auth)/signin"} />
}

import { Redirect } from "expo-router"
import { useAuthStore } from "@/store/auth"
import { View, ActivityIndicator } from "react-native"

export default function Index() {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    )
  }

  return <Redirect href={user ? "/(tabs)/dashboard" : "/(auth)/signin"} />
}

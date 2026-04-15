import { Tabs, Redirect } from "expo-router"
import { useAuthStore } from "@/store/auth"
import { View, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"

export default function TabsLayout() {
  const { user, loading } = useAuthStore()

  if (loading) {
    return <View className="flex-1 bg-base items-center justify-center"><ActivityIndicator color="#6366f1" /></View>
  }
  if (!user) return <Redirect href="/(auth)/signin" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#12121f",
          borderTopColor: "rgba(255,255,255,0.06)",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#475569",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-add" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

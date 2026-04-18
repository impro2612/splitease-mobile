import { Tabs, Redirect } from "expo-router"
import { useAuthStore } from "@/store/auth"
import { View, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function TabsLayout() {
  const { user, loading } = useAuthStore()
  // bottom inset = system nav bar height (0 on gesture nav, ~48dp on 3-button nav, ~34pt on iPhone)
  const { bottom } = useSafeAreaInsets()

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
          // Grow the bar to sit above any system nav bar (3-button or gesture indicator)
          height: 64 + bottom,
          paddingBottom: bottom > 0 ? bottom + 4 : 10,
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

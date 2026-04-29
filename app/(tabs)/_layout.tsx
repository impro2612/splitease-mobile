import { Tabs, Redirect } from "expo-router"
import { useAuthStore } from "@/store/auth"
import { View, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { BottomTabBar } from "@react-navigation/bottom-tabs"

export default function TabsLayout() {
  const { user, loading } = useAuthStore()
  const { bottom } = useSafeAreaInsets()
  const C = useTheme()

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#6366f1" /></View>
  }
  if (!user) return <Redirect href="/(auth)/signin" />

  return (
    <Tabs
      tabBar={(props) => {
        // Strip the hidden "groups" route so it never occupies flex space
        const visibleRoutes = props.state.routes.filter((r) => r.name !== "groups")
        const currentRoute = props.state.routes[props.state.index]
        const visibleIndex = visibleRoutes.findIndex((r) => r.key === currentRoute?.key)
        const filteredState = {
          ...props.state,
          routes: visibleRoutes,
          index: visibleIndex >= 0 ? visibleIndex : 0,
        }
        return <BottomTabBar {...props} state={filteredState} />
      }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.tabBar,
          borderTopColor: C.tabBorder,
          borderTopWidth: 1,
          height: 64 + bottom,
          paddingBottom: bottom > 0 ? bottom + 4 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: C.textSub,
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
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
          tabBarButton: () => null,
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

import { useState } from "react"
import { Tabs, Redirect, router } from "expo-router"
import { View, ActivityIndicator, TouchableOpacity } from "react-native"
import { Text } from "@/components/ui/Typography"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAuthStore } from "@/store/auth"
import { tokens, useTheme } from "@/lib/theme"
import { useOffline } from "@/context/OfflineContext"
import { TABS } from "@/lib/navigation"
import { MoreSheet } from "@/components/ui/MoreSheet"
import { haptic } from "@/lib/haptics"

export default function TabsLayout() {
  const { user, loading } = useAuthStore()
  const { bottom } = useSafeAreaInsets()
  const C = useTheme()
  const { isOnline } = useOffline()
  const [moreVisible, setMoreVisible] = useState(false)

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={tokens.accent} />
      </View>
    )
  }
  if (!user) return <Redirect href="/(auth)/signin" />

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: C.tabBar,
            borderTopColor: C.tabBorder,
            borderTopWidth: 1,
            height: 62 + bottom,
            paddingBottom: bottom > 0 ? bottom + 4 : 10,
            paddingTop: 8,
          },
          tabBarActiveTintColor: tokens.accent,
          tabBarInactiveTintColor: C.textMuted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600", fontFamily: tokens.font },
        }}
        screenListeners={{ tabPress: () => { haptic.tap() } }}
      >
        {TABS.filter((t) => t.key !== "more").map((t) => (
          <Tabs.Screen
            key={t.key}
            name={t.key}
            options={{
              title: t.label,
              tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? t.iconActive : t.icon} size={23} color={color} />,
            }}
          />
        ))}
        <Tabs.Screen
          name="more"
          options={{
            title: "More",
            // Same icon/label layout as the other tabs; highlighted while the sheet is open
            tabBarIcon: () => <Ionicons name={moreVisible ? "grid" : "grid-outline"} size={23} color={moreVisible ? tokens.accent : C.textMuted} />,
            tabBarLabel: () => <Text style={{ color: moreVisible ? tokens.accent : C.textMuted, fontSize: 11, fontWeight: "600" }}>More</Text>,
            // Opens the More sheet instead of navigating
            tabBarButton: ({ children, style }) => (
              <TouchableOpacity
                style={style as any}
                onPress={() => { haptic.tap(); setMoreVisible(true) }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="More"
              >
                {children}
              </TouchableOpacity>
            ),
          }}
        />
        {/* Reachable from the More sheet / avatar, but not tabs themselves */}
        <Tabs.Screen name="profile" options={{ href: null, title: "Profile" }} />
        <Tabs.Screen name="expenses" options={{ href: null, title: "My Spending" }} />
      </Tabs>

      <MoreSheet
        visible={moreVisible}
        onClose={() => setMoreVisible(false)}
        onSelect={(route) => router.push(route as any)}
        disabled={!isOnline}
      />
    </>
  )
}

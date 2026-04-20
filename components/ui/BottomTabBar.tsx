import { View, Text, TouchableOpacity } from "react-native"
import { router, usePathname } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"

const TABS = [
  { name: "Dashboard", route: "/(tabs)/dashboard", icon: "home" as const },
  { name: "Groups", route: "/(tabs)/groups", icon: "people" as const },
  { name: "Friends", route: "/(tabs)/friends", icon: "person-add" as const },
  { name: "Profile", route: "/(tabs)/profile", icon: "person-circle" as const },
]

interface Props {
  activeTab?: string
}

export function BottomTabBar({ activeTab }: Props) {
  const { bottom } = useSafeAreaInsets()
  const C = useTheme()
  const pathname = usePathname()

  const paddingBottom = bottom > 0 ? bottom + 4 : 10
  const height = 64 + (bottom > 0 ? bottom : 0)
  const inactiveColor = C.textSub

  return (
    <View
      style={{
        height,
        backgroundColor: C.tabBar,
        borderTopWidth: 1,
        borderTopColor: C.tabBorder,
        flexDirection: "row",
        paddingBottom,
        paddingTop: 8,
        elevation: 8,
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab
          ? tab.name === activeTab
          : pathname.startsWith(tab.route.replace("/(tabs)", ""))
        const color = isActive ? "#6366f1" : inactiveColor
        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => router.push(tab.route as any)}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}
          >
            <Ionicons name={tab.icon} size={24} color={color} />
            <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{tab.name}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

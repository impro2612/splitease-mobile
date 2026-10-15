import { useState } from "react"
import { View, TouchableOpacity } from "react-native"
import { router, usePathname } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text } from "@/components/ui/Typography"
import { tokens, useTheme } from "@/lib/theme"
import { TABS } from "@/lib/navigation"
import { MoreSheet } from "@/components/ui/MoreSheet"
import { haptic } from "@/lib/haptics"

/**
 * Tab bar for screens pushed on top of the tabs (e.g. a group's detail page), so the bottom
 * navigation looks and behaves the same everywhere. `activeTab` is a TABS key.
 */
export function BottomTabBar({ activeTab }: { activeTab?: string }) {
  const { bottom } = useSafeAreaInsets()
  const C = useTheme()
  const pathname = usePathname()
  const [moreVisible, setMoreVisible] = useState(false)

  return (
    <>
      <View style={{ height: 62 + (bottom > 0 ? bottom : 0), backgroundColor: C.tabBar, borderTopWidth: 1, borderTopColor: C.tabBorder, flexDirection: "row", paddingBottom: bottom > 0 ? bottom + 4 : 10, paddingTop: 8 }}>
        {TABS.map((tab) => {
          const isMore = tab.key === "more"
          const active = isMore ? moreVisible : activeTab ? tab.key === activeTab : pathname.startsWith(`/${tab.key}`)
          const color = active ? tokens.accent : C.textMuted
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => { haptic.tap(); if (isMore) setMoreVisible(true); else router.navigate(tab.route as any) }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
            >
              <Ionicons name={active ? tab.iconActive : tab.icon} size={23} color={color} />
              <Text style={{ color, fontSize: 11, fontWeight: "600" }}>{tab.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
      <MoreSheet visible={moreVisible} onClose={() => setMoreVisible(false)} onSelect={(route) => router.push(route as any)} />
    </>
  )
}

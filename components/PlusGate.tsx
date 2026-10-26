import type { ComponentType } from "react"
import { View, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Text } from "@/components/ui/Typography"
import { tokens, useTheme } from "@/lib/theme"
import { plusLapsed, usePlus } from "@/lib/plus"
import { BottomTabBar } from "@/components/ui/BottomTabBar"

/** Shown in place of a Plus screen once the trial has ended (e.g. opened from a notification). */
function PlusLocked({ title }: { title: string }) {
  const C = useTheme()
  const { status } = usePlus()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 60 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: tokens.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="lock-closed" size={28} color={C.accentText} />
        </View>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", marginTop: 16, textAlign: "center" }}>{title} is part of SplitIT Plus</Text>
        <Text style={{ color: C.textSub, fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
          {plusLapsed(status)
            ? "Your Plus has ended. Your data is safe. Renew Plus to use it again."
            : "Your free trial has ended. Your data is safe. Subscribe to Plus to use it again."}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/plus" as any)}
          activeOpacity={0.85}
          style={{ marginTop: 24, height: 50, paddingHorizontal: 28, borderRadius: tokens.radius.lg, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>See Plus</Text>
        </TouchableOpacity>
      </View>
      <BottomTabBar />
    </SafeAreaView>
  )
}

/** Wraps a More-section screen so it shows the Plus lock when the user has no access. */
export function withPlus<P extends object>(Screen: ComponentType<P>, title: string) {
  return function PlusGated(props: P) {
    const { locked } = usePlus()
    return locked ? <PlusLocked title={title} /> : <Screen {...props} />
  }
}

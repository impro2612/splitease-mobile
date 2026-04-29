import { View, Text } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { BottomTabBar } from "@/components/ui/BottomTabBar"

export default function Expenses() {
  const C = useTheme()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "700" }}>Expenses</Text>
        <Text style={{ color: C.textSub, fontSize: 13, marginTop: 8 }}>Coming soon</Text>
      </View>
      <BottomTabBar activeTab="Expenses" />
    </SafeAreaView>
  )
}

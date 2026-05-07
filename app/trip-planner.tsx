import { View, Text, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"

export default function TripPlanner() {
  const C = useTheme()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.12)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="airplane-outline" size={20} color="#10b981" />
        </View>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800" }}>Trip Planner</Text>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(16,185,129,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Ionicons name="airplane-outline" size={40} color="#10b981" />
        </View>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: "800", textAlign: "center" }}>Coming Soon</Text>
        <Text style={{ color: C.textSub, fontSize: 14, textAlign: "center", marginTop: 10, lineHeight: 22 }}>
          Set category budgets before a trip and watch them fill up in real time as your group adds expenses.
        </Text>
      </View>
    </SafeAreaView>
  )
}

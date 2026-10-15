import { ScrollView, TouchableOpacity, View } from "react-native"
import { Text } from "@/components/ui/Typography"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "@/lib/theme"
import { formatCurrency, formatDate } from "@/lib/utils"

type SummaryItem = {
  description: string
  amount: number
  date: string
  isCredit: boolean
}

function parseItems(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as SummaryItem[] : []
  } catch {
    return []
  }
}

export default function GroupBalanceSummary() {
  const params = useLocalSearchParams<{
    fromName?: string
    toName?: string
    amount?: string
    currency?: string
    symbol?: string
    items?: string
  }>()
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const fromName = params.fromName ?? "You"
  const toName = params.toName ?? "Friend"
  const amount = Number(params.amount ?? 0)
  const currency = params.currency ?? "INR"
  const symbol = params.symbol ?? currency
  const items = parseItems(params.items)

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: C.text, fontSize: 28, fontWeight: "800" }}>Summary</Text>
            <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: C.iconBg, borderRadius: 22, padding: 10 }}>
              <Ionicons name="close" size={20} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(36, insets.bottom + 24) }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginBottom: 24, backgroundColor: "rgba(99,102,241,0.12)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", padding: 24, alignItems: "center" }}>
            <Text style={{ color: C.textSub, fontSize: 17, marginBottom: 12 }}>
              {fromName} owes {toName}
            </Text>
            <Text style={{ color: C.accentText, fontWeight: "800", fontSize: 34 }}>
              {formatCurrency(amount, symbol, currency)}
            </Text>
          </View>

          {items.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32 }}>
              <Text style={{ color: C.textMuted, fontSize: 14 }}>No expense breakdown available</Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {items.map((item, idx) => (
                <View
                  key={`${item.description}-${item.date}-${idx}`}
                  style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: item.isCredit ? "rgba(74,222,128,0.18)" : C.border, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.isCredit ? "rgba(74,222,128,0.16)" : "rgba(99,102,241,0.16)", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: item.isCredit ? C.positive : C.accentText, fontWeight: "800", fontSize: 15 }}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: "700", fontSize: 17 }} numberOfLines={1}>{item.description}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>{formatDate(item.date)}</Text>
                    {item.isCredit && (
                      <Text style={{ color: C.positive, fontSize: 13, fontWeight: "700", marginTop: 4 }}>Paid by {fromName} · reduces debt</Text>
                    )}
                  </View>
                  <Text style={{ color: item.isCredit ? C.positive : C.text, fontWeight: "800", fontSize: 18 }}>
                    {item.isCredit ? "-" : ""}{formatCurrency(item.amount, symbol, currency)}
                  </Text>
                </View>
              ))}

              <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: C.textSub, fontWeight: "700", fontSize: 17 }}>Net balance</Text>
                <Text style={{ color: C.accentText, fontWeight: "800", fontSize: 22 }}>
                  {formatCurrency(amount, symbol, currency)}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

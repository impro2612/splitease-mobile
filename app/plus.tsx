import { useEffect, useRef, useState } from "react"
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useQueryClient } from "@tanstack/react-query"
import Toast from "react-native-toast-message"
import { Text } from "@/components/ui/Typography"
import { Celebration } from "@/components/ui/Celebration"
import { tokens, useTheme } from "@/lib/theme"
import { MORE_ITEMS } from "@/lib/navigation"
import { plusApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { PLUS_FEATURES, PLUS_PRICES, buyPlan, loadPlans, paymentsReady, restorePurchases, usePlus, type PlusPlans } from "@/lib/plus"

const FREE_FOREVER = ["Groups & unlimited expenses", "Balances & settle up", "Friends & chat", "Activity & notifications"]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

export default function PlusScreen() {
  const C = useTheme()
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)
  const { status } = usePlus()
  const [plans, setPlans] = useState<PlusPlans>({})
  const [choice, setChoice] = useState<"yearly" | "monthly">("yearly")
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null)

  useEffect(() => {
    if (!paymentsReady || !userId) return
    loadPlans(userId).then(setPlans).catch(() => {})
  }, [userId])

  const features = MORE_ITEMS.filter((i) => PLUS_FEATURES.has(i.key))
  const isPlus = status?.plan === "plus"

  // Confetti each time a Plus member opens this page (and right after subscribing)
  const [celebrate, setCelebrate] = useState(false)
  const celebrated = useRef(false)
  useEffect(() => {
    if (isPlus && !celebrated.current) { celebrated.current = true; setCelebrate(true) }
  }, [isPlus])
  const selected = plans[choice]
  const canBuy = paymentsReady && !!selected && !isPlus

  async function subscribe() {
    if (!userId || !selected) return
    setBusy("buy")
    try {
      if (await buyPlan(userId, selected)) {
        await qc.invalidateQueries({ queryKey: ["plus-status"] })
        Toast.show({ type: "success", text1: "Welcome to SplitIT Plus!" })
      }
    } catch (e: any) {
      Toast.show({ type: "error", text1: e?.message ?? "Purchase failed" })
    } finally {
      setBusy(null)
    }
  }

  async function restore() {
    if (!userId) return
    setBusy("restore")
    try {
      await restorePurchases(userId)
      const fresh = (await plusApi.status()).data
      qc.setQueryData(["plus-status"], fresh)
      Toast.show(fresh?.plan === "plus"
        ? { type: "success", text1: "Plus restored" }
        : { type: "info", text1: "No active subscription found" })
    } catch (e: any) {
      Toast.show({ type: "error", text1: e?.message ?? "Restore failed" })
    } finally {
      setBusy(null)
    }
  }

  const headline = isPlus
    ? `Yeyy!! 🎉 You're on Plus${status?.plusUntil ? ` until\n${formatDate(status.plusUntil)}` : ""}`
    : status?.plan === "free"
      ? "Your free trial has ended"
      : status?.daysLeft != null
        ? `${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"} of free Plus left`
        : "You have every feature free during your trial"
  const sub = isPlus
    ? "Thanks for supporting SplitIT. Every feature is unlocked."
    : "Splitting stays free forever. Plus unlocks everything else."

  const planCard = (key: "yearly" | "monthly") => {
    const active = choice === key
    const pkg = plans[key]
    const price = pkg?.product.priceString ?? PLUS_PRICES[key]
    return (
      <TouchableOpacity
        key={key}
        activeOpacity={0.8}
        onPress={() => setChoice(key)}
        style={{ flex: 1, padding: 16, borderRadius: tokens.radius.lg, backgroundColor: C.card, borderWidth: 2, borderColor: active ? tokens.accent : C.border }}
      >
        {key === "yearly" && (
          <View style={{ position: "absolute", top: -11, right: 12, backgroundColor: tokens.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Save 15%</Text>
          </View>
        )}
        <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600" }}>{key === "yearly" ? "Yearly" : "Monthly"}</Text>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: "800", marginTop: 4 }}>{price}</Text>
        <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{key === "yearly" ? "per year" : "per month"}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", flex: 1 }}>SplitIT Plus</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: tokens.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="sparkles" size={30} color={C.accentText} />
          </View>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: "800", marginTop: 14, textAlign: "center" }}>{headline}</Text>
          <Text style={{ color: C.textSub, fontSize: 14, marginTop: 6, textAlign: "center" }}>{sub}</Text>
        </View>

        <View style={{ backgroundColor: C.card, borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: C.border, padding: 16 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 6 }}>Included with Plus</Text>
          {features.map((f) => (
            <View key={f.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: f.bg, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={f.icon} size={18} color={f.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: "600" }}>{f.title}</Text>
                <Text style={{ color: C.textMuted, fontSize: 12 }}>{f.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: C.card, borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: C.border, padding: 16, marginTop: 12 }}>
          <Text style={{ color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 6 }}>Always free</Text>
          {FREE_FOREVER.map((t) => (
            <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 }}>
              <Ionicons name="checkmark-circle" size={18} color={C.positive} />
              <Text style={{ color: C.textSub, fontSize: 14 }}>{t}</Text>
            </View>
          ))}
        </View>

        {!isPlus && (
          <>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              {planCard("yearly")}
              {planCard("monthly")}
            </View>
            <TouchableOpacity
              disabled={!canBuy || busy !== null}
              onPress={subscribe}
              activeOpacity={0.85}
              style={{ marginTop: 16, height: 54, borderRadius: tokens.radius.lg, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center", opacity: canBuy ? 1 : 0.5 }}
            >
              {busy === "buy"
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{paymentsReady ? "Subscribe" : "Subscriptions coming soon"}</Text>}
            </TouchableOpacity>
          </>
        )}

        {isPlus && (
          <TouchableOpacity
            onPress={() => Linking.openURL(Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions")}
            style={{ marginTop: 24, height: 50, borderRadius: tokens.radius.lg, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: C.text, fontSize: 15, fontWeight: "600" }}>Manage subscription</Text>
          </TouchableOpacity>
        )}

        {paymentsReady && (
          <TouchableOpacity disabled={busy !== null} onPress={restore} style={{ alignSelf: "center", paddingVertical: 14 }}>
            {busy === "restore"
              ? <ActivityIndicator color={C.textSub} />
              : <Text style={{ color: C.accentText, fontSize: 14, fontWeight: "600" }}>Restore purchases</Text>}
          </TouchableOpacity>
        )}

        <Text style={{ color: C.textMuted, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 8 }}>
          Plus renews automatically until you cancel. Cancel any time in your {Platform.OS === "ios" ? "App Store" : "Google Play"} subscriptions at least 24 hours before the renewal date. Your data is never deleted if Plus ends.
        </Text>
      </ScrollView>
      <Celebration visible={celebrate} onDone={() => setCelebrate(false)} message="Yeyy!! You're on Plus" />
    </SafeAreaView>
  )
}

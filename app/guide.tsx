import { useMemo, useState } from "react"
import { View, ScrollView, TouchableOpacity, Linking, LayoutAnimation, Platform, UIManager } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Text, TextInput } from "@/components/ui/Typography"
import { tokens, useTheme } from "@/lib/theme"
import { haptic } from "@/lib/haptics"
import { GUIDE_FAQ, GUIDE_SECTIONS as ALL_SECTIONS, QUICK_START, type GuideSection } from "@/lib/guide"
import { BottomTabBar } from "@/components/ui/BottomTabBar"

// Auto expense tracking only exists on Android
const GUIDE_SECTIONS = Platform.OS === "android" ? ALL_SECTIONS : ALL_SECTIONS.filter((s) => s.key !== "track")

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const SUPPORT_EMAIL = "support.splitit@gmail.com"

/** Lower-cased text a section or question can be found by */
const sectionText = (s: GuideSection) => [s.title, s.summary, s.about, ...s.steps, ...(s.tips ?? [])].join(" ").toLowerCase()

/** Features & guide: a beginner-friendly walkthrough of everything in the app. */
export default function Guide() {
  const C = useTheme()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const q = query.trim().toLowerCase()
  const sections = useMemo(() => (q ? GUIDE_SECTIONS.filter((s) => sectionText(s).includes(q)) : GUIDE_SECTIONS), [q])
  const faqs = useMemo(
    () => GUIDE_FAQ.map((f, i) => ({ ...f, i })).filter((f) => !q || `${f.q} ${f.a}`.toLowerCase().includes(q)),
    [q]
  )

  const toggle = (key: string) => {
    haptic.tap()
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen((cur) => (cur === key ? null : key))
  }
  const toggleFaq = (i: number) => {
    haptic.tap()
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpenFaq((cur) => (cur === i ? null : i))
  }

  const card = { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.lg }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", flex: 1 }} numberOfLines={1}>Features & guide</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={{ ...card, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 46, marginBottom: 18 }}>
          <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search the guide (e.g. settle, currency)"
            placeholderTextColor={C.textMuted}
            style={{ flex: 1, color: C.text, fontSize: 15 }}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")} accessibilityLabel="Clear search" hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={C.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Quick start — hidden while searching */}
        {!q && (
          <View style={{ backgroundColor: tokens.accentSoft, borderRadius: tokens.radius.xl, borderWidth: 1, borderColor: tokens.accentBorder, padding: 18, marginBottom: 24 }}>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: "800" }}>New to SplitIT?</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginTop: 2, marginBottom: 14 }}>Splitting costs takes four steps:</Text>
            {QUICK_START.map((step, i) => (
              <View key={step.title} style={{ flexDirection: "row", gap: 12, marginBottom: i === QUICK_START.length - 1 ? 0 : 14 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: "700" }}>{step.title}</Text>
                  <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 19, marginTop: 1 }}>{step.text}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Features */}
        {sections.length > 0 && (
          <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, marginLeft: 4 }}>
            Features
          </Text>
        )}
        {sections.map((s) => {
          const expanded = open === s.key || (!!q && sections.length === 1)
          return (
            <View key={s.key} style={{ ...card, marginBottom: 10, overflow: "hidden" }}>
              <TouchableOpacity
                onPress={() => toggle(s.key)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: s.color + "24", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={s.icon} size={20} color={s.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: "700" }}>{s.title}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 1 }} numberOfLines={expanded ? undefined : 1}>{s.summary}</Text>
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={C.textMuted} />
              </TouchableOpacity>

              {expanded && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                  <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginBottom: 14 }}>{s.about}</Text>

                  <Text style={{ color: C.text, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>How to use it</Text>
                  {s.steps.map((step, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: s.color + "24", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                        <Text style={{ color: s.color, fontSize: 12, fontWeight: "800" }}>{i + 1}</Text>
                      </View>
                      <Text style={{ color: C.text, fontSize: 14, lineHeight: 21, flex: 1 }}>{step}</Text>
                    </View>
                  ))}

                  {s.tips?.length ? (
                    <View style={{ backgroundColor: C.iconBg, borderRadius: tokens.radius.md, padding: 12, marginTop: 6, gap: 8 }}>
                      {s.tips.map((tip, i) => (
                        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                          <Ionicons name="bulb-outline" size={15} color={C.textSub} style={{ marginTop: 2 }} />
                          <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 19, flex: 1 }}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {s.route ? (
                    <TouchableOpacity
                      onPress={() => { haptic.tap(); router.push(s.route as any) }}
                      style={{ marginTop: 14, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: s.color + "24", borderRadius: tokens.radius.sm, paddingHorizontal: 14, paddingVertical: 9 }}
                    >
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: "700" }}>{s.routeLabel ?? "Open"}</Text>
                      <Ionicons name="arrow-forward" size={14} color={C.text} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          )
        })}

        {/* FAQ */}
        {faqs.length > 0 && (
          <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 16, marginBottom: 10, marginLeft: 4 }}>
            Common questions
          </Text>
        )}
        {faqs.map((f) => {
          const expanded = openFaq === f.i
          return (
            <TouchableOpacity
              key={f.i}
              onPress={() => toggleFaq(f.i)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={{ ...card, padding: 14, marginBottom: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: "600", flex: 1 }}>{f.q}</Text>
                <Ionicons name={expanded ? "remove" : "add"} size={18} color={C.textMuted} />
              </View>
              {expanded && <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, marginTop: 8 }}>{f.a}</Text>}
            </TouchableOpacity>
          )
        })}

        {sections.length === 0 && faqs.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Ionicons name="search-outline" size={28} color={C.textMuted} />
            <Text style={{ color: C.text, fontSize: 15, fontWeight: "700", marginTop: 10 }}>Nothing found for "{query.trim()}"</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginTop: 4 }}>Try another word, or ask us below.</Text>
          </View>
        )}

        {/* Still stuck */}
        <View style={{ ...card, padding: 16, marginTop: 18, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.positive + "24", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="help-buoy" size={20} color={C.positive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: "700" }}>Still stuck?</Text>
            <Text style={{ color: C.textSub, fontSize: 13, marginTop: 1 }}>Email the SplitIT team and we'll help.</Text>
          </View>
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("SplitIT help")}`)}
            style={{ backgroundColor: tokens.accent, borderRadius: tokens.radius.sm, paddingHorizontal: 14, paddingVertical: 9 }}
          >
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Email us</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <BottomTabBar />
    </SafeAreaView>
  )
}

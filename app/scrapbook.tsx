import { useRef, useState, useEffect, useCallback } from "react"
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  FlatList, Animated, Dimensions, ScrollView, StyleSheet,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useQuery } from "@tanstack/react-query"
import { wrappedApi } from "@/lib/api"
import LinearGradient from "react-native-linear-gradient"

const { width: SCREEN_W } = Dimensions.get("window")

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍕", travel: "✈️", accommodation: "🏨", entertainment: "🎉",
  shopping: "🛍️", transport: "🚗", drinks: "🍻", health: "💊",
  utilities: "💡", general: "💰", groceries: "🛒", sports: "⚽",
}

const SLIDES = [
  "intro", "groups", "cities", "wildest", "category", "generous", "balance", "outro",
] as const
type SlideId = typeof SLIDES[number]

type WrappedData = {
  year: number
  availableYears: number[]
  empty: boolean
  totalGroups?: number
  totalSpent?: number
  locations?: string[]
  wildestTrip?: { name: string; emoji: string; total: number; members: number; days: number | null; location: string | null }
  topCategory?: { name: string; total: number; pct: number } | null
  mostGenerous?: { name: string; count: number; total: number } | null
  owedToUser?: number
  userOwes?: number
}

// Formats cents → currency string
function fmt(cents: number, currency = "INR") {
  const n = cents / 100
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`
  return `₹${n.toFixed(0)}`
}

// Animated count-up number
function CountUp({ target, duration = 1200, style }: { target: number; duration?: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    anim.setValue(0)
    const listener = anim.addListener(({ value }) => setDisplay(Math.floor(value)))
    Animated.timing(anim, { toValue: target, duration, useNativeDriver: false }).start()
    return () => anim.removeListener(listener)
  }, [target])

  return <Text style={style}>{display}</Text>
}

function SlideIntro({ data }: { data: WrappedData }) {
  const scale = useRef(new Animated.Value(0.7)).current
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start()
  }, [])
  return (
    <LinearGradient colors={["#1a0533", "#3b0764", "#1a0533"]} style={styles.slide}>
      <Text style={{ fontSize: 80, marginBottom: 8 }}>✨</Text>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Text style={styles.label}>YOUR</Text>
        <Text style={[styles.heroNumber, { color: "#e9d5ff" }]}>{data.year}</Text>
        <Text style={styles.label}>IN MONEY</Text>
      </Animated.View>
      <Text style={[styles.subtitle, { marginTop: 32 }]}>
        Swipe to see your year in review →
      </Text>
    </LinearGradient>
  )
}

function SlideGroups({ data }: { data: WrappedData }) {
  return (
    <LinearGradient colors={["#0f2027", "#203a43", "#2c5364"]} style={styles.slide}>
      <Text style={{ fontSize: 64, marginBottom: 16 }}>👥</Text>
      <Text style={styles.label}>YOU SHARED MEMORIES WITH</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
        <CountUp target={data.totalGroups ?? 0} style={styles.heroNumber} />
        <Text style={[styles.heroUnit, { marginBottom: 10 }]}>group{(data.totalGroups ?? 0) !== 1 ? "s" : ""}</Text>
      </View>
      <Text style={styles.subtitle}>Bonds built over shared bills 💙</Text>
    </LinearGradient>
  )
}

function SlideCities({ data }: { data: WrappedData }) {
  const locs = data.locations ?? []
  return (
    <LinearGradient colors={["#0d1b2a", "#1b4332", "#081c15"]} style={styles.slide}>
      <Text style={{ fontSize: 64, marginBottom: 16 }}>🌍</Text>
      <Text style={styles.label}>YOU EXPLORED</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
        <CountUp target={locs.length} style={styles.heroNumber} />
        <Text style={[styles.heroUnit, { marginBottom: 10 }]}>{locs.length !== 1 ? "places" : "place"}</Text>
      </View>
      {locs.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 24, paddingHorizontal: 24 }}>
          {locs.map(loc => (
            <View key={loc} style={styles.locPill}>
              <Text style={styles.locText}>📍 {loc}</Text>
            </View>
          ))}
        </View>
      )}
      {locs.length === 0 && <Text style={styles.subtitle}>Add locations to groups to see them here</Text>}
    </LinearGradient>
  )
}

function SlideWildest({ data }: { data: WrappedData }) {
  const trip = data.wildestTrip
  if (!trip) return (
    <LinearGradient colors={["#1a1a2e", "#16213e", "#0f3460"]} style={styles.slide}>
      <Text style={{ fontSize: 64 }}>🏆</Text>
      <Text style={[styles.label, { marginTop: 16 }]}>NO TRIPS YET</Text>
    </LinearGradient>
  )
  return (
    <LinearGradient colors={["#1a1a2e", "#16213e", "#0f3460"]} style={styles.slide}>
      <Text style={{ fontSize: 72, marginBottom: 8 }}>{trip.emoji}</Text>
      <Text style={styles.label}>YOUR WILDEST TRIP</Text>
      <Text style={[styles.heroText, { marginVertical: 12 }]}>{trip.name}</Text>
      <Text style={[styles.heroNumber, { fontSize: 52 }]}>{fmt(trip.total)}</Text>
      <View style={{ flexDirection: "row", gap: 20, marginTop: 20 }}>
        {trip.days && (
          <View style={styles.statBadge}>
            <Text style={styles.statVal}>{trip.days}</Text>
            <Text style={styles.statLabel}>days</Text>
          </View>
        )}
        <View style={styles.statBadge}>
          <Text style={styles.statVal}>{trip.members}</Text>
          <Text style={styles.statLabel}>people</Text>
        </View>
        {trip.location && (
          <View style={styles.statBadge}>
            <Text style={styles.statVal}>📍</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{trip.location}</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  )
}

function SlideCategory({ data }: { data: WrappedData }) {
  const cat = data.topCategory
  const emoji = cat ? (CATEGORY_EMOJI[cat.name.toLowerCase()] ?? "💰") : "💰"
  return (
    <LinearGradient colors={["#2d1b00", "#78350f", "#431407"]} style={styles.slide}>
      <Text style={{ fontSize: 80, marginBottom: 8 }}>{emoji}</Text>
      <Text style={styles.label}>TOP SPENDING CATEGORY</Text>
      <Text style={[styles.heroText, { marginVertical: 12, textTransform: "capitalize" }]}>
        {cat?.name ?? "—"}
      </Text>
      {cat && (
        <>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
            <CountUp target={cat.pct} style={[styles.heroNumber, { fontSize: 72, color: "#fbbf24" }]} />
            <Text style={[styles.heroUnit, { marginBottom: 14, color: "#fbbf24" }]}>%</Text>
          </View>
          <Text style={styles.subtitle}>of all your group spending</Text>
        </>
      )}
    </LinearGradient>
  )
}

function SlideGenerous({ data }: { data: WrappedData }) {
  const g = data.mostGenerous
  return (
    <LinearGradient colors={["#0c0a1e", "#1e1b4b", "#312e81"]} style={styles.slide}>
      <Text style={{ fontSize: 72, marginBottom: 8 }}>🏅</Text>
      <Text style={styles.label}>MOST GENEROUS</Text>
      {g ? (
        <>
          <Text style={[styles.heroText, { marginVertical: 14 }]}>{g.name}</Text>
          <Text style={styles.subtitle}>
            Covered <Text style={{ color: "#a5b4fc", fontWeight: "800" }}>{fmt(g.total)}</Text> across your groups
          </Text>
          <Text style={[styles.subtitle, { marginTop: 8, opacity: 0.7 }]}>
            Paid first {g.count} time{g.count !== 1 ? "s" : ""}
          </Text>
        </>
      ) : (
        <Text style={[styles.subtitle, { marginTop: 16 }]}>Add expenses to see who's most generous</Text>
      )}
    </LinearGradient>
  )
}

function SlideBalance({ data }: { data: WrappedData }) {
  const owed = (data.owedToUser ?? 0) / 100
  const owes = (data.userOwes ?? 0) / 100
  const net = owed - owes
  const positive = net >= 0
  return (
    <LinearGradient colors={positive ? ["#052e16", "#14532d", "#166534"] : ["#2d0a0a", "#7f1d1d", "#991b1b"]} style={styles.slide}>
      <Text style={{ fontSize: 72, marginBottom: 8 }}>{positive ? "💚" : "💸"}</Text>
      <Text style={styles.label}>YOUR BALANCE</Text>
      <Text style={[styles.heroNumber, { fontSize: 52, color: positive ? "#4ade80" : "#f87171", marginTop: 12 }]}>
        {positive ? "+" : "-"}{fmt(Math.abs(net) * 100)}
      </Text>
      <Text style={styles.subtitle}>
        {positive
          ? `Friends owe you ${fmt((data.owedToUser ?? 0))} overall`
          : `You owe ${fmt((data.userOwes ?? 0))} across groups`}
      </Text>
    </LinearGradient>
  )
}

function SlideOutro({ data, year }: { data: WrappedData; year: number }) {
  const bounce = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return (
    <LinearGradient colors={["#1a0533", "#4c1d95", "#1a0533"]} style={styles.slide}>
      <Animated.Text style={{ fontSize: 80, transform: [{ scale: bounce }] }}>🎊</Animated.Text>
      <Text style={[styles.label, { marginTop: 20 }]}>THAT WAS</Text>
      <Text style={[styles.heroNumber, { color: "#e9d5ff" }]}>{year}</Text>
      <Text style={[styles.subtitle, { marginTop: 8 }]}>Here's to even more adventures ahead</Text>
      <View style={{ marginTop: 36 }}>
        <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center" }}>
          Made with SplitEase ✨
        </Text>
      </View>
    </LinearGradient>
  )
}

export default function ScrapBook() {
  const insets = useSafeAreaInsets()
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const listRef = useRef<FlatList>(null)

  const { data, isLoading } = useQuery<WrappedData>({
    queryKey: ["wrapped", selectedYear],
    queryFn: async () => { const r = await wrappedApi.get(selectedYear ?? undefined); return r.data },
  })

  const activeYear = selectedYear ?? data?.availableYears?.[0] ?? new Date().getFullYear()
  const availableYears = data?.availableYears ?? []

  const visibleSlides: SlideId[] = data?.empty
    ? ["intro", "outro"]
    : ["intro", "groups", "cities", "wildest", "category", "generous", "balance", "outro"]

  const handleYearSelect = (y: number) => {
    setSelectedYear(y)
    setActiveSlide(0)
    listRef.current?.scrollToIndex({ index: 0, animated: false })
  }

  const renderSlide = useCallback(({ item }: { item: SlideId }) => {
    if (!data) return null
    const slideMap: Record<SlideId, JSX.Element> = {
      intro: <SlideIntro data={data} />,
      groups: <SlideGroups data={data} />,
      cities: <SlideCities data={data} />,
      wildest: <SlideWildest data={data} />,
      category: <SlideCategory data={data} />,
      generous: <SlideGenerous data={data} />,
      balance: <SlideBalance data={data} />,
      outro: <SlideOutro data={data} year={activeYear} />,
    }
    return <View style={{ width: SCREEN_W }}>{slideMap[item]}</View>
  }, [data, activeYear])

  const totalHeight = Dimensions.get("window").height - insets.top - 60

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0a1e" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color="#f1f5f9" />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(244,63,94,0.15)", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="sparkles-outline" size={20} color="#f43f5e" />
        </View>
        <Text style={{ color: "#f1f5f9", fontSize: 20, fontWeight: "800", flex: 1 }}>ScrapBook</Text>

        {/* Year pills */}
        {availableYears.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 6 }}>
            {availableYears.map(y => (
              <TouchableOpacity
                key={y}
                onPress={() => handleYearSelect(y)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16,
                  backgroundColor: y === activeYear ? "#7c3aed" : "rgba(255,255,255,0.08)",
                  borderWidth: 1, borderColor: y === activeYear ? "#a78bfa" : "rgba(255,255,255,0.12)",
                }}
              >
                <Text style={{ color: y === activeYear ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: "700" }}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#a78bfa" size="large" />
          <Text style={{ color: "#94a3b8", marginTop: 12, fontSize: 13 }}>Building your recap…</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={visibleSlides}
            renderItem={renderSlide}
            keyExtractor={item => item}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
              setActiveSlide(idx)
            }}
            getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
            style={{ height: totalHeight }}
          />

          {/* Dot indicator */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingVertical: 14 }}>
            {visibleSlides.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { listRef.current?.scrollToIndex({ index: i, animated: true }); setActiveSlide(i) }}
              >
                <View style={{
                  width: i === activeSlide ? 20 : 6,
                  height: 6, borderRadius: 3,
                  backgroundColor: i === activeSlide ? "#a78bfa" : "rgba(255,255,255,0.2)",
                }} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  slide: {
    width: SCREEN_W,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  label: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    textAlign: "center",
    marginBottom: 4,
  },
  heroNumber: {
    color: "#ffffff",
    fontSize: 88,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -2,
  },
  heroUnit: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 28,
    fontWeight: "700",
  },
  heroText: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  locPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  locText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  statBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  statVal: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    marginTop: 2,
    maxWidth: 80,
    textAlign: "center",
  },
})

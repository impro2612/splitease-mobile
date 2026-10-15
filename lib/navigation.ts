import type { Ionicons } from "@expo/vector-icons"

type IconName = keyof typeof Ionicons.glyphMap

/**
 * Single source of truth for the bottom navigation and the More sheet, shared by the real
 * tab layout and the BottomTabBar shown on stacked screens (group detail etc.).
 */
export const TABS: { key: string; label: string; route: string; icon: IconName; iconActive: IconName }[] = [
  { key: "dashboard", label: "Home", route: "/(tabs)/dashboard", icon: "home-outline", iconActive: "home" },
  { key: "groups", label: "Groups", route: "/(tabs)/groups", icon: "people-outline", iconActive: "people" },
  { key: "activity", label: "Activity", route: "/(tabs)/activity", icon: "pulse-outline", iconActive: "pulse" },
  { key: "friends", label: "Friends", route: "/(tabs)/friends", icon: "person-add-outline", iconActive: "person-add" },
  { key: "more", label: "More", route: "", icon: "grid-outline", iconActive: "grid" },
]

// Each feature keeps its own colour in the More menu so items are recognisable at a glance
export const MORE_ITEMS: { key: string; icon: IconName; color: string; bg: string; title: string; subtitle: string; route: string }[] = [
  { key: "profile", icon: "person-circle-outline", color: "#818cf8", bg: "rgba(129,140,248,0.14)", title: "Profile & settings", subtitle: "Account, currency, appearance, notifications", route: "/(tabs)/profile" },
  { key: "spending", icon: "receipt-outline", color: "#fb923c", bg: "rgba(251,146,60,0.14)", title: "My Spending", subtitle: "Import bank statements, see where money goes", route: "/(tabs)/expenses" },
  { key: "borrow-book", icon: "book-outline", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", title: "Borrow Book", subtitle: "Personal IOUs with friends", route: "/borrow-book" },
  { key: "trip-planner", icon: "airplane-outline", color: "#10b981", bg: "rgba(16,185,129,0.12)", title: "Trip Planner", subtitle: "Plan and track trip budgets", route: "/trip-planner" },
  { key: "timeline", icon: "images-outline", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", title: "Timeline", subtitle: "Your trips on a map", route: "/timeline" },
  { key: "scrapbook", icon: "sparkles-outline", color: "#f43f5e", bg: "rgba(244,63,94,0.12)", title: "ScrapBook", subtitle: "Your year in money — shareable", route: "/scrapbook" },
  { key: "spend-diary", icon: "journal-outline", color: "#06b6d4", bg: "rgba(6,182,212,0.12)", title: "Spend Diary", subtitle: "Private notes of what you spend", route: "/spend-diary" },
]

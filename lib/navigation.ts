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

// One accent for every feature — they're parts of one app, not separate mini-apps.
export const MORE_ITEMS: { key: string; icon: IconName; title: string; subtitle: string; route: string }[] = [
  { key: "profile", icon: "person-circle-outline", title: "Profile & settings", subtitle: "Account, currency, appearance, notifications", route: "/(tabs)/profile" },
  { key: "spending", icon: "wallet-outline", title: "My Spending", subtitle: "Import bank statements, see where money goes", route: "/(tabs)/expenses" },
  { key: "borrow-book", icon: "book-outline", title: "Borrow Book", subtitle: "Personal IOUs with friends", route: "/borrow-book" },
  { key: "trip-planner", icon: "airplane-outline", title: "Trip Planner", subtitle: "Plan and track trip budgets", route: "/trip-planner" },
  { key: "spend-diary", icon: "journal-outline", title: "Spend Diary", subtitle: "Private notes of what you spend", route: "/spend-diary" },
  { key: "timeline", icon: "map-outline", title: "Timeline", subtitle: "Your trips on a map", route: "/timeline" },
  { key: "scrapbook", icon: "sparkles-outline", title: "ScrapBook", subtitle: "Your year in money — shareable", route: "/scrapbook" },
]

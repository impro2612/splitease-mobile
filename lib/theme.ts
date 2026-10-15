import { useColorScheme } from "react-native"
import { useAuthStore } from "@/store/auth"

export const dark = {
  bg: "#0a0a1a",
  surface: "#12121f",
  card: "#1a1a2e",
  cardAlt: "#0f0f1f",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.12)",
  text: "#ffffff",
  textSub: "#a3b1c6",
  textMuted: "#7c8aa5",
  tabBar: "#12121f",
  tabBorder: "rgba(255,255,255,0.06)",
  inputBg: "#1a1a2e",
  inputBorder: "rgba(255,255,255,0.1)",
  iconBg: "rgba(255,255,255,0.06)",
  overlay: "rgba(0,0,0,0.65)",
  // Text/icon colours that must stay readable on this theme's cards
  accentText: "#a5b4fc",
  positive: "#4ade80",
  negative: "#f87171",
  isDark: true,
}

export const light = {
  bg: "#f8fafc",
  surface: "#f1f5f9",
  card: "#ffffff",
  cardAlt: "#f8fafc",
  border: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.14)",
  text: "#0f172a",
  textSub: "#475569",
  textMuted: "#64748b",
  tabBar: "#ffffff",
  tabBorder: "rgba(0,0,0,0.08)",
  inputBg: "#f1f5f9",
  inputBorder: "rgba(0,0,0,0.1)",
  iconBg: "rgba(0,0,0,0.05)",
  overlay: "rgba(0,0,0,0.5)",
  accentText: "#4f46e5",
  positive: "#16a34a",
  negative: "#dc2626",
  isDark: false,
}

export type ThemeColors = typeof dark

/**
 * Design tokens shared by every screen. One accent colour for the whole app; green/red are
 * reserved for money coming in / going out and must not be used decoratively.
 */
export const tokens = {
  accent: "#6366f1",
  accentText: "#a5b4fc",
  accentSoft: "rgba(99,102,241,0.14)",
  accentBorder: "rgba(99,102,241,0.35)",
  positive: "#4ade80",
  positiveSoft: "rgba(74,222,128,0.12)",
  negative: "#f87171",
  negativeSoft: "rgba(248,113,113,0.12)",
  warning: "#f59e0b",
  radius: { sm: 10, md: 14, lg: 16, xl: 24 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  font: "Inter",
} as const

export type Accent = {
  /** Filled buttons, active pills, progress bars */
  solid: string
  /** Text/icons drawn on top of `solid` */
  onSolid: string
  /** Tinted text and icons on the page background (dark theme; see useFeatureAccent) */
  text: string
  /** Same as `text`, dark enough to read on the light theme */
  textLight: string
  soft: string
  border: string
}

/**
 * Feature pages from the More menu carry the colour of their More-menu icon (see
 * lib/navigation MORE_ITEMS) instead of the app-wide indigo. Lime and amber are too light
 * for white text, so their filled buttons use dark text.
 */
export const featureAccents = {
  spending:   { solid: "#a3e635", onSolid: "#1a2e05", text: "#a3e635", textLight: "#4d7c0f", soft: "rgba(163,230,53,0.14)", border: "rgba(163,230,53,0.35)" },
  borrowBook: { solid: "#f59e0b", onSolid: "#2a1700", text: "#fbbf24", textLight: "#b45309", soft: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.35)" },
  trips:      { solid: "#10b981", onSolid: "#ffffff", text: "#34d399", textLight: "#047857", soft: "rgba(16,185,129,0.14)", border: "rgba(16,185,129,0.35)" },
  timeline:   { solid: "#8b5cf6", onSolid: "#ffffff", text: "#a78bfa", textLight: "#6d28d9", soft: "rgba(167,139,250,0.14)", border: "rgba(167,139,250,0.35)" },
  scrapbook:  { solid: "#f43f5e", onSolid: "#ffffff", text: "#fb7185", textLight: "#be123c", soft: "rgba(244,63,94,0.14)", border: "rgba(244,63,94,0.35)" },
} satisfies Record<string, Accent>

/** A feature's accent with `text` resolved for the current light/dark theme. */
export function useFeatureAccent(key: keyof typeof featureAccents): Accent {
  const C = useTheme()
  const a = featureAccents[key]
  return C.isDark ? a : { ...a, text: a.textLight }
}

export function useTheme(): ThemeColors {
  const themePref = useAuthStore((s) => s.theme)
  const systemScheme = useColorScheme()
  const scheme = themePref === "system" ? systemScheme : themePref
  return scheme === "light" ? light : dark
}

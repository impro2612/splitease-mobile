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

export function useTheme(): ThemeColors {
  const themePref = useAuthStore((s) => s.theme)
  const systemScheme = useColorScheme()
  const scheme = themePref === "system" ? systemScheme : themePref
  return scheme === "light" ? light : dark
}

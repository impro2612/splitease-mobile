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
  textSub: "#94a3b8",
  textMuted: "#475569",
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
  textMuted: "#94a3b8",
  tabBar: "#ffffff",
  tabBorder: "rgba(0,0,0,0.08)",
  inputBg: "#f1f5f9",
  inputBorder: "rgba(0,0,0,0.1)",
  iconBg: "rgba(0,0,0,0.05)",
  overlay: "rgba(0,0,0,0.5)",
  isDark: false,
}

export type ThemeColors = typeof dark

export function useTheme(): ThemeColors {
  const themePref = useAuthStore((s) => s.theme)
  const systemScheme = useColorScheme()
  const scheme = themePref === "system" ? systemScheme : themePref
  return scheme === "light" ? light : dark
}

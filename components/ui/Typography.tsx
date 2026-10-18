import { forwardRef } from "react"
import { Text as RNText, TextInput as RNTextInput, StyleSheet, type TextProps, type TextInputProps } from "react-native"
import { tokens } from "@/lib/theme"

// React Native has no global default font, so every screen imports Text/TextInput from
// here. Inter is registered as one family with real weight files (see app.json → expo-font),
// so fontWeight keeps working; an explicit fontFamily in `style` still wins.
const base = { fontFamily: tokens.font }

// Two-face type system: Plus Jakarta Sans for display text (page titles, big amounts —
// anything 20px and up), Inter for everything else. Display text tops out at Bold except
// for really large numbers, so headings stop shouting.
const DISPLAY_MIN_SIZE = 20

function typeface(style: TextProps["style"]) {
  const flat = StyleSheet.flatten(style) ?? {}
  if (flat.fontFamily || !flat.fontSize || flat.fontSize < DISPLAY_MIN_SIZE) return base
  const heavy = flat.fontWeight === "800" || flat.fontWeight === "900"
  return { fontFamily: tokens.fontDisplay, ...(heavy && flat.fontSize < 32 ? { fontWeight: "700" as const } : null) }
}

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  const face = typeface(style)
  return <RNText ref={ref} {...rest} style={face === base ? [base, style] : [style, face]} />
})

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  return <RNTextInput ref={ref} {...rest} style={[base, style]} />
})

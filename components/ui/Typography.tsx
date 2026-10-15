import { forwardRef } from "react"
import { Text as RNText, TextInput as RNTextInput, type TextProps, type TextInputProps } from "react-native"
import { tokens } from "@/lib/theme"

// React Native has no global default font, so every screen imports Text/TextInput from
// here. Inter is registered as one family with real weight files (see app.json → expo-font),
// so fontWeight keeps working; an explicit fontFamily in `style` still wins.
const base = { fontFamily: tokens.font }

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  return <RNText ref={ref} {...rest} style={[base, style]} />
})

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  return <RNTextInput ref={ref} {...rest} style={[base, style]} />
})

import { useEffect, useState } from "react"
import { Platform } from "react-native"
import * as AppleAuthentication from "expo-apple-authentication"
import { useAuthStore } from "@/store/auth"
import { useTheme } from "@/lib/theme"

/**
 * Apple's own "Sign in with Apple" button (App Store rules require the native one).
 * iOS only — renders nothing on Android or where Apple sign-in isn't available.
 */
export function AppleSignInButton({ mode, disabled, onStart, onSuccess, onError }: {
  mode: "signin" | "signup"
  disabled?: boolean
  onStart?: () => void
  onSuccess: (needsPhone: boolean) => void
  onError: (message: string) => void
}) {
  const { appleSignIn } = useAuthStore()
  const C = useTheme()
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAvailable).catch(() => {})
  }, [])

  if (!available) return null

  async function handlePress() {
    if (disabled) return
    onStart?.()
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
      if (!cred.identityToken) throw new Error("No identity token returned")
      const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(" ")
      const { needsPhone } = await appleSignIn(cred.identityToken, fullName, mode, cred.authorizationCode)
      onSuccess(needsPhone)
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") { onError(""); return }
      onError(e?.response?.data?.error ?? "Apple sign-in failed. Please try again.")
    }
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={mode === "signup"
        ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
        : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={C.isDark
        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={16}
      style={{ height: 56, marginTop: 12, opacity: disabled ? 0.6 : 1 }}
      onPress={handlePress}
    />
  )
}

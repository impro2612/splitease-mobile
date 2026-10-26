import { useCallback } from "react"
import { BackHandler } from "react-native"
import { router, useFocusEffect } from "expo-router"

/** Back out of a feature to the Home tab, however the feature was reached. */
export function goHome() {
  router.dismissTo("/(tabs)/dashboard" as any)
}

/**
 * Android's back button/gesture follows the on-screen back arrow on a feature's main page:
 * straight to Home. `onBack` overrides it (e.g. closing an inner view first).
 * Open sheets are Modals, so they still get the back press before this does.
 */
export function useBackToHome(onBack?: () => void) {
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        ;(onBack ?? goHome)()
        return true
      })
      return () => sub.remove()
    }, [onBack]),
  )
}

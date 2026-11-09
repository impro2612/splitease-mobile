import { useEffect, useRef, useState } from "react"
import { Keyboard, Platform } from "react-native"

type Options = {
  /** Only report a height on Android (iOS screens that use KeyboardAvoidingView pass this). */
  androidOnly?: boolean
  /** Runs after the keyboard has appeared (e.g. scroll a list or field into view). */
  onShow?: () => void
}

/**
 * The on-screen keyboard's height and top edge (window coordinates), 0 when hidden.
 *
 * Android runs edge-to-edge, so `softwareKeyboardLayoutMode: "resize"` doesn't shrink the
 * window; screens pad their bottom by `height` instead. On iOS the "will" events fire so the
 * padding animates with the keyboard.
 */
export function useKeyboard({ androidOnly = false, onShow }: Options = {}) {
  const [height, setHeight] = useState(0)
  const [top, setTop] = useState(0)
  const onShowRef = useRef(onShow)
  onShowRef.current = onShow

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const show = Keyboard.addListener(showEvt, (e) => {
      const h = Math.max(0, e.endCoordinates?.height ?? 0)
      setTop(e.endCoordinates?.screenY ?? 0)
      if (!androidOnly || Platform.OS === "android") setHeight(h)
      // iOS fires before the animation; give it time to settle before measuring
      if (onShowRef.current) setTimeout(onShowRef.current, Platform.OS === "ios" ? 250 : 50)
    })
    const hide = Keyboard.addListener(hideEvt, () => { setHeight(0); setTop(0) })
    return () => { show.remove(); hide.remove() }
  }, [androidOnly])

  return { height, top }
}

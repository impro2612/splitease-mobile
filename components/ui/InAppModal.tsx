import { ReactNode, useEffect } from "react"
import { BackHandler, StyleSheet, View } from "react-native"

type InAppFullScreenModalProps = {
  visible: boolean
  onRequestClose?: () => void
  children: ReactNode
}

export function InAppFullScreenModal({ visible, onRequestClose, children }: InAppFullScreenModalProps) {
  useEffect(() => {
    if (!visible || !onRequestClose) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onRequestClose()
      return true
    })
    return () => sub.remove()
  }, [onRequestClose, visible])

  if (!visible) return null

  return (
    <View style={styles.fullScreen} pointerEvents="auto">
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
})

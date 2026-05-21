import React, { useEffect, useRef } from "react"
import {
  Modal, Pressable, View, Text, TouchableOpacity,
  Animated, Dimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window")
const EMOJI_BAR_H = 62
const GAP = 10

export type MenuAnchor = { pageX: number; pageY: number; width: number; height: number }

export type ActionItem = {
  label: string
  icon: string
  color?: string
  bgColor?: string
  onPress: () => void
}

type Props = {
  visible: boolean
  anchor: MenuAnchor | null
  emojis: string[]
  reactedEmojis?: string[]
  onEmojiPress: (emoji: string) => void
  onMoreEmoji?: () => void
  actions?: ActionItem[]
  onDismiss: () => void
}

export default function FloatingContextMenu({
  visible, anchor, emojis, reactedEmojis = [],
  onEmojiPress, onMoreEmoji, actions = [], onDismiss,
}: Props) {
  const C = useTheme()
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.8)
      opacityAnim.setValue(0)
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 220, friction: 14 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  if (!anchor) return null

  const EMOJI_BAR_W = Math.min(SCREEN_W - 32, emojis.length * 52 + (onMoreEmoji ? 52 : 0) + 28)
  const ACTIONS_W = 210
  const ACTIONS_H = actions.length * 50 + (actions.length > 1 ? (actions.length - 1) * 1 : 0) + 16

  const itemMidY = anchor.pageY + anchor.height / 2
  const isLowerHalf = itemMidY > SCREEN_H * 0.52

  let emojiTop: number
  let actionsTop: number

  if (isLowerHalf) {
    emojiTop = anchor.pageY - EMOJI_BAR_H - GAP
    actionsTop = emojiTop - ACTIONS_H - GAP
    if (actionsTop < 60) {
      emojiTop = anchor.pageY + anchor.height + GAP
      actionsTop = emojiTop + EMOJI_BAR_H + GAP
    }
  } else {
    emojiTop = anchor.pageY + anchor.height + GAP
    actionsTop = emojiTop + EMOJI_BAR_H + GAP
  }

  // Clamp horizontal: center on item
  const centerX = anchor.pageX + anchor.width / 2
  const emojiLeft = Math.max(16, Math.min(SCREEN_W - EMOJI_BAR_W - 16, centerX - EMOJI_BAR_W / 2))
  const actionsLeft = Math.max(16, Math.min(SCREEN_W - ACTIONS_W - 16, centerX - ACTIONS_W / 2))

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.68)" }}
        onPress={onDismiss}
      >
        {/* Emoji bar */}
        <Animated.View
          style={{
            position: "absolute",
            top: emojiTop,
            left: emojiLeft,
            width: EMOJI_BAR_W,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#16162a",
              borderRadius: 36,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 20,
            }}
          >
            {emojis.map((emoji) => {
              const isReacted = reactedEmojis.includes(emoji)
              return (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => { onEmojiPress(emoji); onDismiss() }}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    height: 46,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 23,
                    backgroundColor: isReacted ? "rgba(99,102,241,0.3)" : "transparent",
                    borderWidth: isReacted ? 1.5 : 0,
                    borderColor: "#6366f1",
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{emoji}</Text>
                </TouchableOpacity>
              )
            })}
            {onMoreEmoji && (
              <TouchableOpacity
                onPress={onMoreEmoji}
                activeOpacity={0.7}
                style={{
                  width: 46, height: 46, borderRadius: 23,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.07)",
                }}
              >
                <Ionicons name="add" size={22} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            )}
          </Pressable>
        </Animated.View>

        {/* Action items */}
        {actions.length > 0 && (
          <Animated.View
            style={{
              position: "absolute",
              top: actionsTop,
              left: actionsLeft,
              width: ACTIONS_W,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: "#16162a",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.5,
                shadowRadius: 20,
                elevation: 20,
              }}
            >
              {actions.map((action, i) => (
                <React.Fragment key={action.label}>
                  {i > 0 && (
                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 14 }} />
                  )}
                  <TouchableOpacity
                    onPress={() => { action.onPress(); onDismiss() }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row", alignItems: "center",
                      paddingHorizontal: 14, paddingVertical: 13, gap: 12,
                    }}
                  >
                    <View style={{
                      width: 34, height: 34, borderRadius: 10,
                      backgroundColor: action.bgColor ?? "rgba(99,102,241,0.15)",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Ionicons name={action.icon as any} size={17} color={action.color ?? "#a5b4fc"} />
                    </View>
                    <Text style={{ color: action.color ?? C.text, fontSize: 15, fontWeight: "600" }}>
                      {action.label}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </Pressable>
          </Animated.View>
        )}
      </Pressable>
    </Modal>
  )
}

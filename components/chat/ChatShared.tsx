import { useState, useEffect, useRef, useMemo, type ReactNode } from "react"
import { View, TouchableOpacity, FlatList, Platform, Pressable, Modal, Animated, PanResponder, useWindowDimensions } from "react-native"
import { Text, TextInput } from "@/components/ui/Typography"
import { useTheme } from "@/lib/theme"
import CryptoJS from "crypto-js"
import * as ExpoCrypto from "expo-crypto"
import { emojisByCategory } from "rn-emoji-keyboard"

// Pieces shared by the 1:1 chat and the group chat screens

export function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// Quick-react emojis shown in the action sheet bar
export const QUICK_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"]

type EmojiItem = {
  emoji: string
  name: string
  keywords?: string[]
}

type EmojiListRow =
  | { type: "header"; id: string; title: string }
  | { type: "emojis"; id: string; emojis: EmojiItem[] }

const EMOJI_CATEGORY_LABELS: Record<string, string> = {
  smileys_emotion: "Smileys & Emotion",
  people_body: "People & Body",
  animals_nature: "Animals & Nature",
  food_drink: "Food & Drink",
  travel_places: "Travel & Places",
  activities: "Activities",
  objects: "Objects",
  symbols: "Symbols",
  flags: "Flags",
  recently_used: "Recent",
  search: "Search",
}
const EMOJI_COLUMNS = 7
const EMOJI_SOURCE = (emojisByCategory as { title: string; data: EmojiItem[] }[])

export function SwipeDownSheet({
  visible,
  onClose,
  children,
  sheetStyle,
}: {
  visible: boolean
  onClose: () => void
  children: ReactNode
  sheetStyle?: object
}) {
  const { height } = useWindowDimensions()
  const hiddenTranslateY = Math.max(320, height)
  const [mounted, setMounted] = useState(visible)
  const slideAnim = useRef(new Animated.Value(hiddenTranslateY)).current
  const panY = useRef(new Animated.Value(0)).current
  const overlayAnim = useRef(new Animated.Value(0)).current

  const translateY = Animated.add(
    slideAnim,
    panY.interpolate({
      inputRange: [-9999, 0, 9999],
      outputRange: [0, 0, 9999],
    })
  )

  useEffect(() => {
    if (visible) {
      setMounted(true)
      panY.setValue(0)
      slideAnim.setValue(hiddenTranslateY)
      overlayAnim.setValue(0)
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      setMounted(false)
      panY.setValue(0)
      slideAnim.setValue(hiddenTranslateY)
      overlayAnim.setValue(0)
    }
  }, [hiddenTranslateY, overlayAnim, panY, slideAnim, visible])

  function closeSheet() {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: hiddenTranslateY, duration: 220, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      panY.setValue(0)
      setMounted(false)
      onClose()
    })
  }

  const shouldStartDrag = (_: any, g: { dy: number; dx: number }) => g.dy > 8 && g.dy > Math.abs(g.dx)
  const handleDragMove = (_: any, g: { dy: number }) => {
    if (g.dy > 0) panY.setValue(g.dy)
  }
  const handleDragRelease = (_: any, g: { dy: number; vy: number }) => {
    if (g.dy > 80 || g.vy > 0.5) {
      slideAnim.setValue(Math.max(0, g.dy))
      panY.setValue(0)
      closeSheet()
    } else {
      Animated.spring(panY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }).start()
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      // Claim touches that land on the sheet itself (handle, header, blank space) so a
      // downward drag anywhere on it closes the sheet. Buttons/inputs still get taps first.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: shouldStartDrag,
      onPanResponderMove: handleDragMove,
      // Hand the gesture over when a list inside starts scrolling, so lists stay responsive
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: handleDragRelease,
    })
  ).current

  if (!mounted) return null

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={closeSheet} statusBarTranslucent>
      <Animated.View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.58)", opacity: overlayAnim }}>
        <Pressable style={{ flex: 1 }} onPress={closeSheet} />
      </Animated.View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          { position: "absolute", left: 0, right: 0, bottom: 0, transform: [{ translateY }] },
          sheetStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Modal>
  )
}

export function EmojiReactionSheet({
  visible,
  onClose,
  onSelect,
  C,
}: {
  visible: boolean
  onClose: () => void
  onSelect: (emoji: string) => void
  C: ReturnType<typeof useTheme>
}) {
  const [search, setSearch] = useState("")
  const scrollY = useRef(0)
  const touchStartY = useRef<number | null>(null)
  const normalizedSearch = search.trim().toLowerCase()
  const rows = useMemo<EmojiListRow[]>(() => {
    const nextRows: EmojiListRow[] = []
    for (const category of EMOJI_SOURCE) {
      const data = normalizedSearch
        ? category.data.filter((emoji) => {
          const keywords = emoji.keywords ?? []
          return emoji.name.toLowerCase().includes(normalizedSearch)
            || keywords.some((keyword) => keyword.toLowerCase().includes(normalizedSearch))
            || emoji.emoji.includes(search)
        })
        : category.data
      if (data.length === 0) continue
      nextRows.push({ type: "header", id: `${category.title}-header`, title: category.title })
      for (let index = 0; index < data.length; index += EMOJI_COLUMNS) {
        nextRows.push({
          type: "emojis",
          id: `${category.title}-${index}`,
          emojis: data.slice(index, index + EMOJI_COLUMNS),
        })
      }
    }
    return nextRows
  }, [normalizedSearch, search])

  useEffect(() => {
    if (!visible) setSearch("")
  }, [visible])

  function maybeCloseFromEmojiArea(pageY: number) {
    if (touchStartY.current == null) return
    const pulledDown = pageY - touchStartY.current
    if (scrollY.current <= 2 && pulledDown > 110) {
      touchStartY.current = null
      onClose()
    }
  }

  function clearEmojiTouch() {
    touchStartY.current = null
  }

  function renderEmojiRow({ item }: { item: EmojiListRow }) {
    if (item.type === "header") {
      return (
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginTop: 18, marginBottom: 14 }}>
          {EMOJI_CATEGORY_LABELS[item.title] ?? item.title}
        </Text>
      )
    }

    return (
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        {item.emojis.map((emoji, index) => (
          <TouchableOpacity
            key={`${item.id}-${emoji.emoji}-${index}`}
            activeOpacity={0.7}
            onPress={() => onSelect(emoji.emoji)}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 34, lineHeight: 40 }}>{emoji.emoji}</Text>
          </TouchableOpacity>
        ))}
        {Array.from({ length: EMOJI_COLUMNS - item.emojis.length }).map((_, index) => (
          <View key={`spacer-${item.id}-${index}`} style={{ width: 44, height: 44 }} />
        ))}
      </View>
    )
  }

  return (
    <SwipeDownSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={{
        height: "58%",
        backgroundColor: C.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
      }}
    >
      <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 12, backgroundColor: C.card }}>
        <View style={{ width: 48, height: 5, borderRadius: 999, backgroundColor: C.border }} />
      </View>
      <View style={{ paddingHorizontal: 28, paddingBottom: 12, backgroundColor: C.card }}>
        <View style={{ height: 56, borderRadius: 28, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, justifyContent: "center", paddingHorizontal: 22 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search"
            placeholderTextColor={C.textMuted}
            style={{ color: C.text, fontSize: 18, padding: 0 }}
            returnKeyType="search"
          />
        </View>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderEmojiRow}
        style={{ flex: 1, backgroundColor: C.card }}
        contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 24 + insetsBottomFallback() }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y }}
        onTouchStart={(event) => { touchStartY.current = event.nativeEvent.pageY }}
        onTouchMove={(event) => maybeCloseFromEmojiArea(event.nativeEvent.pageY)}
        onTouchEnd={clearEmojiTouch}
        onTouchCancel={clearEmojiTouch}
        initialNumToRender={18}
        maxToRenderPerBatch={14}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        overScrollMode="never"
        ListEmptyComponent={(
          <Text style={{ color: C.textSub, textAlign: "center", paddingTop: 40, fontSize: 16 }}>No emoji found</Text>
        )}
      />
    </SwipeDownSheet>
  )
}

function insetsBottomFallback() {
  return Platform.OS === "android" ? 12 : 0
}

// ─── Encryption helpers ───────────────────────────────────────────────────────
// NOTE: the key is derived from the two user IDs, which the server also knows, so this
// protects stored messages from casual inspection but is NOT end-to-end encryption.
// Real E2E would need per-device key pairs (e.g. X25519) with keys never sent to the server.
export function randomWordArray(size: number) {
  const bytes = ExpoCrypto.getRandomBytes(size)
  return CryptoJS.lib.WordArray.create(Array.from(bytes) as number[])
}
export function encrypt(text: string, sharedKey: string) {
  const key = CryptoJS.SHA256(sharedKey)
  const iv = randomWordArray(16)
  const ciphertext = CryptoJS.AES.encrypt(text, key, { iv }).toString()
  return `${iv.toString(CryptoJS.enc.Base64)}:${ciphertext}`
}
export function decrypt(cipher: string, sharedKey: string) {
  try {
    const key = CryptoJS.SHA256(sharedKey)
    if (cipher.includes(":")) {
      const sep = cipher.indexOf(":")
      const iv = CryptoJS.enc.Base64.parse(cipher.slice(0, sep))
      const ct = cipher.slice(sep + 1)
      return CryptoJS.AES.decrypt(ct, key, { iv }).toString(CryptoJS.enc.Utf8) || cipher
    }
    const iv = CryptoJS.MD5(sharedKey)
    return CryptoJS.AES.decrypt(cipher, key, { iv }).toString(CryptoJS.enc.Utf8) || cipher
  } catch {
    return cipher
  }
}


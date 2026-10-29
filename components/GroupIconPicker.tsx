import { useRef, useState } from "react"
import { View, TouchableOpacity, ActivityIndicator, Linking } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import { ImageManipulator, SaveFormat } from "expo-image-manipulator"
import Toast from "react-native-toast-message"
import { Text } from "@/components/ui/Typography"
import { useTheme } from "@/lib/theme"
import { haptic } from "@/lib/haptics"
import { GROUP_EMOJIS } from "@/lib/utils"
import { groupTheme, suggestGroupIcons } from "@/lib/group-icon"
import { groupImageApi, type GroupImage, type GroupImageCredit } from "@/lib/api"

const UNSPLASH_HOME = "https://unsplash.com/?utm_source=splitit&utm_medium=referral"
const open = (url: string) => Linking.openURL(url).catch(() => {})

// A photo the user can pick: a suggestion, or their own upload (no credit)
type Choice = Omit<GroupImage, "credit"> & { credit: GroupImageCredit | null }

export type PickedImage = { url: string; credit: GroupImageCredit | null }

// The Icon section of Create / Edit Group: emoji grid plus "Auto generate", which finds
// real photos of the place (Wikipedia) or of the theme (Unsplash) and the best emoji.
// Tapping Auto generate again shows more photos and the next emoji.
export function GroupIconPicker({ name, location, emoji, image, onEmoji, onColor, onImage }: {
  name: string
  location?: string | null
  emoji: string
  image: PickedImage | null
  onEmoji: (emoji: string) => void
  onColor: (color: string) => void
  onImage: (image: PickedImage | null) => void
}) {
  const C = useTheme()
  const [shown, setShown] = useState<Choice[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  // wiki: the place photo (if any); pool: Unsplash photos; cursor: which pool photo is shown
  const state = useRef({ key: "", page: 0, hasMore: true, emojiIndex: -1, wiki: null as GroupImage | null, pool: [] as GroupImage[], cursor: 0 })

  function choosePhoto(p: Choice) {
    haptic.tap()
    onImage({ url: p.url, credit: p.credit })
    if (p.downloadLocation) groupImageApi.select(p.downloadLocation).catch(() => {})
  }

  async function fetchPage(page: number) {
    const s = state.current
    const res = await groupImageApi.search({ name, location: location ?? undefined, theme: groupTheme(name) || undefined, page })
    s.page = page
    s.hasMore = res.data.hasMore
    if (page === 1) s.wiki = res.data.images.find((i) => i.credit.source === "wikipedia") ?? null
    s.pool = res.data.images.filter((i) => i.credit.source === "unsplash")
    s.cursor = 0
  }

  // Two choices per tap: the Wikipedia photo of the place + one Unsplash photo,
  // or two Unsplash photos when the name isn't a place
  async function generate() {
    if (loading) return
    if (!name.trim() && !location?.trim()) {
      Toast.show({ type: "info", text1: "Type a group name first", text2: "We'll find a picture that matches it." })
      return
    }
    haptic.tap()
    const key = `${name.trim().toLowerCase()}|${(location ?? "").trim().toLowerCase()}`
    const s = state.current
    const fresh = s.key !== key
    if (fresh) Object.assign(s, { key, page: 0, hasMore: true, emojiIndex: -1, wiki: null, pool: [], cursor: 0 })

    // The emoji updates instantly and is the fallback when there's no photo
    const icons = suggestGroupIcons(name, location)
    s.emojiIndex = (s.emojiIndex + 1) % icons.length
    onEmoji(icons[s.emojiIndex].emoji)
    onColor(icons[s.emojiIndex].color)

    setLoading(true)
    try {
      const step = s.wiki ? 1 : 2
      if (fresh) {
        await fetchPage(1)
      } else if (s.cursor + step * 2 <= s.pool.length) {
        s.cursor += step // next photo(s) from what we already have — no extra search
      } else {
        await fetchPage(s.hasMore ? s.page + 1 : 1) // more photos, or start over
      }
      const unsplash = s.pool.slice(s.cursor, s.cursor + (s.wiki ? 1 : 2))
      const next = [...(s.wiki ? [s.wiki] : []), ...unsplash]
      setShown(next)
      if (next.length > 0) {
        choosePhoto(next[0])
      } else {
        onImage(null)
        Toast.show({ type: "info", text1: "No photo found", text2: "Picked the best emoji instead." })
      }
    } catch {
      Toast.show({ type: "info", text1: "Couldn't load photos", text2: "Picked the best emoji instead." })
    } finally {
      setLoading(false)
    }
  }

  // Upload photo: the user's own picture, cropped square and shrunk on the phone first
  async function uploadPhoto() {
    if (uploading) return
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Toast.show({ type: "error", text1: "Permission required", text2: "Allow photo access to choose a group picture" })
      return
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 })
    if (picked.canceled || !picked.assets?.[0]?.uri) return
    setUploading(true)
    try {
      const rendered = await ImageManipulator.manipulate(picked.assets[0].uri).resize({ width: 400, height: 400 }).renderAsync()
      const small = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true })
      if (!small.base64) throw new Error("no image data")
      const res = await groupImageApi.upload(small.base64)
      const mine: Choice = { url: res.data.url, thumb: res.data.url, credit: null }
      setShown((prev) => [mine, ...prev.filter((p) => p.credit)])
      haptic.tap()
      onImage({ url: res.data.url, credit: null })
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Couldn't upload the photo", text2: err?.response?.data?.error ?? "Please try again" })
    } finally {
      setUploading(false)
    }
  }

  const credit = image?.credit
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 8, marginTop: 2 }}>Icon</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <TouchableOpacity
          onPress={generate}
          accessibilityLabel="Auto generate icon"
          style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, flex: 1, justifyContent: "center" }}
        >
          {loading ? <ActivityIndicator size="small" color={C.accentText} /> : <Ionicons name="sparkles" size={15} color={C.accentText} />}
          <Text style={{ color: C.accentText, fontSize: 13, fontWeight: "700" }}>Auto generate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={uploadPhoto}
          accessibilityLabel="Upload photo from gallery"
          style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, flex: 1, justifyContent: "center" }}
        >
          {uploading ? <ActivityIndicator size="small" color={C.accentText} /> : <Ionicons name="image-outline" size={15} color={C.accentText} />}
          <Text style={{ color: C.accentText, fontSize: 13, fontWeight: "700" }}>Upload photo</Text>
        </TouchableOpacity>
      </View>

      {shown.length > 0 && (
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 8 }}>
          {shown.map((p) => {
            const selected = image?.url === p.url
            return (
              <TouchableOpacity key={p.url} onPress={() => choosePhoto(p)} style={{ alignItems: "center", gap: 4 }}>
                <View style={{ borderRadius: 18, borderWidth: 2.5, borderColor: selected ? "#6366f1" : "transparent", padding: 2 }}>
                  <Image source={{ uri: p.thumb }} style={{ width: 92, height: 92, borderRadius: 14, backgroundColor: C.iconBg }} contentFit="cover" transition={150} />
                  {selected && (
                    <View style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={{ color: selected ? C.text : C.textMuted, fontSize: 11, fontWeight: "600" }}>
                  {!p.credit ? "Your photo" : p.credit.source === "wikipedia" ? "Wikipedia" : "Unsplash"}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      )}
      {credit && (
        // Unsplash requires the photographer and Unsplash to be credited and linked separately
        <Text style={{ color: C.textMuted, fontSize: 11, marginBottom: 10 }}>
          {credit.source === "unsplash" ? "Photo by " : "Photo: "}
          <Text style={{ color: C.textSub, fontSize: 11, textDecorationLine: "underline" }} onPress={() => open(credit.link)}>{credit.name}</Text>
          {credit.source === "unsplash" ? " on " : " · "}
          <Text
            style={{ color: C.textSub, fontSize: 11, textDecorationLine: "underline" }}
            onPress={() => open(credit.source === "unsplash" ? UNSPLASH_HOME : credit.link)}
          >
            {credit.source === "unsplash" ? "Unsplash" : "Wikipedia"}
          </Text>
        </Text>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(GROUP_EMOJIS.includes(emoji) ? GROUP_EMOJIS : [emoji, ...GROUP_EMOJIS]).map((e) => {
          const selected = !image && emoji === e
          return (
            <TouchableOpacity
              key={e}
              onPress={() => { onEmoji(e); onImage(null) }}
              style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: selected ? "rgba(99,102,241,0.3)" : C.iconBg, borderWidth: selected ? 2 : 1, borderColor: selected ? "#6366f1" : C.border, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontSize: 21 }}>{e}</Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

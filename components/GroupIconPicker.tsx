import { useRef, useState } from "react"
import { View, TouchableOpacity, ScrollView, ActivityIndicator, Linking } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import Toast from "react-native-toast-message"
import { Text } from "@/components/ui/Typography"
import { useTheme } from "@/lib/theme"
import { haptic } from "@/lib/haptics"
import { GROUP_EMOJIS } from "@/lib/utils"
import { groupTheme, suggestGroupIcons } from "@/lib/group-icon"
import { groupImageApi, type GroupImage, type GroupImageCredit } from "@/lib/api"

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
  const [photos, setPhotos] = useState<GroupImage[]>([])
  const [loading, setLoading] = useState(false)
  const state = useRef({ key: "", page: 0, hasMore: true, emojiIndex: -1 })

  function choosePhoto(p: GroupImage) {
    haptic.tap()
    onImage({ url: p.url, credit: p.credit })
    if (p.downloadLocation) groupImageApi.select(p.downloadLocation).catch(() => {})
  }

  async function generate() {
    if (loading) return
    if (!name.trim() && !location?.trim()) {
      Toast.show({ type: "info", text1: "Type a group name first", text2: "We'll find a picture that matches it." })
      return
    }
    haptic.tap()
    const key = `${name.trim().toLowerCase()}|${(location ?? "").trim().toLowerCase()}`
    const s = state.current
    if (s.key !== key) Object.assign(s, { key, page: 0, hasMore: true, emojiIndex: -1 })
    // Next page of photos, wrapping back to the first once we run out
    s.page = s.hasMore ? s.page + 1 : 1

    // The emoji updates instantly and is the fallback when there's no photo
    const icons = suggestGroupIcons(name, location)
    s.emojiIndex = (s.emojiIndex + 1) % icons.length
    onEmoji(icons[s.emojiIndex].emoji)
    onColor(icons[s.emojiIndex].color)

    setLoading(true)
    try {
      const res = await groupImageApi.search({ name, location: location ?? undefined, theme: groupTheme(name) || undefined, page: s.page })
      s.hasMore = res.data.hasMore
      if (res.data.images.length > 0) {
        setPhotos(res.data.images)
        choosePhoto(res.data.images[0])
      } else if (s.page === 1) {
        setPhotos([])
        onImage(null)
        Toast.show({ type: "info", text1: "No photo found", text2: "Picked the best emoji instead." })
      }
    } catch {
      Toast.show({ type: "info", text1: "Couldn't load photos", text2: "Picked the best emoji instead." })
    } finally {
      setLoading(false)
    }
  }

  const credit = image?.credit
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 2 }}>
        <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500" }}>Icon</Text>
        <TouchableOpacity
          onPress={generate}
          accessibilityLabel="Auto generate icon"
          style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}
        >
          {loading ? <ActivityIndicator size="small" color={C.accentText} /> : <Ionicons name="sparkles" size={13} color={C.accentText} />}
          <Text style={{ color: C.accentText, fontSize: 12, fontWeight: "700" }}>Auto generate</Text>
        </TouchableOpacity>
      </View>

      {photos.length > 0 && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
            {photos.map((p) => {
              const selected = image?.url === p.url
              return (
                <TouchableOpacity key={p.url} onPress={() => choosePhoto(p)} style={{ borderRadius: 14, borderWidth: 2, borderColor: selected ? "#6366f1" : "transparent", padding: 2 }}>
                  <Image source={{ uri: p.thumb }} style={{ width: 64, height: 64, borderRadius: 11, backgroundColor: C.iconBg }} contentFit="cover" transition={150} />
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </>
      )}
      {credit && (
        <TouchableOpacity onPress={() => Linking.openURL(credit.link).catch(() => {})} style={{ marginBottom: 10 }}>
          <Text style={{ color: C.textMuted, fontSize: 11 }}>
            {credit.source === "unsplash" ? `Photo by ${credit.name} on Unsplash` : `Photo: ${credit.name} · Wikipedia`}
          </Text>
        </TouchableOpacity>
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

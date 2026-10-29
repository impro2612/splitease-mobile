import { View } from "react-native"
import { Image } from "expo-image"
import { Text } from "@/components/ui/Typography"

// A group's picture: its photo when it has one, otherwise its emoji on a tinted tile
export function GroupAvatar({ emoji, imageUrl, color, size = 48, radius = 14 }: {
  emoji?: string | null
  imageUrl?: string | null
  color?: string | null
  size?: number
  radius?: number
}) {
  const tint = `${color ?? "#6366f1"}33`
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: tint, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={{ width: size, height: size }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
      ) : (
        <Text style={{ fontSize: Math.round(size * 0.46) }}>{emoji ?? "💰"}</Text>
      )}
    </View>
  )
}

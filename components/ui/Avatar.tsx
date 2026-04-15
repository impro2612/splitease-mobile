import { View, Text, Image } from "react-native"
import { getInitials } from "@/lib/utils"

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#22c55e", "#06b6d4", "#a855f7"]

function colorForText(text: string) {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

type Props = {
  name?: string | null
  email?: string | null
  image?: string | null
  size?: number
}

export function Avatar({ name, email, image, size = 40 }: Props) {
  const initials = getInitials(name, email)
  const bg = colorForText((name ?? email ?? "?"))

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}
      className="items-center justify-center"
    >
      {image ? (
        <Image source={{ uri: image }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }}
          className="items-center justify-center">
          <Text style={{ fontSize: size * 0.36, color: "#fff", fontWeight: "700" }}>{initials}</Text>
        </View>
      )}
    </View>
  )
}

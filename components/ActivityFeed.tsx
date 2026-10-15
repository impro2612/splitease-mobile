import { View } from "react-native"
import { Text } from "@/components/ui/Typography"
import { Ionicons } from "@expo/vector-icons"
import { formatCurrency, formatRelativeTime, getExpenseEmoji } from "@/lib/utils"
import { CURRENCIES } from "@/lib/currencies"
import { tokens, useTheme } from "@/lib/theme"

export type ActivityItem = {
  id: string
  type: string
  actorId: string
  targetUserId?: string | null
  groupId?: string | null
  meta: Record<string, any>
  createdAt: string
  actor: { id: string; name: string | null; image: string | null }
  targetUser?: { id: string; name: string | null; image: string | null } | null
  group?: { id: string; name: string; emoji: string; color: string } | null
}

export function ActivityRow({ item, userId, C }: { item: ActivityItem; userId: string; C: any }) {
  const m = item.meta
  const isMe = item.actorId === userId
  const actorName = isMe ? "You" : (item.actor.name ?? "Someone")
  const time = formatRelativeTime(item.createdAt)

  switch (item.type) {
    case "expense_added": {
      const curr = CURRENCIES.find(c => c.code === m.currency) ?? CURRENCIES[0]
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: C.iconBg }]}>
            <Text style={{ fontSize: 18 }}>{getExpenseEmoji(m.description ?? "")}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} added "{m.description}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
              {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
          <Text style={{ color: C.accentText, fontWeight: "700", fontSize: 13 }}>
            {formatCurrency(m.amount, curr.symbol, curr.code)}
          </Text>
        </View>
      )
    }

    case "expense_edited": {
      const curr = CURRENCIES.find(c => c.code === m.currency) ?? CURRENCIES[0]
      const expenseName = m.newDescription ?? m.description
      const fmtD = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      const changed = m.oldDescription && m.newDescription
        ? `"${m.oldDescription}" → "${m.newDescription}"`
        : m.oldAmount != null && m.newAmount != null
          ? `${formatCurrency(m.oldAmount, curr.symbol, curr.code)} → ${formatCurrency(m.newAmount, curr.symbol, curr.code)}`
          : m.oldPaidByName != null && m.newPaidByName != null
            ? `${m.oldPaidByName} → ${m.newPaidByName}`
            : m.oldDate && m.newDate
              ? `${fmtD(m.oldDate)} → ${fmtD(m.newDate)}`
              : m.oldCurrency && m.newCurrency
                ? `${m.oldCurrency} → ${m.newCurrency}`
                : `"${expenseName}"`
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(245,158,11,0.12)" }]}>
            <Ionicons name="create-outline" size={18} color="#fbbf24" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} edited {changed}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              "{m.newDescription ?? m.description}" · {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
        </View>
      )
    }

    case "expense_deleted": {
      const curr = CURRENCIES.find(c => c.code === m.currency) ?? CURRENCIES[0]
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(244,63,94,0.12)" }]}>
            <Ionicons name="trash-outline" size={18} color={C.negative} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} deleted "{m.description}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
              {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
          <Text style={{ color: C.negative, fontWeight: "700", fontSize: 13 }}>
            {formatCurrency(m.amount, curr.symbol, curr.code)}
          </Text>
        </View>
      )
    }

    case "settlement": {
      const curr = CURRENCIES.find(c => c.code === m.currency) ?? CURRENCIES[0]
      const toName = m.toUserName ?? item.targetUser?.name ?? "someone"
      const isTarget = item.targetUserId === userId
      const desc = isMe
        ? `You settled with ${toName}`
        : isTarget
          ? `${actorName} settled with you`
          : `${actorName} settled with ${toName}`
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(34,197,94,0.12)" }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={C.positive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>{desc}</Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
              {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
          <Text style={{ color: C.positive, fontWeight: "700", fontSize: 13 }}>
            {formatCurrency(m.amount, curr.symbol, curr.code)}
          </Text>
        </View>
      )
    }

    case "group_created": {
      const emoji = item.group?.emoji ?? m.groupEmoji ?? "💰"
      const name = item.group?.name ?? m.groupName ?? "a group"
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
            <Text style={{ fontSize: 18 }}>{emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} created group "{name}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
          <Ionicons name="people-outline" size={18} color={C.accentText} />
        </View>
      )
    }

    case "group_renamed": {
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
            <Text style={{ fontSize: 18 }}>{item.group?.emoji ?? m.groupEmoji ?? "💰"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} renamed "{m.oldName}" → "{m.newName}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "group_deleted": {
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(244,63,94,0.12)" }]}>
            <Ionicons name="trash-outline" size={18} color={C.negative} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} deleted group "{m.groupName}"
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "member_joined": {
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(34,197,94,0.1)" }]}>
            <Ionicons name="person-add-outline" size={18} color={C.positive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} joined {item.group?.name ?? m.groupName}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "friend_request_sent": {
      const toName = m.toUserName ?? item.targetUser?.name ?? "someone"
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
            <Ionicons name="person-add-outline" size={18} color={C.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {isMe ? `You sent a friend request to ${toName}` : `${actorName} sent you a friend request`}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "friend_accepted": {
      const otherName = isMe
        ? (item.targetUser?.name ?? "someone")
        : actorName
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(34,197,94,0.12)" }]}>
            <Ionicons name="people-outline" size={18} color={C.positive} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {isMe ? `You and ${otherName} are now friends` : `${actorName} accepted your friend request`}
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{time}</Text>
          </View>
        </View>
      )
    }

    case "smart_debts_toggled": {
      return (
        <View style={rowStyle(C)}>
          <View style={[iconBox, { backgroundColor: "rgba(99,102,241,0.15)" }]}>
            <Ionicons name="git-network-outline" size={18} color={C.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>
              {actorName} {m.enabled ? "enabled" : "disabled"} smart debts
            </Text>
            <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>
              {item.group?.name ?? m.groupName} · {time}
            </Text>
          </View>
        </View>
      )
    }

    default:
      return null
  }
}

const rowStyle = (C: any) => ({
  backgroundColor: C.card,
  borderRadius: tokens.radius.lg,
  padding: tokens.space.md + 2,
  marginBottom: 8,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
})

const iconBox = {
  width: 40,
  height: 40,
  borderRadius: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
}


function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" })
}

/** Activity list grouped under day headings ("Today", "Yesterday", "12 Oct"). */
export function ActivityFeed({ items, userId, limit }: { items: ActivityItem[]; userId: string; limit?: number }) {
  const C = useTheme()
  const shown = typeof limit === "number" ? items.slice(0, limit) : items
  const sections: { label: string; items: ActivityItem[] }[] = []
  for (const item of shown) {
    const label = dayLabel(item.createdAt)
    const last = sections[sections.length - 1]
    if (last && last.label === label) last.items.push(item)
    else sections.push({ label, items: [item] })
  }
  return (
    <View>
      {sections.map((sec) => (
        <View key={sec.label} style={{ marginBottom: 6 }}>
          <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 8, marginTop: 4 }}>{sec.label}</Text>
          {sec.items.map((item) => <ActivityRow key={item.id} item={item} userId={userId} C={C} />)}
        </View>
      ))}
    </View>
  )
}

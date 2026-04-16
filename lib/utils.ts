export function formatCurrency(amount: number, symbol = "$", code = "USD") {
  const abs = Math.abs(amount)
  const noDecimals = ["JPY", "KRW", "VND", "IDR", "HUF", "CLP", "COP"].includes(code)
  const formatted = abs.toFixed(noDecimals ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${symbol}${formatted}`
}

export function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }
  if (email) return email[0].toUpperCase()
  return "?"
}

export function formatDate(date: Date | string) {
  const d = new Date(date)
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatRelativeTime(date: Date | string) {
  const now = new Date()
  const d = new Date(date)
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 7) return formatDate(date)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

export const CATEGORY_ICONS: Record<string, string> = {
  food: "🍔", transport: "🚗", accommodation: "🏠",
  entertainment: "🎮", shopping: "🛍️", utilities: "💡",
  health: "💊", travel: "✈️", general: "💸",
}

export const CATEGORIES = Object.keys(CATEGORY_ICONS)

export const GROUP_EMOJIS = ["💰", "🏠", "✈️", "🎉", "🍕", "🎮", "💪", "🌍", "🎸", "⚽"]

export const GROUP_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#a855f7",
]

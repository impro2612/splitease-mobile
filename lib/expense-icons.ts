import type { Ionicons } from "@expo/vector-icons"
import { getExpenseEmoji } from "@/lib/utils"

type IconName = keyof typeof Ionicons.glyphMap
export type ExpenseIcon = { icon: IconName; color: string }

/**
 * Line icon + colour for an expense, from its description. Replaces per-expense emoji so
 * expense rows match the app's icon set and look the same on every phone.
 * Most specific rules first; anything food-ish falls back on the big emoji keyword list.
 */
const RULES: Array<[string[], ExpenseIcon]> = [
  [["flight", "airline", "airport", "plane", "indigo", "vistara", "air india", "akasa"], { icon: "airplane-outline", color: "#60a5fa" }],
  [["train", "metro", "irctc", "railway", "rail", "local train", "tram"], { icon: "train-outline", color: "#38bdf8" }],
  [["bus", "volvo", "redbus", "ferry", "boat", "cruise"], { icon: "bus-outline", color: "#38bdf8" }],
  [["uber", "ola", "rapido", "taxi", "cab", "auto", "rickshaw", "petrol", "diesel", "fuel", "parking", "toll", "car rental", "rental car", "bike rent", "scooty"], { icon: "car-outline", color: "#38bdf8" }],
  [["hotel", "airbnb", "hostel", "resort", "oyo", "lodge", "homestay", "guesthouse", "stay", "room", "booking.com"], { icon: "bed-outline", color: "#a78bfa" }],
  [["rent", "pg", "flat", "apartment", "society", "maintenance", "house"], { icon: "home-outline", color: "#a78bfa" }],
  [["electricity", "wifi", "internet", "broadband", "recharge", "bill", "gas cylinder", "water bill", "dth"], { icon: "flash-outline", color: "#facc15" }],
  [["grocery", "groceries", "supermarket", "vegetable", "sabzi", "blinkit", "zepto", "bigbasket", "instamart", "dmart", "kirana", "milk"], { icon: "basket-outline", color: "#84cc16" }],
  [["coffee", "cafe", "café", "starbucks", "chai", "tea", "latte", "cappuccino"], { icon: "cafe-outline", color: "#d6a77a" }],
  [["beer", "wine", "bar", "pub", "alcohol", "liquor", "cocktail", "whisky", "whiskey", "vodka", "rum", "drinks", "brewery", "booze"], { icon: "wine-outline", color: "#f472b6" }],
  [["movie", "cinema", "pvr", "inox", "netflix", "concert", "show", "ticket", "event", "party", "club", "game", "gaming", "bowling", "karaoke", "fun", "museum", "zoo"], { icon: "ticket-outline", color: "#f472b6" }],
  [["trek", "hike", "hiking", "paragliding", "rafting", "skiing", "camping", "safari", "adventure", "scuba", "snorkel", "tour", "sightseeing"], { icon: "trail-sign-outline", color: "#34d399" }],
  [["gift", "birthday", "present", "anniversary", "wedding"], { icon: "gift-outline", color: "#fb7185" }],
  [["doctor", "hospital", "clinic", "medicine", "pharmacy", "medical", "chemist", "dental", "dentist", "test", "checkup"], { icon: "medkit-outline", color: "#f87171" }],
  [["gym", "yoga", "fitness", "workout", "sports", "turf", "badminton", "football", "cricket"], { icon: "barbell-outline", color: "#34d399" }],
  [["shop", "shopping", "mall", "amazon", "flipkart", "myntra", "ajio", "meesho", "clothes", "shoes", "dress", "shirt", "jeans", "electronics", "gadget"], { icon: "bag-handle-outline", color: "#e879f9" }],
  [["salon", "haircut", "spa", "massage", "parlour", "parlor", "laundry", "dry clean"], { icon: "cut-outline", color: "#c084fc" }],
  [["food", "lunch", "dinner", "breakfast", "brunch", "meal", "snack", "restaurant", "dhaba", "swiggy", "zomato", "eat", "buffet", "dessert", "ice cream", "sweets"], { icon: "restaurant-outline", color: "#fb923c" }],
]

// Emoji the keyword list gives for dishes and drinks — any of these means "food"
const FOOD_EMOJI = new Set("🥟🍛🥙🫧🥗🍚🫓🍲🥛🍬🫐🥭🍌🍎🍊🍉🍇🍓🥥🍑🍜🍣🍕🍔🌮🍝🌭🌯🍳🥞🍗🥩🦞🍦🎂🍪🧀🍞🍿🍽️🥤💧".match(/\p{Extended_Pictographic}/gu) ?? [])

// Whole words only (plus plural): "ola" must not match "chocolate", nor "bar" "barfi"
const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const COMPILED = RULES.map(([words, icon]) => [new RegExp(`(^|[^\\p{L}])(${words.map(escape).join("|")})(s|es)?(?![\\p{L}])`, "iu"), icon] as const)

const GENERAL: ExpenseIcon = { icon: "receipt-outline", color: "#94a3b8" }

export function getExpenseIcon(description: string | null | undefined): ExpenseIcon {
  const text = (description ?? "").trim()
  if (!text) return GENERAL
  for (const [re, icon] of COMPILED) {
    if (re.test(text)) return icon
  }
  const emoji = getExpenseEmoji(description ?? "")
  const base = emoji.match(/\p{Extended_Pictographic}/u)?.[0]
  if (base && FOOD_EMOJI.has(base)) return RULES[RULES.length - 1][1]
  return GENERAL
}

/** Soft tinted background for an icon colour (#rrggbb → rgba at 14%). */
export function iconTint(hex: string, alpha = 0.14): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

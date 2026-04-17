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

// Direct keyword → emoji map (most specific first, like WhatsApp emoji search)
const EXPENSE_EMOJI_MAP: Array<[string[], string]> = [
  // Food — specific dishes
  [["pizza"], "🍕"],
  [["burger", "mcdonalds", "mcdonald", "kfc", "wendy", "five guys"], "🍔"],
  [["sushi", "sashimi"], "🍣"],
  [["ramen", "noodle", "noodles", "pho", "udon"], "🍜"],
  [["taco", "burrito", "quesadilla", "mexican"], "🌮"],
  [["biryani", "curry", "dal", "sabzi", "thali", "dosa", "idli"], "🍛"],
  [["pasta", "spaghetti", "lasagna", "italian"], "🍝"],
  [["ice cream", "gelato", "dessert", "cake", "pastry", "donut", "sweet"], "🍦"],
  [["birthday cake", "birthday"], "🎂"],
  [["pancake", "waffle", "french toast"], "🥞"],
  [["salad", "bowl", "wrap"], "🥗"],
  [["sandwich", "sub", "subway", "wrap"], "🥙"],
  [["chicken", "wings", "bbq", "grill", "barbeque"], "🍗"],
  [["steak", "meat", "beef"], "🥩"],
  [["seafood", "fish", "prawn", "shrimp", "lobster"], "🦞"],
  // Food — drinks
  [["coffee", "starbucks", "cappuccino", "latte", "espresso", "americano"], "☕"],
  [["chai", "masala chai"], "🫖"],
  [["tea", "herbal"], "🍵"],
  [["beer", "brewery", "craft beer", "pint"], "🍺"],
  [["wine", "champagne", "prosecco", "sangria"], "🍷"],
  [["cocktail", "mojito", "margarita", "gin", "whiskey", "vodka"], "🍹"],
  [["juice", "smoothie", "shake", "milkshake", "boba"], "🥤"],
  // Food — places & apps
  [["breakfast", "brunch"], "🍳"],
  [["lunch"], "🥗"],
  [["dinner", "supper"], "🍽️"],
  [["restaurant", "dining", "bistro", "diner"], "🍽️"],
  [["cafe", "bakery", "patisserie"], "☕"],
  [["bar", "pub", "tavern", "lounge"], "🍻"],
  [["swiggy", "zomato", "doordash", "ubereats", "grubhub", "deliveroo"], "🛵"],
  [["dhaba", "street food", "stall", "vendor"], "🫕"],
  [["snack", "chips", "popcorn", "nachos"], "🍿"],
  [["grocery", "groceries", "supermarket", "walmart", "costco", "bigbasket", "blinkit"], "🛒"],
  [["eat", "eating", "food", "meal"], "🍴"],
  // Transport
  [["flight", "airline", "airways", "airport", "boarding"], "✈️"],
  [["uber", "lyft", "ola", "rapido", "indriver", "taxi", "cab"], "🚕"],
  [["auto", "rickshaw", "tuk tuk"], "🛺"],
  [["bus", "coach", "shuttle"], "🚌"],
  [["train", "railway", "irctc", "amtrak", "eurostar"], "🚆"],
  [["metro", "subway", "underground", "tube", "mrt"], "🚇"],
  [["petrol", "diesel", "fuel", "gasoline", "refuel", "pump"], "⛽"],
  [["parking", "valet"], "🅿️"],
  [["toll", "highway", "expressway"], "🛣️"],
  [["bike", "bicycle", "cycling"], "🚲"],
  [["scooter", "moped", "vespa"], "🛵"],
  [["motorcycle", "motorbike"], "🏍️"],
  [["ferry", "boat", "ship", "vessel"], "⛴️"],
  [["car rental", "rental car", "hertz", "avis"], "🚗"],
  [["ride", "commute", "transport", "travel card"], "🚗"],
  // Accommodation
  [["hotel", "motel", "inn", "suites", "marriott", "hilton", "hyatt"], "🏨"],
  [["airbnb", "vrbo", "homestay"], "🏡"],
  [["hostel", "dorm", "bunk"], "🛏️"],
  [["rent", "apartment", "flat", "lease", "pg", "paying guest"], "🏠"],
  [["resort", "villa", "bungalow", "cottage"], "🏝️"],
  // Entertainment
  [["movie", "cinema", "film", "imax", "pvr", "inox", "amc"], "🎬"],
  [["concert", "gig", "live music", "festival", "edm"], "🎤"],
  [["netflix", "prime video", "amazon prime", "hotstar", "hulu", "disney"], "📺"],
  [["spotify", "apple music", "youtube music"], "🎵"],
  [["game", "gaming", "playstation", "xbox", "nintendo", "steam", "video game"], "🎮"],
  [["bowling"], "🎳"],
  [["karaoke"], "🎤"],
  [["club", "nightclub", "disco", "lounge"], "🪩"],
  [["entry fee", "entry", "cover charge", "cover"], "🎟️"],
  [["ticket", "tickets"], "🎟️"],
  [["party", "celebration", "bash"], "🎉"],
  [["museum", "gallery", "exhibition", "art"], "🏛️"],
  [["zoo", "safari", "aquarium"], "🦁"],
  [["amusement", "theme park", "rollercoaster", "funfair"], "🎡"],
  [["escape room", "paintball", "laser tag"], "🎯"],
  [["comedy", "stand-up", "show", "theatre", "theater"], "🎭"],
  [["sports", "match", "stadium", "cricket", "football", "soccer", "basketball", "tennis"], "🏟️"],
  // Shopping
  [["amazon", "flipkart", "ebay", "etsy", "meesho", "myntra", "ajio"], "📦"],
  [["clothes", "clothing", "shirt", "dress", "jeans", "kurta", "saree", "jacket", "hoodie"], "👗"],
  [["shoes", "sneakers", "boots", "sandals", "footwear"], "👟"],
  [["bag", "backpack", "purse", "handbag", "luggage"], "👜"],
  [["watch", "timepiece"], "⌚"],
  [["jewellery", "jewelry", "ring", "necklace", "earring", "bracelet"], "💍"],
  [["sunglasses", "glasses", "eyewear", "spectacles"], "🕶️"],
  [["electronics", "gadget", "laptop", "computer", "tablet", "ipad"], "💻"],
  [["phone", "iphone", "android", "mobile", "smartphone"], "📱"],
  [["furniture", "sofa", "table", "chair", "bed", "mattress", "ikea"], "🛋️"],
  [["decor", "decoration", "plant", "frame", "candle"], "🪴"],
  [["gift", "present", "surprise"], "🎁"],
  [["grocery", "market", "bazaar", "vegetable", "fruit"], "🛒"],
  [["book", "kindle", "novel", "textbook"], "📚"],
  [["toy", "lego", "doll", "action figure"], "🧸"],
  // Utilities & Bills
  [["electricity", "electric", "power bill", "light bill"], "⚡"],
  [["wifi", "internet", "broadband", "fiber"], "📶"],
  [["water bill", "water"], "💧"],
  [["gas bill", "lpg", "cylinder"], "🔥"],
  [["phone bill", "mobile bill", "postpaid", "prepaid", "recharge"], "📱"],
  [["insurance", "policy", "premium"], "📋"],
  [["subscription", "membership"], "🔄"],
  [["repair", "fix", "maintenance", "service"], "🔧"],
  [["plumber", "plumbing"], "🪠"],
  [["electrician"], "🔌"],
  [["cable", "dth", "tata sky", "dish tv"], "📡"],
  // Health & Fitness
  [["gym", "fitness", "workout", "crossfit", "weights"], "💪"],
  [["yoga", "pilates", "meditation", "zumba"], "🧘"],
  [["doctor", "physician", "specialist", "consultation"], "👨‍⚕️"],
  [["hospital", "clinic", "emergency", "icu"], "🏥"],
  [["medicine", "tablet", "capsule", "drug", "pill"], "💊"],
  [["pharmacy", "chemist", "medical store"], "💊"],
  [["dental", "dentist", "teeth", "orthodontist"], "🦷"],
  [["eye", "ophthalmologist", "optician"], "👁️"],
  [["physiotherapy", "physio", "massage", "spa"], "💆"],
  [["blood test", "lab test", "scan", "mri", "xray"], "🩺"],
  // Travel & Trips
  [["trek", "trekking", "hiking", "trail", "mountain"], "🥾"],
  [["beach", "sea", "ocean", "coast", "island"], "🏖️"],
  [["cruise", "yacht"], "🚢"],
  [["visa", "passport", "embassy"], "🛂"],
  [["travel insurance", "trip insurance"], "🧳"],
  [["tour", "sightseeing", "excursion"], "🗺️"],
  [["vacation", "holiday", "trip", "getaway", "travel"], "🧳"],
  [["camping", "camp", "tent"], "🏕️"],
  // Misc
  [["fee", "fees", "charge", "charges"], "🧾"],
  [["donation", "charity", "ngo"], "❤️"],
  [["wedding", "marriage", "anniversary"], "💒"],
  [["pet", "vet", "dog", "cat", "animal"], "🐾"],
  [["baby", "diaper", "formula", "infant"], "👶"],
  [["laundry", "dry clean", "washing"], "👕"],
  [["haircut", "salon", "parlour", "barber"], "💇"],
  [["stationery", "pen", "notebook", "printer", "ink"], "✏️"],
  [["atm", "withdrawal", "cash"], "💵"],
  [["transfer", "send money", "payment"], "💸"],
]

export function getExpenseEmoji(description: string): string {
  if (!description?.trim()) return "💸"
  const lower = description.toLowerCase()
  for (const [keywords, emoji] of EXPENSE_EMOJI_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return emoji
  }
  return "💸"
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: [
    "food", "eat", "eating", "dinner", "lunch", "breakfast", "brunch", "snack", "meal",
    "restaurant", "cafe", "coffee", "tea", "pizza", "burger", "sushi", "biryani",
    "curry", "noodle", "pasta", "sandwich", "bakery", "bar", "pub", "beer", "wine",
    "drinks", "drink", "juice", "swiggy", "zomato", "doordash", "ubereats", "grubhub",
    "dominos", "mcdonalds", "kfc", "subway", "starbucks", "chai", "dhaba",
    "taco", "bbq", "buffet", "dessert", "ice cream", "boba", "smoothie",
  ],
  transport: [
    "uber", "ola", "lyft", "taxi", "cab", "auto", "rickshaw", "bus", "train",
    "metro", "tram", "ferry", "petrol", "diesel", "fuel", "gas station", "parking",
    "toll", "ride", "commute", "rapido", "bike", "scooter", "rental car",
    "moto", "carpool", "highway", "bridge", "pass",
  ],
  accommodation: [
    "hotel", "motel", "airbnb", "hostel", "rent", "apartment", "flat", "house",
    "room", "stay", "lodge", "resort", "bnb", "booking", "oyo", "lease", "pg",
    "guesthouse", "dorm", "couchsurf",
  ],
  entertainment: [
    "movie", "cinema", "netflix", "spotify", "amazon prime", "hotstar", "youtube",
    "game", "gaming", "concert", "show", "theatre", "theater", "club", "disco",
    "bowling", "karaoke", "arcade", "amusement", "streaming", "subscription",
    "ticket", "event", "festival", "party", "fun", "entry", "entry fee",
    "cover charge", "cover", "nightclub", "escape room", "comedy", "stand-up",
    "exhibition", "museum", "zoo", "park", "ride", "pass",
  ],
  shopping: [
    "amazon", "flipkart", "myntra", "ajio", "meesho", "shop", "mall", "market",
    "clothes", "clothing", "shoes", "dress", "shirt", "pants", "jeans", "accessories",
    "grocery", "groceries", "supermarket", "walmart", "costco", "ikea", "furniture",
    "electronics", "gadget", "phone", "laptop", "buy", "purchase", "store",
    "jacket", "bag", "watch", "sunglasses", "jewellery", "gift",
  ],
  utilities: [
    "electricity", "electric", "water bill", "internet", "wifi", "broadband",
    "phone bill", "mobile bill", "recharge", "gas bill", "utility", "bill",
    "subscription", "insurance", "maintenance", "repair", "plumber", "electrician",
    "cable", "dth", "postpaid", "prepaid",
  ],
  health: [
    "doctor", "hospital", "clinic", "medicine", "pharmacy", "medical", "dental",
    "dentist", "gym", "fitness", "yoga", "workout", "health", "chemist", "drug",
    "tablet", "injection", "surgery", "checkup", "lab", "test", "scan",
    "physiotherapy", "optician", "blood test", "prescription",
  ],
  travel: [
    "flight", "flights", "airline", "airport", "visa", "passport", "holiday",
    "vacation", "trip", "tour", "travel", "luggage", "suitcase", "backpack",
    "trek", "trekking", "hiking", "cruise", "train ticket", "bus ticket", "package",
    "itinerary", "resort booking", "travel insurance",
  ],
}

export function guessCategory(description: string): string {
  const lower = description.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category
  }
  return "general"
}

export const GROUP_EMOJIS = [
  // Money & Finance
  "💰", "💳", "🏦", "💵", "💎", "🪙",
  // Travel & Transport
  "✈️", "🏖️", "🏔️", "🗺️", "🚂", "🚗", "🛳️", "🏕️", "🌴",
  // Home & Living
  "🏠", "🏡", "🛋️", "🔧", "🔨", "🪴", "💡", "🧹",
  // Food & Drink
  "🍕", "🍔", "🍣", "🥘", "☕", "🍺", "🥂", "🍜",
  // Entertainment & Hobbies
  "🎮", "🎸", "🎵", "🎬", "🎳", "🎯", "🎲", "🎭",
  // Sports & Fitness
  "⚽", "🏀", "🏋️", "🧘", "🚴", "🏊", "🎾", "🏄",
  // People & Events
  "🎉", "👨‍👩‍👧‍👦", "💑", "🎓", "💼", "🤝",
  // Nature
  "🌍", "🌿", "🐾", "🌸", "⛰️", "🌊",
  // Daily & Utilities
  "💪", "🛒", "📱", "💊", "📚", "🧴", "👔", "🐶",
]

export const GROUP_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#a855f7",
]

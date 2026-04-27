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
  // ── Indian street food & snacks ──────────────────────────────────────────
  [["momos", "momo", "dimsum", "dim sum", "dumpling", "gyoza", "wonton"], "🥟"],
  [["pav bhaji", "pavbhaji"], "🍛"],
  [["vada pav", "vadapav", "vada"], "🥙"],
  [["pani puri", "panipuri", "golgappa", "gol gappa", "puchka", "sev puri"], "🫧"],
  [["bhel puri", "bhelpuri", "sev", "chaat", "papdi"], "🥗"],
  [["samosa", "samosas", "kachori", "kachauri"], "🥟"],
  [["poha", "upma", "sheera", "halwa", "shira"], "🍚"],
  [["paratha", "parantha", "chapati", "chapatti", "roti", "naan", "kulcha"], "🫓"],
  [["rajma", "chole", "pav", "bhaji", "dal makhani", "butter chicken", "paneer"], "🍛"],
  [["dosa", "idli", "uttapam", "vada", "sambhar", "rasam"], "🍛"],
  [["biryani", "pulao", "dum biryani", "hyderabadi"], "🍛"],
  [["curry", "dal", "sabzi", "sabji", "thali", "gravy", "masala"], "🍛"],
  [["puri", "bhatura", "batura", "luchi"], "🫓"],
  [["khichdi", "khichri", "congee", "porridge"], "🍲"],
  [["butter", "ghee", "lassi", "raita", "curd", "dahi", "yogurt"], "🥛"],
  [["mithai", "ladoo", "laddu", "barfi", "gulab jamun", "jalebi", "halwa", "kheer", "rabri", "rasgulla"], "🍬"],
  [["jamun", "falsa", "ber", "amla", "imli", "tamarind", "kokum"], "🫐"],
  [["mango", "aam", "alphonso", "kesar mango"], "🥭"],
  [["banana", "kela", "plantain"], "🍌"],
  [["apple", "seb"], "🍎"],
  [["orange", "mosambi", "tangerine", "clementine"], "🍊"],
  [["watermelon", "tarbooz", "melon"], "🍉"],
  [["grapes", "angoor"], "🍇"],
  [["strawberry", "blueberry", "raspberry", "cherry"], "🍓"],
  [["coconut", "nariyal", "coconut water"], "🥥"],
  [["fruit", "fruits"], "🍑"],
  // ── Indian breads & rice ─────────────────────────────────────────────────
  [["rice", "chawal", "fried rice", "biryani rice"], "🍚"],
  // ── Chinese / Asian ──────────────────────────────────────────────────────
  [["noodle", "noodles", "chowmein", "chow mein", "hakka", "ramen", "pho", "udon", "pad thai"], "🍜"],
  [["sushi", "sashimi", "roll", "maki"], "🍣"],
  [["spring roll", "wonton", "bao", "baozi"], "🥟"],
  [["fried rice", "egg fried", "schezwan"], "🍚"],
  // ── Global dishes ────────────────────────────────────────────────────────
  [["pizza"], "🍕"],
  [["burger", "mcdonalds", "mcdonald", "kfc", "wendy", "five guys", "smashburger"], "🍔"],
  [["taco", "burrito", "quesadilla", "enchilada", "mexican", "chipotle"], "🌮"],
  [["pasta", "spaghetti", "lasagna", "penne", "fettuccine", "carbonara", "italian"], "🍝"],
  [["sandwich", "sub", "subway", "grilled cheese", "toast", "bruschetta"], "🥙"],
  [["salad", "caesar", "coleslaw"], "🥗"],
  [["soup", "stew", "broth", "bisque", "minestrone", "chowder"], "🍲"],
  [["hotdog", "hot dog", "sausage", "bratwurst"], "🌭"],
  [["wrap", "shawarma", "kebab", "falafel", "pita", "gyros", "doner"], "🌯"],
  [["egg", "eggs", "omelette", "omelet", "scrambled", "boiled egg"], "🍳"],
  [["waffle", "pancake", "french toast", "crepe"], "🥞"],
  [["chicken", "wings", "nuggets", "bbq", "grill", "grilled", "barbeque", "barbecue", "roast"], "🍗"],
  [["steak", "beef", "mutton", "lamb", "pork", "ribs"], "🥩"],
  [["seafood", "fish", "prawn", "shrimp", "lobster", "crab", "squid", "calamari", "oyster"], "🦞"],
  [["ice cream", "gelato", "sorbet", "sundae", "kulfi"], "🍦"],
  [["cake", "pastry", "eclair", "muffin", "croissant", "donut", "doughnut"], "🎂"],
  [["cookie", "biscuit", "brownie", "chocolate"], "🍪"],
  [["candy", "sweet", "dessert", "pudding", "tart", "pie"], "🍬"],
  [["cheese", "paneer", "tofu"], "🧀"],
  [["bread", "loaf", "baguette", "pita"], "🍞"],
  [["popcorn", "chips", "nachos", "fries", "french fries"], "🍿"],
  [["snack", "munch", "crackers", "pretzel"], "🍿"],
  // ── Drinks ───────────────────────────────────────────────────────────────
  [["coffee", "starbucks", "cappuccino", "latte", "espresso", "americano", "flat white", "cold brew", "frappe"], "☕"],
  [["chai", "masala chai", "cutting chai"], "🫖"],
  [["tea", "green tea", "herbal tea", "iced tea", "matcha"], "🍵"],
  [["beer", "brewery", "craft beer", "pint", "lager", "ale", "stout", "corona", "heineken", "kingfisher"], "🍺"],
  [["wine", "champagne", "prosecco", "sangria", "rosé", "rose wine", "red wine", "white wine"], "🍷"],
  [["cocktail", "mojito", "margarita", "daiquiri", "gin", "tonic", "whiskey", "whisky", "vodka", "rum", "tequila", "shots", "shot"], "🍹"],
  [["juice", "smoothie", "shake", "milkshake", "boba", "bubble tea", "lassi", "nimbu pani", "lemonade"], "🥤"],
  [["water", "mineral water", "sparkling water", "soda", "soft drink", "cola", "pepsi", "coke"], "💧"],
  [["energy drink", "redbull", "monster", "protein shake", "whey"], "🥤"],
  [["alcohol", "liquor", "spirits", "wine shop", "wine store", "booze", "drinks"], "🍾"],
  // ── Restaurants / delivery / food places ─────────────────────────────────
  [["breakfast", "brunch", "sunny side", "eggs benedict"], "🍳"],
  [["lunch"], "🥗"],
  [["dinner", "supper"], "🍽️"],
  [["restaurant", "dining", "bistro", "diner", "eatery", "canteen", "mess", "tiffin"], "🍽️"],
  [["cafe", "bakery", "patisserie", "coffee shop", "barista"], "☕"],
  [["bar", "pub", "tavern", "lounge", "speakeasy"], "🍻"],
  [["swiggy", "zomato", "doordash", "ubereats", "grubhub", "deliveroo", "dunzo", "magicpin"], "🛵"],
  [["dhaba", "street food", "stall", "thela", "vendor", "hawker", "roadside"], "🫕"],
  [["buffet", "all you can eat", "unlimited"], "🍽️"],
  [["dominos", "domino", "pizza hut"], "🍕"],
  [["eat", "eating", "food", "meal"], "🍴"],
  // ── Sports & fitness ─────────────────────────────────────────────────────
  [["pickleball", "pickle ball"], "🏓"],
  [["badminton", "shuttlecock"], "🏸"],
  [["table tennis", "ping pong", "tt"], "🏓"],
  [["tennis", "squash", "racket", "racquet"], "🎾"],
  [["cricket", "bat", "wicket", "ipl"], "🏏"],
  [["football", "soccer", "futsal"], "⚽"],
  [["basketball", "nba"], "🏀"],
  [["volleyball"], "🏐"],
  [["baseball", "softball"], "⚾"],
  [["golf", "putting", "driving range"], "⛳"],
  [["swimming", "pool", "swim", "aquatics"], "🏊"],
  [["running", "marathon", "jog", "jogging", "5k", "10k", "race"], "🏃"],
  [["cycling", "cycle", "velodrome", "spin class"], "🚴"],
  [["gym", "fitness", "workout", "crossfit", "weights", "lifting", "bench press", "deadlift"], "💪"],
  [["yoga", "pilates", "meditation", "zumba", "aerobics"], "🧘"],
  [["boxing", "mma", "karate", "martial arts", "taekwondo", "judo", "wrestling"], "🥊"],
  [["climbing", "bouldering", "rappelling", "rock climbing"], "🧗"],
  [["skating", "ice skating", "roller skating", "rollerblading"], "⛸️"],
  [["skiing", "snowboarding", "snow"], "⛷️"],
  [["surfing", "kayaking", "rafting", "paddling"], "🏄"],
  [["archery", "shooting", "rifle", "pistol"], "🎯"],
  [["horse", "equestrian", "riding"], "🏇"],
  [["paddle", "padel"], "🏓"],
  [["sports", "match", "stadium", "tournament", "league", "game"], "🏟️"],
  [["sports equipment", "equipment", "gear"], "🎽"],
  [["jersey", "kit", "uniform", "sportswear"], "👕"],
  // ── Transport ────────────────────────────────────────────────────────────
  [["flight", "airline", "airways", "airport", "boarding", "indigo", "air india", "spicejet", "vistara", "akasa"], "✈️"],
  [["uber", "lyft", "ola", "rapido", "indriver", "taxi", "cab", "cabify"], "🚕"],
  [["auto", "rickshaw", "tuk tuk", "e-rickshaw"], "🛺"],
  [["bus", "coach", "shuttle", "volvo bus", "sleeper bus"], "🚌"],
  [["train", "railway", "irctc", "amtrak", "eurostar", "shinkansen", "rajdhani", "shatabdi"], "🚆"],
  [["metro", "local train", "underground", "tube", "mrt", "dmrc", "bmtc"], "🚇"],
  [["petrol", "diesel", "fuel", "gasoline", "refuel", "pump", "cng", "ev charging"], "⛽"],
  [["parking", "valet", "park"], "🅿️"],
  [["toll", "highway", "expressway", "fastag"], "🛣️"],
  [["bike", "bicycle", "cycling", "yulu", "bounce"], "🚲"],
  [["scooter", "moped", "vespa", "activa"], "🛵"],
  [["motorcycle", "motorbike", "bike ride", "hero", "bajaj", "royal enfield"], "🏍️"],
  [["ferry", "boat", "ship", "vessel", "cruise"], "⛴️"],
  [["car rental", "rental car", "hertz", "avis", "zoomcar", "self drive"], "🚗"],
  [["ride", "commute", "drop", "pickup"], "🚗"],
  // ── Accommodation ────────────────────────────────────────────────────────
  [["hotel", "motel", "inn", "suites", "marriott", "hilton", "hyatt", "oyo", "treebo", "fabhotel"], "🏨"],
  [["airbnb", "vrbo", "homestay", "vacation rental"], "🏡"],
  [["hostel", "dorm", "bunk", "backpacker"], "🛏️"],
  [["rent", "apartment", "flat", "lease", "pg", "paying guest", "coliving"], "🏠"],
  [["resort", "villa", "bungalow", "cottage", "chalet"], "🏝️"],
  // ── Entertainment ────────────────────────────────────────────────────────
  [["movie", "cinema", "film", "imax", "pvr", "inox", "amc", "multiplex", "4dx"], "🎬"],
  [["concert", "gig", "live music", "festival", "edm", "rave", "sunburn"], "🎤"],
  [["netflix", "prime video", "amazon prime", "hotstar", "jiocinema", "hulu", "disney+", "apple tv", "zee5", "sonyliv"], "📺"],
  [["spotify", "apple music", "youtube music", "gaana", "wynk"], "🎵"],
  [["video game", "gaming", "playstation", "xbox", "nintendo", "steam", "twitch", "game pass"], "🎮"],
  [["bowling"], "🎳"],
  [["karaoke", "kareoke"], "🎤"],
  [["club", "nightclub", "disco"], "🪩"],
  [["entry fee", "entry", "cover charge", "cover", "door charge"], "🎟️"],
  [["ticket", "tickets", "pass", "e-ticket"], "🎟️"],
  [["party", "celebration", "bash", "get together", "gathering"], "🎉"],
  [["museum", "gallery", "exhibition", "art", "heritage"], "🏛️"],
  [["zoo", "safari", "aquarium", "wildlife"], "🦁"],
  [["amusement", "theme park", "rollercoaster", "funfair", "carnival", "wonder la", "adlabs"], "🎡"],
  [["escape room", "paintball", "laser tag", "go karting", "karting"], "🎯"],
  [["comedy", "stand-up", "standup", "theatre", "theater", "show", "play"], "🎭"],
  [["board game", "cards", "chess", "carrom", "ludo", "uno"], "♟️"],
  [["trampoline", "bounce", "jumping"], "🤸"],
  // ── Shopping ─────────────────────────────────────────────────────────────
  [["amazon", "flipkart", "ebay", "etsy", "meesho", "myntra", "ajio", "nykaa", "purplle"], "📦"],
  [["clothes", "clothing", "shirt", "dress", "jeans", "kurta", "saree", "jacket", "hoodie", "tshirt", "t-shirt", "top", "skirt", "leggings", "shorts"], "👗"],
  [["shoes", "sneakers", "boots", "sandals", "footwear", "slippers", "chappals", "heels"], "👟"],
  [["bag", "backpack", "purse", "handbag", "luggage", "suitcase", "tote"], "👜"],
  [["watch", "smartwatch", "timepiece", "wristwatch"], "⌚"],
  [["jewellery", "jewelry", "ring", "necklace", "earring", "bracelet", "bangle", "anklet", "mangalsutra"], "💍"],
  [["sunglasses", "glasses", "eyewear", "spectacles", "contact lens"], "🕶️"],
  [["electronics", "gadget", "laptop", "computer", "tablet", "ipad", "macbook"], "💻"],
  [["phone", "iphone", "android", "mobile", "smartphone", "samsung", "oneplus"], "📱"],
  [["headphone", "earphone", "airpods", "earbuds", "speaker"], "🎧"],
  [["camera", "dslr", "mirrorless", "gopro", "lens"], "📷"],
  [["furniture", "sofa", "table", "chair", "bed", "mattress", "ikea", "wardrobe", "cupboard"], "🛋️"],
  [["decor", "decoration", "plant", "frame", "candle", "curtain", "cushion"], "🪴"],
  [["gift", "present", "surprise", "hamper"], "🎁"],
  [["grocery", "groceries", "supermarket", "walmart", "costco", "bigbasket", "blinkit", "zepto", "instamart", "dmart", "reliance fresh"], "🛒"],
  [["market", "bazaar", "mandi", "vegetable", "sabzi mandi"], "🛒"],
  [["book", "kindle", "novel", "textbook", "comics", "magazine"], "📚"],
  [["toy", "lego", "doll", "action figure", "puzzle", "playset"], "🧸"],
  [["cosmetics", "makeup", "lipstick", "foundation", "skincare", "moisturiser", "serum", "sunscreen"], "💄"],
  [["perfume", "cologne", "deodorant", "body spray"], "🧴"],
  // ── Utilities & Bills ────────────────────────────────────────────────────
  [["electricity", "electric", "power bill", "light bill", "bescom", "mseb", "tata power"], "⚡"],
  [["wifi", "internet", "broadband", "fiber", "jio", "airtel", "bsnl", "act"], "📶"],
  [["water bill", "water tax"], "💧"],
  [["gas bill", "lpg", "cylinder", "piped gas", "indane", "hp gas", "bharat gas"], "🔥"],
  [["phone bill", "mobile bill", "postpaid", "prepaid", "recharge", "talktime"], "📱"],
  [["insurance", "policy", "premium", "lic", "hdfc life", "star health"], "📋"],
  [["subscription", "membership", "annual plan", "monthly plan"], "🔄"],
  [["repair", "fix", "maintenance", "service", "amc"], "🔧"],
  [["plumber", "plumbing", "pipe"], "🪠"],
  [["electrician", "wiring"], "🔌"],
  [["cable", "dth", "tata sky", "dish tv", "tata play", "airtel dth"], "📡"],
  [["cleaning", "housekeeping", "maid", "sweep", "mop"], "🧹"],
  [["pest control", "fumigation"], "🪲"],
  // ── Health ───────────────────────────────────────────────────────────────
  [["doctor", "physician", "specialist", "consultation", "opd"], "👨‍⚕️"],
  [["hospital", "clinic", "emergency", "icu", "nursing home"], "🏥"],
  [["medicine", "tablet", "capsule", "drug", "pill", "syrup", "injection"], "💊"],
  [["pharmacy", "chemist", "medical store", "apollo pharmacy", "1mg", "netmeds"], "💊"],
  [["dental", "dentist", "teeth", "orthodontist", "braces", "root canal"], "🦷"],
  [["eye", "ophthalmologist", "optician", "eye check"], "👁️"],
  [["physiotherapy", "physio", "chiropractor", "massage", "spa", "body massage"], "💆"],
  [["blood test", "lab test", "scan", "mri", "xray", "x-ray", "ultrasound", "thyrocare", "dr lal"], "🩺"],
  [["mental health", "therapy", "therapist", "psychiatrist", "counselling"], "🧠"],
  [["protein", "supplement", "creatine", "pre-workout", "bcaa", "multivitamin", "vitamin"], "💊"],
  // ── Travel & Trips ───────────────────────────────────────────────────────
  [["trek", "trekking", "hiking", "trail", "mountain", "valley"], "🥾"],
  [["beach", "sea", "ocean", "coast", "island", "goa", "maldives"], "🏖️"],
  [["cruise", "yacht", "houseboat"], "🚢"],
  [["visa", "passport", "embassy", "consulate"], "🛂"],
  [["travel insurance", "trip insurance"], "🧳"],
  [["tour", "sightseeing", "excursion", "guided tour"], "🗺️"],
  [["vacation", "holiday", "trip", "getaway", "travel", "outing"], "🧳"],
  [["camping", "camp", "tent", "bonfire"], "🏕️"],
  [["road trip", "drive", "road", "highway trip"], "🚗"],
  // ── Education ────────────────────────────────────────────────────────────
  [["course", "class", "workshop", "tutorial", "udemy", "coursera", "unacademy"], "📖"],
  [["tuition", "coaching", "tutoring", "tution"], "📖"],
  [["school", "college", "university", "institute", "academy"], "🎓"],
  [["exam", "test fee", "registration fee", "admission fee"], "📝"],
  // ── Misc ─────────────────────────────────────────────────────────────────
  [["fee", "fees", "charge", "charges", "fine", "penalty"], "🧾"],
  [["donation", "charity", "ngo", "temple", "mandir", "masjid", "church", "gurudwara"], "❤️"],
  [["wedding", "marriage", "shaadi", "anniversary", "engagement", "mehendi", "sangeet"], "💒"],
  [["pet", "vet", "dog", "cat", "animal", "puppy", "kitten", "grooming"], "🐾"],
  [["baby", "diaper", "formula", "infant", "toddler", "baby food"], "👶"],
  [["laundry", "dry clean", "washing", "ironing", "dhobi"], "👕"],
  [["haircut", "hair cut", "salon", "parlour", "barber", "hair color", "blow dry", "threading"], "💇"],
  [["stationery", "pen", "notebook", "printer", "ink", "toner", "office supply"], "✏️"],
  [["atm", "withdrawal", "cash", "bank"], "💵"],
  [["transfer", "send money", "payment", "upi", "neft", "imps"], "💸"],
  [["photo", "photography", "photoshoot", "studio"], "📸"],
  [["printing", "xerox", "photocopy", "lamination"], "🖨️"],
  [["tailoring", "stitching", "alteration", "embroidery"], "🪡"],
  [["parking fine", "challan", "traffic fine"], "🚨"],
  [["miscellaneous", "misc", "other", "general", "expense"], "💸"],
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

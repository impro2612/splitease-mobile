// "Auto generate" for group icons: reads the group name (and trip location) and suggests
// the best-matching emoji + colour, best match first. Pure keyword rules — instant and offline.

type Rule = { re: RegExp; emojis: string[]; color: string }

const C = {
  indigo: "#6366f1", violet: "#8b5cf6", pink: "#ec4899", rose: "#f43f5e", orange: "#f97316",
  yellow: "#eab308", green: "#22c55e", cyan: "#06b6d4", blue: "#3b82f6", purple: "#a855f7",
}

// Earlier rules are more specific (places), later ones are general themes
const RULES: Rule[] = [
  // ── Places in India ──
  { re: /\b(goa|gokarna|varkala|alibaug|diu|daman|tarkarli|malvan)\b/, emojis: ["🏖️", "🌴", "🍹", "🌅"], color: C.cyan },
  { re: /\b(andaman|havelock|lakshadweep|port blair|neil island)\b/, emojis: ["🏝️", "🤿", "🐠", "🌊"], color: C.cyan },
  { re: /\b(pondicherry|puducherry|pondy|kovalam|puri|digha)\b/, emojis: ["🌊", "🏖️", "⛪", "🌅"], color: C.cyan },
  { re: /\b(manali|kasol|spiti|shimla|kullu|dharamshala|mcleodganj|bir|tosh|sissu|solang|kufri|chopta|auli|mussoorie|nainital|kedarnath|tungnath|triund)\b/, emojis: ["🏔️", "❄️", "🚙", "🏕️"], color: C.blue },
  { re: /\b(ladakh|leh|zanskar|nubra|pangong)\b/, emojis: ["🏍️", "🏔️", "🛕", "🌌"], color: C.blue },
  { re: /\b(kashmir|srinagar|gulmarg|pahalgam|sonmarg)\b/, emojis: ["🏔️", "🛶", "❄️", "🌷"], color: C.blue },
  { re: /\b(sikkim|gangtok|darjeeling|meghalaya|shillong|cherrapunji|tawang|arunachal|north ?east)\b/, emojis: ["🏞️", "🍵", "🏔️", "🌧️"], color: C.green },
  { re: /\b(kerala|munnar|alleppey|alappuzha|wayanad|kochi|cochin)\b/, emojis: ["🛶", "🌴", "🍃", "🐘"], color: C.green },
  { re: /\b(coorg|ooty|kodaikanal|chikmagalur|lonavala|khandala|mahabaleshwar|matheran|panchgani|igatpuri|munnar|yercaud)\b/, emojis: ["🌿", "☕", "🌧️", "🏞️"], color: C.green },
  { re: /\b(rajasthan|jaipur|udaipur|jodhpur|jaisalmer|pushkar|bikaner|mount abu)\b/, emojis: ["🏰", "🐪", "🏜️", "🕌"], color: C.orange },
  { re: /\b(rishikesh|haridwar)\b/, emojis: ["🛶", "🧘", "🛕", "🌊"], color: C.cyan },
  { re: /\b(varanasi|banaras|kashi|ayodhya|tirupati|shirdi|vaishno|amritsar|golden temple|char dham|ujjain|mathura|vrindavan|somnath|dwarka)\b/, emojis: ["🛕", "🪔", "🙏", "🌸"], color: C.orange },
  { re: /\b(agra|taj mahal)\b/, emojis: ["🕌", "🏛️", "📸"], color: C.orange },
  { re: /\b(hampi|khajuraho|ajanta|ellora|mysore|mysuru)\b/, emojis: ["🏛️", "🏯", "📸"], color: C.orange },
  { re: /\b(mumbai|bombay)\b/, emojis: ["🌆", "🌊", "🚆", "🍢"], color: C.indigo },
  { re: /\b(delhi|new delhi|ncr|gurgaon|gurugram|noida)\b/, emojis: ["🏛️", "🌆", "🍛", "🚇"], color: C.indigo },
  { re: /\b(bangalore|bengaluru|hyderabad|chennai|pune|kolkata|ahmedabad|surat|indore|lucknow|chandigarh|nagpur|jaipur city)\b/, emojis: ["🌆", "🏙️", "🍽️"], color: C.indigo },
  { re: /\b(konkan|ratnagiri|ganpatipule|dapoli|sindhudurg)\b/, emojis: ["🌴", "🏖️", "🐟", "🌊"], color: C.cyan },
  { re: /\b(rann of kutch|kutch|gujarat|gir)\b/, emojis: ["🏜️", "🦁", "🌕"], color: C.yellow },

  // ── Places abroad ──
  { re: /\b(paris|france)\b/, emojis: ["🗼", "🥐", "🍷", "🇫🇷"], color: C.pink },
  { re: /\b(london|uk|england|britain|scotland|edinburgh)\b/, emojis: ["💂", "🎡", "☂️", "🇬🇧"], color: C.blue },
  { re: /\b(nyc|new york|manhattan|usa|america|vegas|las vegas|california|san francisco|los angeles|la trip|miami|chicago)\b/, emojis: ["🗽", "🌉", "🎰", "🇺🇸"], color: C.blue },
  { re: /\b(dubai|abu dhabi|uae|qatar|doha|oman|saudi)\b/, emojis: ["🏙️", "🐪", "🏜️", "🇦🇪"], color: C.yellow },
  { re: /\b(singapore)\b/, emojis: ["🇸🇬", "🦁", "🌃", "🌳"], color: C.rose },
  { re: /\b(bali|indonesia|lombok)\b/, emojis: ["🌺", "🏝️", "🛕", "🌋"], color: C.green },
  { re: /\b(thailand|bangkok|phuket|pattaya|krabi|chiang mai)\b/, emojis: ["🐘", "🏝️", "🛺", "🇹🇭"], color: C.orange },
  { re: /\b(maldives|mauritius|seychelles|fiji|hawaii)\b/, emojis: ["🏝️", "🤿", "🐬", "🍹"], color: C.cyan },
  { re: /\b(japan|tokyo|kyoto|osaka)\b/, emojis: ["🗾", "🍣", "🌸", "🗻"], color: C.rose },
  { re: /\b(korea|seoul|busan)\b/, emojis: ["🇰🇷", "🍜", "🏯"], color: C.rose },
  { re: /\b(china|beijing|shanghai|hong kong|macau|taiwan)\b/, emojis: ["🏮", "🥟", "🐉"], color: C.rose },
  { re: /\b(vietnam|hanoi|saigon|cambodia|laos|malaysia|kuala lumpur|langkawi|philippines)\b/, emojis: ["🏝️", "🍜", "🛵", "🌴"], color: C.green },
  { re: /\b(nepal|kathmandu|pokhara|everest|bhutan|thimphu|tibet)\b/, emojis: ["🏔️", "🛕", "🥾", "🙏"], color: C.blue },
  { re: /\b(sri lanka|colombo)\b/, emojis: ["🏝️", "🐘", "🍵"], color: C.green },
  { re: /\b(switzerland|swiss|zurich|interlaken|alps|austria|norway|iceland|finland|lapland|sweden)\b/, emojis: ["🏔️", "🚠", "🧀", "❄️"], color: C.blue },
  { re: /\b(italy|rome|venice|milan|florence|amalfi)\b/, emojis: ["🍕", "🏛️", "🛶", "🇮🇹"], color: C.green },
  { re: /\b(spain|barcelona|madrid|ibiza|portugal|lisbon)\b/, emojis: ["💃", "🥘", "☀️", "🏖️"], color: C.orange },
  { re: /\b(greece|santorini|athens|mykonos|turkey|istanbul|cappadocia)\b/, emojis: ["🏛️", "🌅", "🎈", "🫒"], color: C.cyan },
  { re: /\b(germany|berlin|munich|amsterdam|netherlands|prague|budapest|vienna|europe|euro trip|schengen)\b/, emojis: ["🏰", "🚆", "🍺", "🇪🇺"], color: C.indigo },
  { re: /\b(egypt|cairo|morocco|africa|safari|kenya|tanzania)\b/, emojis: ["🦁", "🐪", "🏜️", "🌍"], color: C.yellow },
  { re: /\b(australia|sydney|melbourne|new zealand|nz|queenstown)\b/, emojis: ["🦘", "🏄", "🐨", "🌏"], color: C.yellow },
  { re: /\b(canada|toronto|vancouver|banff)\b/, emojis: ["🍁", "🏔️", "🇨🇦"], color: C.rose },

  // ── Trips & outdoors ──
  { re: /\b(beach|island|sea|coast|surf|scuba|snorkel)\b/, emojis: ["🏖️", "🌊", "🏄", "🐚"], color: C.cyan },
  { re: /\b(trek|trekking|hike|hiking|mountain|hills|hill station|summit|peak)\b/, emojis: ["🥾", "🏔️", "⛰️", "🎒"], color: C.green },
  { re: /\b(camp|camping|bonfire|tent|glamping)\b/, emojis: ["🏕️", "🔥", "⛺", "🌌"], color: C.green },
  { re: /\b(road ?trip|drive|bike ride|ride|riders|biking)\b/, emojis: ["🚗", "🏍️", "🛣️", "⛽"], color: C.orange },
  { re: /\b(snow|ski|skiing|winter)\b/, emojis: ["⛷️", "❄️", "☃️", "🏔️"], color: C.blue },
  { re: /\b(cruise|ship|boat|yacht)\b/, emojis: ["🛳️", "⚓", "🌊"], color: C.cyan },
  { re: /\b(train|rail)\b/, emojis: ["🚆", "🚂", "🎫"], color: C.indigo },
  { re: /\b(flight|airport|abroad|international|vacation|holiday|tour|trip|travel|getaway|weekend|outing|picnic|staycation|journey)\b/, emojis: ["✈️", "🧳", "🗺️", "🌍"], color: C.indigo },
  { re: /\b(desert|safari)\b/, emojis: ["🏜️", "🐪", "🦒"], color: C.yellow },
  { re: /\b(waterfall|lake|river|rafting)\b/, emojis: ["🏞️", "🛶", "💦"], color: C.cyan },

  // ── Home & bills ──
  { re: /\b(flat|flatmates?|roommates?|room|apartment|pg|hostel|house|home|rent|society|villa)\b/, emojis: ["🏠", "🛋️", "🔑", "🏡"], color: C.violet },
  { re: /\b(bills?|electricity|wifi|internet|utilities|maintenance|gas|water bill)\b/, emojis: ["🧾", "💡", "📶", "🔌"], color: C.yellow },
  { re: /\b(grocery|groceries|ration|kitchen|cook|maid|cleaning)\b/, emojis: ["🛒", "🥦", "🧹"], color: C.green },
  { re: /\b(car ?pool|carpool|commute|cab|uber|ola|fuel|petrol)\b/, emojis: ["🚕", "⛽", "🚗"], color: C.yellow },

  // ── Food & fun ──
  { re: /\b(dinner|lunch|breakfast|brunch|food|foodies|eat|restaurant|biryani|pizza|cafe|dine)\b/, emojis: ["🍽️", "🍕", "🍔", "🍛"], color: C.orange },
  { re: /\b(drinks?|beer|bar|pub|booze|party|club|clubbing|night ?out|cheers|timepass|chill)\b/, emojis: ["🥂", "🍻", "🎉", "🍹"], color: C.pink },
  { re: /\b(birthday|bday|b'day)\b/, emojis: ["🎂", "🎁", "🎈", "🥳"], color: C.pink },
  { re: /\b(wedding|marriage|shaadi|sangeet|mehendi|haldi|engagement|bachelor|bachelorette|reception)\b/, emojis: ["💍", "💐", "👰", "🎊"], color: C.rose },
  { re: /\b(anniversary|date night|couple|honeymoon|valentine)\b/, emojis: ["❤️", "💑", "🌹", "🥂"], color: C.rose },
  { re: /\b(baby|shower|kids?)\b/, emojis: ["👶", "🍼", "🧸"], color: C.pink },
  { re: /\b(diwali|deepavali)\b/, emojis: ["🪔", "🎆", "🪅"], color: C.orange },
  { re: /\b(holi)\b/, emojis: ["🎨", "🌈", "💦"], color: C.pink },
  { re: /\b(christmas|xmas|secret santa)\b/, emojis: ["🎄", "🎅", "🎁"], color: C.green },
  { re: /\b(new year|nye|eid|ganpati|ganesh|navratri|garba|durga puja|onam|pongal|lohri|festival|fest)\b/, emojis: ["🎆", "🎊", "🪔", "🥁"], color: C.orange },
  { re: /\b(concert|music|gig|band|festival|sunburn|lollapalooza)\b/, emojis: ["🎸", "🎤", "🎶", "🎟️"], color: C.purple },
  { re: /\b(movies?|cinema|film|netflix|ott|binge)\b/, emojis: ["🎬", "🍿", "📺"], color: C.purple },
  { re: /\b(game|gaming|ps5|playstation|xbox|pubg|bgmi|poker|cards|board games?)\b/, emojis: ["🎮", "🕹️", "🃏", "🎲"], color: C.purple },
  { re: /\b(shopping|mall|sale|gifts?)\b/, emojis: ["🛍️", "🎁", "💳"], color: C.pink },

  // ── Sports & health ──
  { re: /\b(cricket|ipl|match)\b/, emojis: ["🏏", "🏟️", "🎟️"], color: C.green },
  { re: /\b(football|futsal|fifa|soccer)\b/, emojis: ["⚽", "🥅", "🏟️"], color: C.green },
  { re: /\b(badminton|tennis|pickleball|squash|turf|sports?|league|tournament)\b/, emojis: ["🏸", "🎾", "🏆"], color: C.green },
  { re: /\b(gym|fitness|workout|yoga|run|running|marathon|cycling|swim)\b/, emojis: ["🏋️", "🏃", "🧘", "🚴"], color: C.green },

  // ── People & work ──
  { re: /\b(office|work|team|colleagues|corporate|startup|project|offsite|meeting)\b/, emojis: ["💼", "🧑‍💻", "🏢", "☕"], color: C.indigo },
  { re: /\b(college|school|class|batch|alumni|reunion|university|uni|campus|study|exam)\b/, emojis: ["🎓", "📚", "🏫", "✏️"], color: C.blue },
  { re: /\b(family|parents|mom|dad|cousins|bhai|siblings|relatives|ghar)\b/, emojis: ["👨‍👩‍👧‍👦", "🏡", "❤️"], color: C.violet },
  { re: /\b(friends|gang|squad|buddies|crew|boys|girls|besties|dosti|yaar)\b/, emojis: ["👯", "🤝", "🎉", "😎"], color: C.purple },
  { re: /\b(pets?|dog|cat|puppy)\b/, emojis: ["🐶", "🐱", "🐾"], color: C.yellow },
  { re: /\b(charity|donation|fundraiser|ngo)\b/, emojis: ["🤲", "💝", "🌱"], color: C.green },
  { re: /\b(loan|investment|savings|money|fund|chit|emi)\b/, emojis: ["💰", "🏦", "📈", "🪙"], color: C.green },
]

// Rules before the first theme rule are places
const PLACE_RULES = RULES.findIndex((r) => r.re.source.includes("beach"))

const FALLBACK = [
  { emoji: "👥", color: C.indigo }, { emoji: "✨", color: C.purple }, { emoji: "🎉", color: C.pink },
  { emoji: "💰", color: C.green }, { emoji: "🤝", color: C.blue },
]

export type IconSuggestion = { emoji: string; color: string }

/** Best-first icon suggestions for a group. Always returns at least a few options. */
export function suggestGroupIcons(name: string, location?: string | null): IconSuggestion[] {
  // Name first (it says what the group is), then the trip location as extra context
  const texts = [name, location ?? ""].map((t) => ` ${t.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ")} `)
  const out: IconSuggestion[] = []
  const seen = new Set<string>()
  const add = (emoji: string, color: string) => {
    if (!seen.has(emoji)) { seen.add(emoji); out.push({ emoji, color }) }
  }
  // Places (from the name or the trip location) beat themes like "trip" or "party"
  const hits: { r: Rule; tier: number; at: number; i: number }[] = []
  texts.forEach((text, t) => {
    if (!text.trim()) return
    RULES.forEach((r, i) => {
      const at = text.search(r.re)
      if (at >= 0) hits.push({ r, i, at, tier: (i < PLACE_RULES ? 0 : 2) + t })
    })
  })
  // Earlier in the name first, so "Goa office trip" leads with Goa
  hits.sort((a, b) => a.tier - b.tier || a.at - b.at || a.i - b.i)
  // First emoji of every matching rule, then the rest — variety before repetition
  for (const h of hits) add(h.r.emojis[0], h.r.color)
  for (const h of hits) for (const e of h.r.emojis.slice(1)) add(e, h.r.color)
  for (const f of FALLBACK) add(f.emoji, f.color)
  return out
}

/** The words in the name that say what the group is about ("Rahul's birthday" → "birthday"),
 *  used to search for a matching photo. Empty when nothing matched. */
export function groupTheme(name: string): string {
  const text = ` ${name.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ")} `
  const words: string[] = []
  RULES.slice(PLACE_RULES).forEach((r) => {
    const m = text.match(r.re)
    if (m && !words.includes(m[0].trim())) words.push(m[0].trim())
  })
  return words.slice(0, 2).join(" ")
}

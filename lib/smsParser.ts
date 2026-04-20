// Simple djb2 hash — works in React Native (no Node crypto needed)
function djb2(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return (h >>> 0).toString(16).padStart(8, "0")
}

export type ParsedSms = {
  amount: number
  currency: string
  merchant: string
  date: string
  confidence: number
  hash: string
}

// Exclusion patterns — OTP, credit, promo
const EXCLUDE_PATTERNS = [
  /\botp\b/i,
  /\bone.?time.?pass/i,
  /\bverif(ication|y)\b/i,
  /\bcredit(ed)?\b/i,
  /\bcash.?back\b/i,
  /\brefund\b/i,
  /\bpromo\b/i,
  /\boffer\b/i,
  /\breward\b/i,
  /\bincoming\b/i,
  /\breceived\b/i,
  /\bdeposit(ed)?\b/i,
]

// Debit keywords — EN/DE/FR/ES/IT/NL/AR/HI/PL
const DEBIT_KEYWORDS = [
  // English
  /\bdebited?\b/i,
  /\bpaid\b/i,
  /\bpurchase[d]?\b/i,
  /\bspent\b/i,
  /\btransaction\b/i,
  /\bwithdraw[n]?\b/i,
  /\bcharged\b/i,
  /\bpayment\b/i,
  // German
  /\babbuchung\b/i,
  /\bbelastet\b/i,
  /\büberwiesen\b/i,
  // French
  /\bdébité[e]?\b/i,
  /\bpaiement\b/i,
  /\bvirement\b/i,
  // Spanish
  /\bdébito\b/i,
  /\bpago\b/i,
  /\bcargado\b/i,
  // Italian
  /\baddebito\b/i,
  /\bpagamento\b/i,
  // Dutch
  /\bafgeschreven\b/i,
  /\bbetaling\b/i,
  // Arabic
  /\bخصم\b/,
  /\bمدفوع\b/,
  // Hindi
  /\bडेबिट\b/,
  /\bभुगतान\b/,
  // Polish
  /\bobciążono\b/i,
  /\bpłatność\b/i,
]

// Amount regex: currency symbol/code + digits, or digits + code
const AMOUNT_REGEX = /(?:(?:RS\.?|INR|USD|\$|EUR|€|GBP|£|AED|SGD|AUD|CAD|JPY|¥|CHF|SEK|NOK|DKK|PLN|MXN|BRL|IDR|THB|MYR)\s*[\d,]+(?:\.\d{1,2})?)|(?:[\d,]+(?:\.\d{1,2})?\s*(?:RS\.?|INR|USD|EUR|GBP|AED|SGD|AUD|CAD|JPY|CHF|SEK|NOK|DKK|PLN|MXN|BRL|IDR|THB|MYR))/i

// Merchant patterns: "at <Merchant>", "to <Merchant>", "at <Merchant>" case-insensitive
const MERCHANT_REGEX = /(?:\bat\s+([A-Z][A-Za-z0-9\s&'.,-]{1,40}))|(?:\bto\s+([A-Z][A-Za-z0-9\s&'.,-]{1,40}))|(?:\bfor\s+([A-Z][A-Za-z0-9\s&'.,-]{1,40}))/

// Strictly 6-char alpha sender (Indian bank sender IDs like HDFCBK, ICICIB)
const ALPHA_SENDER_REGEX = /^[A-Z]{6}$/

export function hashSms(body: string): string {
  return djb2(body)
}

function parseCurrencyCode(amountStr: string): string {
  const upper = amountStr.toUpperCase()
  if (upper.includes("INR") || upper.includes("RS")) return "INR"
  if (upper.includes("USD") || upper.includes("$")) return "USD"
  if (upper.includes("EUR") || upper.includes("€")) return "EUR"
  if (upper.includes("GBP") || upper.includes("£")) return "GBP"
  if (upper.includes("AED")) return "AED"
  if (upper.includes("SGD")) return "SGD"
  if (upper.includes("AUD")) return "AUD"
  if (upper.includes("CAD")) return "CAD"
  if (upper.includes("JPY") || upper.includes("¥")) return "JPY"
  if (upper.includes("CHF")) return "CHF"
  return "USD"
}

function parseAmount(amountStr: string): number {
  const digits = amountStr.replace(/[^\d.]/g, "")
  return parseFloat(digits) || 0
}

function parseDate(body: string): string {
  // Try DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, "12 Apr 2026", "Apr 12"
  const patterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{2}[/-]\d{2}[/-]\d{4})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i,
  ]
  for (const p of patterns) {
    const m = body.match(p)
    if (m) {
      const d = new Date(m[1])
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10)
      }
    }
  }
  return new Date().toISOString().slice(0, 10)
}

export function parseSms(body: string, sender: string): ParsedSms | null {
  const hash = hashSms(body)

  // Exclusion check first
  if (EXCLUDE_PATTERNS.some((p) => p.test(body))) return null

  let confidence = 0

  // Debit keyword check
  const hasDebitKeyword = DEBIT_KEYWORDS.some((p) => p.test(body))
  if (!hasDebitKeyword) return null
  confidence += 25

  // Amount check
  const amountMatch = body.match(AMOUNT_REGEX)
  if (!amountMatch) return null
  confidence += 20

  // Sender check: 6-char alpha (Indian) or other alpha-only senders
  if (ALPHA_SENDER_REGEX.test(sender)) {
    confidence += 40
  } else if (/^[A-Za-z-]+$/.test(sender)) {
    confidence += 20
  }

  // Additional signals
  if (/\baccount\b/i.test(body)) confidence += 5
  if (/\bA\/c\b/i.test(body)) confidence += 5
  if (/\bbalance\b/i.test(body)) confidence += 5

  if (confidence < 80) return null

  const amountStr = amountMatch[0]
  const amount = parseAmount(amountStr)
  if (amount <= 0) return null

  const currency = parseCurrencyCode(amountStr)

  // Merchant extraction
  const merchantMatch = body.match(MERCHANT_REGEX)
  const merchant = (merchantMatch?.[1] ?? merchantMatch?.[2] ?? merchantMatch?.[3] ?? "").trim().slice(0, 40) || "Unknown"

  const date = parseDate(body)

  return { amount, currency, merchant, date, confidence, hash }
}

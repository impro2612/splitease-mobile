const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// Session-level cache: { "usd": { rates: { inr: 84.52, ... }, cachedAt: timestamp } }
const rateCache: Record<string, { rates: Record<string, number>; cachedAt: number }> = {}

async function fetchDirectRates(fromCurrency: string): Promise<Record<string, number> | null> {
  const from = fromCurrency.toLowerCase()
  const cached = rateCache[from]

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.rates
  }

  // Primary CDN, then the project's documented fallback mirror
  const sources = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from}.min.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${from}.min.json`,
  ]
  for (const url of sources) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 6000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) continue
      const data = await res.json()
      const rates: Record<string, number> = data[from]
      if (!rates) continue
      rateCache[from] = { rates, cachedAt: Date.now() }
      return rates
    } catch {
      // try the next source
    }
  }
  // Both sources down: a stale rate is better than none for display conversions
  return cached?.rates ?? null
}

/** Returns the direct exchange rate from → to. Returns null if unavailable. */
export async function getRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) return 1
  const rates = await fetchDirectRates(fromCurrency)
  return rates?.[toCurrency.toLowerCase()] ?? null
}

/** Converts an amount directly from one currency to another. Returns null if rate unavailable. */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) return amount
  const rate = await getRate(fromCurrency, toCurrency)
  return rate !== null ? amount * rate : null
}

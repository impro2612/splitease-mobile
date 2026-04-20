const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// Session-level cache: { "usd": { rates: { inr: 84.52, ... }, cachedAt: timestamp } }
const rateCache: Record<string, { rates: Record<string, number>; cachedAt: number }> = {}

async function fetchDirectRates(fromCurrency: string): Promise<Record<string, number> | null> {
  const from = fromCurrency.toLowerCase()
  const cached = rateCache[from]

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.rates
  }

  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from}.min.json`
    )
    if (!res.ok) return null
    const data = await res.json()
    const rates: Record<string, number> = data[from]
    if (!rates) return null
    rateCache[from] = { rates, cachedAt: Date.now() }
    return rates
  } catch {
    return null
  }
}

/** Returns the direct exchange rate from → to. Returns null if unavailable. */
export async function getRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1
  const rates = await fetchDirectRates(fromCurrency)
  return rates?.[toCurrency.toLowerCase()] ?? null
}

/** Converts an amount directly from one currency to another. Returns null if rate unavailable. */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  if (fromCurrency === toCurrency) return amount
  const rate = await getRate(fromCurrency, toCurrency)
  return rate !== null ? amount * rate : null
}

import { Platform } from "react-native"
import { useQuery } from "@tanstack/react-query"
import Purchases, { type PurchasesPackage } from "react-native-purchases"
import { plusApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"

/**
 * SplitIT Plus. Everyone gets the whole app free for 3 months; after that splitting
 * (groups, expenses, settle up, friends, chat) stays free and the More-section features
 * need Plus. The server decides access — this only mirrors it for the UI.
 */
export type PlusStatus = {
  access: boolean
  plan: "plus" | "trial" | "free"
  trialEndsAt: string | null
  plusUntil: string | null
  daysLeft: number | null
}

/** More-menu keys (lib/navigation MORE_ITEMS) that need Plus once the trial ends. */
export const PLUS_FEATURES = new Set(["spending", "borrow-book", "trip-planner", "timeline", "scrapbook", "spend-diary"])

export const PLUS_PRICES = { monthly: "₹49", yearly: "₹499" }

export function usePlus() {
  const token = useAuthStore((s) => s.token)
  const q = useQuery<PlusStatus>({
    queryKey: ["plus-status"],
    queryFn: async () => (await plusApi.status()).data,
    enabled: !!token,
    staleTime: 5 * 60_000,
  })
  // Unknown status (loading/offline) counts as unlocked: the server still enforces it,
  // and a lock flashing on and off is worse than a rare 402.
  return { status: q.data, locked: q.data ? !q.data.access : false, refetch: q.refetch }
}

// ── Store purchases (RevenueCat) ─────────────────────────────────────────────

const RC_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
})

/** False until the RevenueCat keys are in .env — the Plus screen then shows "coming soon". */
export const paymentsReady = !!RC_KEY

let configuredFor: string | null = null

/** RevenueCat's app user id is our user id, so the server can match webhooks to users. */
async function ensurePurchases(userId: string) {
  if (!RC_KEY) throw new Error("Payments are not set up yet")
  if (configuredFor === userId) return
  if (configuredFor === null) Purchases.configure({ apiKey: RC_KEY, appUserID: userId })
  else await Purchases.logIn(userId)
  configuredFor = userId
}

export type PlusPlans = { monthly?: PurchasesPackage; yearly?: PurchasesPackage }

export async function loadPlans(userId: string): Promise<PlusPlans> {
  await ensurePurchases(userId)
  const current = (await Purchases.getOfferings()).current
  return { monthly: current?.monthly ?? undefined, yearly: current?.annual ?? undefined }
}

/** Buys a plan. Returns false if the user cancelled the store sheet. */
export async function buyPlan(userId: string, pkg: PurchasesPackage): Promise<boolean> {
  await ensurePurchases(userId)
  try {
    await Purchases.purchasePackage(pkg)
  } catch (e: any) {
    if (e?.userCancelled) return false
    throw e
  }
  await plusApi.sync()
  return true
}

export async function restorePurchases(userId: string) {
  await ensurePurchases(userId)
  await Purchases.restorePurchases()
  await plusApi.sync()
}

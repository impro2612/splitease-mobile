import { useEffect, useState } from "react"
import { AppState, Platform } from "react-native"
import { useQuery } from "@tanstack/react-query"
import Purchases, { type PurchasesPackage } from "react-native-purchases"
import { plusApi } from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { createPusher } from "@/lib/pusher"
import queryClient from "@/lib/query-client"

/**
 * SplitIT Plus. Everyone gets the whole app free for 3 months; after that splitting
 * (groups, expenses, settle up, friends) stays free; chat and the More-section features
 * need Plus. The server decides access — this only mirrors it for the UI.
 */
export type PlusStatus = {
  access: boolean
  plan: "plus" | "trial" | "free"
  trialEndsAt: string | null
  plusUntil: string | null
  daysLeft: number | null
  willRenew: boolean | null // plus only: false once the subscription is cancelled
}

/** More-menu keys (lib/navigation MORE_ITEMS) that need Plus once the trial ends. */
export const PLUS_FEATURES = new Set(["spending", "borrow-book", "trip-planner", "timeline", "scrapbook", "spend-diary"])

export const PLUS_PRICES = { monthly: "₹49", yearly: "₹499" }

const DAY = 24 * 60 * 60 * 1000

/** Locked after a paid Plus ran out (as opposed to a free trial that ended). */
export function plusLapsed(s: PlusStatus | undefined): boolean {
  return s?.plan === "free" && !!s.plusUntil
}

/** Whole days until a cancelled Plus subscription ends, or null if it renews / isn't Plus. */
export function plusEndsInDays(s: PlusStatus | undefined, now = Date.now()): number | null {
  if (s?.plan !== "plus" || s.willRenew !== false || !s.plusUntil) return null
  const left = Date.parse(s.plusUntil) - now
  return left > 0 ? Math.ceil(left / DAY) : null
}

/**
 * Re-derives access from the end dates against the current clock, so a trial or
 * subscription that ends while the app is open locks straight away, without waiting
 * for the next server check.
 */
function liveStatus(s: PlusStatus, now: number): PlusStatus {
  const plusUntil = s.plusUntil ? Date.parse(s.plusUntil) : null
  if (plusUntil && plusUntil > now) return { ...s, access: true, plan: "plus", daysLeft: null }
  // A subscription reaching its end date has usually just renewed: keep the server's
  // "plus" until it says otherwise (usePlus re-checks right at that moment)
  if (plusUntil && s.plan === "plus") return s
  if (!s.trialEndsAt) return s // paywall not launched yet: the server's answer stands
  const end = Date.parse(s.trialEndsAt)
  if (end > now) return { ...s, access: true, plan: "trial", daysLeft: Math.ceil((end - now) / DAY) }
  return { ...s, access: false, plan: "free", daysLeft: 0 }
}

/** The next moment the derived status changes (a day ticks over or something ends). */
function nextChange(s: PlusStatus, now: number): number | null {
  const times = [s.plusUntil, s.trialEndsAt].filter(Boolean).map((t) => Date.parse(t!)).filter((t) => t > now)
  if (s.trialEndsAt) {
    const end = Date.parse(s.trialEndsAt)
    if (end > now) times.push(end - Math.floor((end - now) / DAY) * DAY) // daysLeft ticks down
  }
  if (s.willRenew === false && s.plusUntil) {
    const end = Date.parse(s.plusUntil)
    if (end > now) times.push(end - Math.floor((end - now) / DAY) * DAY) // ending countdown ticks down
  }
  return times.length ? Math.min(...times) : null
}

export function usePlus() {
  const token = useAuthStore((s) => s.token)
  const q = useQuery<PlusStatus>({
    queryKey: ["plus-status"],
    queryFn: async () => (await plusApi.status()).data,
    enabled: !!token,
    staleTime: 30_000,
  })
  const [now, setNow] = useState(Date.now())
  const next = q.data ? nextChange(q.data, now) : null
  useEffect(() => {
    if (next === null) return
    // setTimeout caps at ~24.8 days; re-arm in hourly steps for anything further out
    const t = setTimeout(() => {
      setNow(Date.now())
      if (Date.now() >= next) q.refetch() // something just ended: ask the server
    }, Math.min(next - Date.now() + 500, 60 * 60 * 1000))
    return () => clearTimeout(t)
  }, [next, now])
  const status = q.data ? liveStatus(q.data, now) : undefined
  // Unknown status (first load, offline with no cache) counts as unlocked: the server
  // still enforces it, and a lock flashing on and off is worse than a rare 402.
  return { status, locked: status ? !status.access : false, refetch: q.refetch }
}

/**
 * Keeps Plus status in step with the server while signed in: live "plus-updated" push
 * when a subscription is bought/renewed/ends, a re-check whenever the app comes to the
 * foreground, and a light poll every minute as a safety net. Mounted once in the root layout.
 */
export function usePlusSync(userId: string | undefined) {
  // The root layout sits above the query provider, so use the shared client directly
  const qc = queryClient
  useEffect(() => {
    if (!userId) return
    const refresh = () => qc.invalidateQueries({ queryKey: ["plus-status"] })
    refresh()
    const pusher = createPusher()
    const channel = pusher.subscribe(`private-user-${userId}`)
    channel.bind("plus-updated", refresh)
    const app = AppState.addEventListener("change", (next) => { if (next === "active") refresh() })
    const poll = setInterval(() => { if (AppState.currentState === "active") refresh() }, 60_000)
    return () => {
      clearInterval(poll)
      app.remove()
      channel.unbind("plus-updated", refresh)
      pusher.unsubscribe(`private-user-${userId}`)
      pusher.disconnect()
    }
  }, [userId, qc])
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

export type PlusSubscription = {
  period: "monthly" | "yearly" | null
  willRenew: boolean
  billingIssue: boolean
}

/** The store side of an active Plus subscription: plan length, auto-renew, payment trouble. */
export async function loadSubscription(userId: string): Promise<PlusSubscription | null> {
  if (!RC_KEY) return null
  await ensurePurchases(userId)
  const ent = (await Purchases.getCustomerInfo()).entitlements.active.splitit_plus
  if (!ent) return null
  const id = ent.productIdentifier.toLowerCase()
  return {
    period: /year|annual/.test(id) ? "yearly" : /month/.test(id) ? "monthly" : null,
    willRenew: ent.willRenew,
    billingIssue: !!ent.billingIssueDetectedAt,
  }
}

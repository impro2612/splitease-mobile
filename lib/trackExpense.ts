import AsyncStorage from "@react-native-async-storage/async-storage"

export type TrackConfig = {
  groupId: string
  groupName: string
  currency: string
  enabledAt: string
  expiresAt: string | null
}

export type PendingSuggestion = {
  id: string
  amount: number
  currency: string
  merchant: string
  date: string
  rawSms: string
}

const TRACK_KEY = "trackExpense"
const HASHES_KEY = "processedHashes"
const SUGGESTION_KEY = "pendingSuggestion"

export async function getTrackConfig(): Promise<TrackConfig | null> {
  const raw = await AsyncStorage.getItem(TRACK_KEY)
  if (!raw) return null
  const cfg: TrackConfig = JSON.parse(raw)
  if (cfg.expiresAt && new Date(cfg.expiresAt) <= new Date()) {
    await AsyncStorage.removeItem(TRACK_KEY)
    return null
  }
  return cfg
}

export async function setTrackConfig(cfg: TrackConfig): Promise<void> {
  await AsyncStorage.setItem(TRACK_KEY, JSON.stringify(cfg))
}

export async function clearTrackConfig(): Promise<void> {
  await AsyncStorage.removeItem(TRACK_KEY)
}

export async function isTrackingActive(): Promise<boolean> {
  const cfg = await getTrackConfig()
  return cfg !== null
}

export async function getProcessedHashes(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(HASHES_KEY)
  return raw ? new Set(JSON.parse(raw)) : new Set()
}

export async function addProcessedHash(hash: string): Promise<void> {
  const hashes = await getProcessedHashes()
  hashes.add(hash)
  // keep at most 500 recent hashes to avoid unbounded growth
  const arr = Array.from(hashes).slice(-500)
  await AsyncStorage.setItem(HASHES_KEY, JSON.stringify(arr))
}

export async function hasProcessedHash(hash: string): Promise<boolean> {
  const hashes = await getProcessedHashes()
  return hashes.has(hash)
}

export async function getPendingSuggestion(): Promise<PendingSuggestion | null> {
  const raw = await AsyncStorage.getItem(SUGGESTION_KEY)
  return raw ? JSON.parse(raw) : null
}

export async function setPendingSuggestion(s: PendingSuggestion): Promise<void> {
  await AsyncStorage.setItem(SUGGESTION_KEY, JSON.stringify(s))
}

export async function clearPendingSuggestion(): Promise<void> {
  await AsyncStorage.removeItem(SUGGESTION_KEY)
}

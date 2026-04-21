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

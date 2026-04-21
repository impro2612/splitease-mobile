import { NativeModules, Platform, Linking } from "react-native"

const { TrackExpenseModule } = NativeModules

type NativeBridge = {
  setConfig(json: string): Promise<void>
  clearConfig(): Promise<void>
  getPendingSuggestion(): Promise<string | null>
  clearPendingSuggestion(): Promise<void>
  getPendingSuggestionById(id: string): Promise<string | null>
  clearPendingSuggestionById(id: string): Promise<void>
  isNotificationAccessGranted(): Promise<boolean>
}

const bridge: NativeBridge | null = Platform.OS === "android" ? TrackExpenseModule : null

export async function syncTrackConfigToNative(config: object | null): Promise<void> {
  if (!bridge) return
  if (config) {
    await bridge.setConfig(JSON.stringify(config))
  } else {
    await bridge.clearConfig()
  }
}

export async function getNativePendingSuggestion(): Promise<object | null> {
  if (!bridge) return null
  const raw = await bridge.getPendingSuggestion()
  return raw ? JSON.parse(raw) : null
}

export async function clearNativePendingSuggestion(): Promise<void> {
  if (!bridge) return
  await bridge.clearPendingSuggestion()
}

export async function getNativePendingSuggestionById(id: string): Promise<object | null> {
  if (!bridge) return null
  const raw = await bridge.getPendingSuggestionById(id)
  return raw ? JSON.parse(raw) : null
}

export async function clearNativePendingSuggestionById(id: string): Promise<void> {
  if (!bridge) return
  await bridge.clearPendingSuggestionById(id)
}

export async function checkNotificationAccess(): Promise<boolean> {
  if (!bridge) return false
  return bridge.isNotificationAccessGranted()
}

export async function openNotificationAccessSettings(): Promise<void> {
  await Linking.openSettings()
}

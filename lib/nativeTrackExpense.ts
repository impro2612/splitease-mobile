import { NativeModules, Platform } from "react-native"

const { TrackExpenseModule } = NativeModules

type NativeBridge = {
  setConfig(json: string): Promise<void>
  clearConfig(): Promise<void>
  getPendingSuggestion(): Promise<string | null>
  clearPendingSuggestion(): Promise<void>
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

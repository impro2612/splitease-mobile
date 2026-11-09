import Pusher, { type Channel } from "pusher-js/react-native"
import { api } from "@/lib/api"

const PusherCtor = ((Pusher as any)?.Pusher ?? Pusher) as typeof Pusher

/**
 * One Pusher socket for the whole app. Screens share it via subscribeChannel(), which
 * ref-counts subscriptions per channel name so several screens listening on the same
 * `private-user-<id>` channel cost one subscription, not one WebSocket each.
 * Channel auth goes through the shared axios instance, so an expired access token is
 * refreshed transparently instead of the private channel silently failing to subscribe.
 */
let instance: Pusher | null = null
const refs = new Map<string, number>()
let idleTimer: ReturnType<typeof setTimeout> | null = null

const IDLE_GRACE_MS = 2_000

function create(): Pusher {
  return new PusherCtor(process.env.EXPO_PUBLIC_PUSHER_KEY ?? "", {
    cluster: process.env.EXPO_PUBLIC_PUSHER_CLUSTER ?? "ap2",
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
      customHandler: async ({ socketId, channelName }, callback) => {
        try {
          const res = await api.post("/api/pusher/auth", { socket_id: socketId, channel_name: channelName })
          callback(null, res.data)
        } catch (e) {
          callback(e as Error, null)
        }
      },
    },
  })
}

function cancelIdle() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
}

/** The shared client, created on first use and reconnected if it was idled out. */
export function getPusher(): Pusher {
  cancelIdle()
  if (!instance) instance = create()
  // A grace-timer disconnect leaves the instance around; wake it up again
  else if (instance.connection.state === "disconnected") instance.connect()
  return instance
}

/**
 * Subscribes to a channel on the shared socket. The first subscriber opens the
 * subscription, later ones reuse it; `release` drops it only when nobody is left.
 * Callers must unbind their own handlers before releasing — never `unbind_all()`,
 * which would strip other screens' bindings off the shared channel.
 */
export function subscribeChannel(name: string): { channel: Channel; release: () => void } {
  const pusher = getPusher()
  refs.set(name, (refs.get(name) ?? 0) + 1)
  const channel = pusher.subscribe(name)
  let released = false
  const release = () => {
    if (released) return // a cleanup running twice must not steal another screen's count
    released = true
    const left = (refs.get(name) ?? 1) - 1
    if (left > 0) { refs.set(name, left); return }
    refs.delete(name)
    pusher.unsubscribe(name)
    // Screen transitions release then re-subscribe within a frame: hold the socket briefly
    if (refs.size === 0) {
      cancelIdle()
      idleTimer = setTimeout(() => {
        idleTimer = null
        if (refs.size === 0) instance?.disconnect()
      }, IDLE_GRACE_MS)
    }
  }
  return { channel, release }
}

/** Tears everything down. Call on sign-out so the next user never inherits a channel. */
export function resetPusher() {
  cancelIdle()
  refs.clear()
  if (!instance) return
  const p = instance
  instance = null
  try {
    p.allChannels().forEach((c) => { c.unbind_all(); p.unsubscribe(c.name) })
    p.connection.unbind_all()
    p.disconnect()
  } catch {
    // Already closed; nothing to release
  }
}

/** @deprecated Use subscribeChannel(); this now returns the shared singleton. */
export function createPusher(): Pusher {
  return getPusher()
}

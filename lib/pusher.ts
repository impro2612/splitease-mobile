import Pusher from "pusher-js/react-native"
import { api } from "@/lib/api"

const PusherCtor = ((Pusher as any)?.Pusher ?? Pusher) as typeof Pusher

/**
 * One Pusher client per screen subscription. Channel auth goes through the shared
 * axios instance, so an expired access token is refreshed transparently instead of
 * the private channel silently failing to subscribe.
 */
export function createPusher(): Pusher {
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

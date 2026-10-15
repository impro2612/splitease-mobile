import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import NetInfo from "@react-native-community/netinfo"
import { expensesApi } from "@/lib/api"
import * as offlineQueue from "@/lib/offline-queue"
import type { PendingExpense } from "@/lib/offline-queue"
import queryClient from "@/lib/query-client"
import Toast from "react-native-toast-message"

type OfflineContextType = {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  enqueueExpense: (expense: PendingExpense) => Promise<void>
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  enqueueExpense: async () => {},
})

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const prevOnlineRef = useRef<boolean | null>(null)
  const isFlushingRef = useRef(false)

  const refreshCount = useCallback(async () => {
    const q = await offlineQueue.getAll()
    setPendingCount(q.length)
  }, [])

  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current) return
    isFlushingRef.current = true
    try {
      const items = await offlineQueue.getAll()
      if (items.length === 0) return
      setIsSyncing(true)
      const rejected: string[] = []
      for (const item of items) {
        try {
          // clientRequestId makes the retry safe if an earlier attempt reached the server
          await expensesApi.add(item.groupId, { ...item.payload, clientRequestId: item.payload.clientRequestId ?? item.id })
          await offlineQueue.remove(item.id)
          // Invalidate so the optimistic card is replaced by real server data
          queryClient.invalidateQueries({ queryKey: ["group", item.groupId] })
          queryClient.invalidateQueries({ queryKey: ["balances", item.groupId] })
          queryClient.invalidateQueries({ queryKey: ["groups"] })
          queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
          queryClient.invalidateQueries({ queryKey: ["activity"] })
        } catch (err: any) {
          // 4xx = bad data, never going to succeed — drop it
          // (except 429 rate limiting, which is worth retrying later)
          const status = err?.response?.status
          if (status >= 400 && status < 500 && status !== 429) {
            await offlineQueue.remove(item.id)
            rejected.push(item.payload.description)
          }
          // 5xx / network error — leave in queue, retry next reconnect
        }
      }
      if (rejected.length > 0) {
        Toast.show({
          type: "error",
          text1: `${rejected.length} offline expense${rejected.length > 1 ? "s" : ""} couldn't be saved`,
          text2: rejected.slice(0, 3).map((d) => `"${d}"`).join(", ") + " — please add again",
        })
      }
      await refreshCount()
      setIsSyncing(false)
    } finally {
      isFlushingRef.current = false
    }
  }, [refreshCount])

  const enqueueExpense = useCallback(async (expense: PendingExpense) => {
    await offlineQueue.enqueue(expense)
    await refreshCount()
  }, [refreshCount])

  useEffect(() => {
    refreshCount()
    NetInfo.fetch().then((s) => setIsOnline(!!s.isConnected && !!s.isInternetReachable))
    const unsub = NetInfo.addEventListener((s) => {
      setIsOnline(!!s.isConnected && !!s.isInternetReachable)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (prevOnlineRef.current === false && isOnline) {
      flushQueue()
      queryClient.refetchQueries({ type: "active" })
    }
    prevOnlineRef.current = isOnline
  }, [isOnline, flushQueue])

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, isSyncing, enqueueExpense }}>
      {children}
    </OfflineContext.Provider>
  )
}

export const useOffline = () => useContext(OfflineContext)

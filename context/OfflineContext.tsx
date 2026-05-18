import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import NetInfo from "@react-native-community/netinfo"
import { expensesApi } from "@/lib/api"
import * as offlineQueue from "@/lib/offline-queue"
import type { PendingExpense } from "@/lib/offline-queue"
import queryClient from "@/lib/query-client"

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

  const refreshCount = useCallback(async () => {
    const q = await offlineQueue.getAll()
    setPendingCount(q.length)
  }, [])

  const flushQueue = useCallback(async () => {
    const items = await offlineQueue.getAll()
    if (items.length === 0) return
    setIsSyncing(true)
    for (const item of items) {
      try {
        await expensesApi.add(item.groupId, item.payload)
        await offlineQueue.remove(item.id)
        // Invalidate so the optimistic card is replaced by real server data
        queryClient.invalidateQueries({ queryKey: ["group", item.groupId] })
        queryClient.invalidateQueries({ queryKey: ["balances", item.groupId] })
        queryClient.invalidateQueries({ queryKey: ["groups"] })
        queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
        queryClient.invalidateQueries({ queryKey: ["activity"] })
      } catch (err: any) {
        // 4xx = bad data, never going to succeed — drop it
        if (err?.response?.status >= 400 && err?.response?.status < 500) {
          await offlineQueue.remove(item.id)
        }
        // 5xx / network error — leave in queue, retry next reconnect
      }
    }
    await refreshCount()
    setIsSyncing(false)
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

import { QueryClient, onlineManager } from "@tanstack/react-query"
import NetInfo from "@react-native-community/netinfo"

// React Query's built-in network detection uses navigator.onLine which doesn't
// exist in React Native. Without this, invalidateQueries marks queries stale but
// never triggers the refetch (the online manager thinks the device is offline).
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected && !!state.isInternetReachable))
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days — keeps cache alive for offline use
      networkMode: "offlineFirst",       // serve persisted cache even when offline
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
})

export default queryClient

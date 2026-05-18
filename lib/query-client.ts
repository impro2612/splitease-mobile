import { QueryClient } from "@tanstack/react-query"

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

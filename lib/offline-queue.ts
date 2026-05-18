import AsyncStorage from "@react-native-async-storage/async-storage"

const QUEUE_KEY = "splitit:offline_expenses"

export type PendingExpense = {
  id: string       // client UUID — used as optimistic key in UI
  groupId: string
  createdAt: number
  payload: {
    description: string
    amount: number
    currency: string
    paidById: string
    splitType: string
    splits: { userId: string; amount: number }[]
    category?: string
    date?: string
  }
}

export async function enqueue(expense: PendingExpense): Promise<void> {
  const current = await getAll()
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...current, expense]))
}

export async function getAll(): Promise<PendingExpense[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PendingExpense[]
  } catch {
    return []
  }
}

export async function remove(id: string): Promise<void> {
  const current = await getAll()
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(current.filter((e) => e.id !== id)))
}

// Client-side copy of category list — mirrors backend src/lib/categorize.ts
export const CATEGORIES = [
  "Salary / Income",
  "Food / Dining",
  "Rent / Housing",
  "Transport",
  "Shopping",
  "Subscriptions",
  "Transfers",
  "Bills / Utilities",
  "EMI / Loans",
  "Miscellaneous",
] as const

export type Category = (typeof CATEGORIES)[number]

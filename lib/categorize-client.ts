// Client-side copy of category list — mirrors backend src/lib/categorize.ts
export const CATEGORIES = [
  "Salary / Income",
  "Food / Dining",
  "Rent / Housing",
  "Transport",
  "Travel",
  "Shopping",
  "Subscriptions",
  "UPI Payments",
  "Transfers",
  "Bills / Utilities",
  "EMI / Loans",
  "Credit Card Payments",
  "Medical / Pharmacy",
  "Bank Charges",
  "Miscellaneous",
] as const

export type Category = (typeof CATEGORIES)[number]

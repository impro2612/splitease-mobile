import { useEffect, useRef, useState } from "react"
import { View, TouchableOpacity, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Text } from "@/components/ui/Typography"
import { InAppFullScreenModal } from "@/components/ui/InAppModal"
import { useTheme } from "@/lib/theme"
import { parseAmountInput, toLocalDateKey } from "@/lib/utils"
import { NO_DECIMAL_CURRENCIES } from "@/lib/currencies"
import { ExpenseFormFields } from "./ExpenseFormFields"

export type SplitType = "EQUAL" | "PERCENTAGE" | "CUSTOM"

/** What the group screen sends to the API for a new or edited expense. */
export type ExpensePayload = {
  description: string
  amount: number
  category: string
  paidById: string
  splitType: string
  splits: { userId: string; amount: number }[]
  date: string
  currency: string
}

type Snapshot = {
  desc: string; amount: string; currency: string; category: string; paidBy: string; date: string
  splitType: SplitType; equallyIncluded: string[]; percentageSplits: Record<string, string>; customSplits: Record<string, string>
}

/**
 * Full-screen Add / Edit expense form. Owns all of its field state so typing here
 * doesn't re-render the group screen behind it; the parent only gets the final payload.
 */
export function ExpenseSheet({ mode, visible, onClose, members, gc, user, initial, isPending, onSubmit, onDelete }: {
  mode: "add" | "edit"
  visible: boolean
  onClose: () => void
  members: any[]
  gc: { code: string; symbol: string }
  user: { id: string } | null | undefined
  /** The expense being edited (edit mode) */
  initial?: any
  isPending: boolean
  onSubmit: (payload: ExpensePayload) => void
  onDelete?: () => void
}) {
  const C = useTheme()
  const insets = useSafeAreaInsets()

  const [desc, setDesc] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("")
  const [category, setCategory] = useState("general")
  const [paidBy, setPaidBy] = useState(user?.id ?? "")
  const [date, setDate] = useState(new Date())
  const [splitType, setSplitType] = useState<SplitType>("EQUAL")
  const [equallyIncluded, setEquallyIncluded] = useState<string[]>([])
  const [percentageSplits, setPercentageSplits] = useState<Record<string, string>>({})
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})
  // Edit mode: what the form looked like when it opened, so Save stays off until something changes
  const original = useRef<Snapshot | null>(null)

  // (Re)initialise every time the sheet opens
  useEffect(() => {
    if (!visible) return
    if (mode === "add" || !initial) {
      setDesc(""); setAmount(""); setCategory("general"); setCurrency(gc.code)
      setPaidBy(user?.id ?? ""); setDate(new Date())
      setSplitType("EQUAL"); setEquallyIncluded([]); setPercentageSplits({}); setCustomSplits({})
      original.current = null
      return
    }
    const exp = initial
    const snap: Snapshot = {
      desc: exp.description,
      amount: String(exp.amount),
      currency: exp.currency ?? gc.code,
      category: exp.category ?? "general",
      paidBy: exp.paidById,
      date: new Date(exp.date ?? exp.createdAt).toISOString(),
      splitType: "EQUAL", equallyIncluded: [], percentageSplits: {}, customSplits: {},
    }
    const splits: any[] = exp.splits ?? []
    if (exp.splitType === "PERCENTAGE") {
      // Derive each % from the saved amounts
      const pct: Record<string, string> = {}
      for (const sp of splits) pct[sp.userId] = String(parseFloat((sp.amount / exp.amount * 100).toFixed(4)))
      snap.splitType = "PERCENTAGE"; snap.percentageSplits = pct
    } else {
      // "EXACT" covers both the Equally and Custom UI modes — equal if every share matches
      const amounts = splits.map((sp: any) => sp.amount)
      const isEqualSplit = amounts.length <= 1 || Math.max(...amounts) - Math.min(...amounts) <= 0.01
      if (isEqualSplit) {
        snap.splitType = "EQUAL"; snap.equallyIncluded = splits.map((sp: any) => sp.userId)
      } else {
        const custom: Record<string, string> = {}
        for (const sp of splits) custom[sp.userId] = String(sp.amount)
        snap.splitType = "CUSTOM"; snap.customSplits = custom
      }
    }
    setDesc(snap.desc); setAmount(snap.amount); setCurrency(snap.currency); setCategory(snap.category)
    setPaidBy(snap.paidBy); setDate(new Date(snap.date))
    setSplitType(snap.splitType); setEquallyIncluded([...snap.equallyIncluded])
    setPercentageSplits({ ...snap.percentageSplits }); setCustomSplits({ ...snap.customSplits })
    original.current = snap
  }, [visible, mode, initial?.id])

  const memberIds: string[] = members.map((m: any) => m.userId)
  const numAmount = parseAmountInput(amount)
  const activeCurrency = currency || gc.code

  function buildSplits(): { apiSplitType: string; splits: ExpensePayload["splits"] } {
    const included = equallyIncluded.length > 0 ? equallyIncluded : memberIds
    const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrency)
    if (splitType === "EQUAL") {
      const n = included.length
      if (isNoDec) {
        // 0-decimal currencies (JPY, KRW, …): split at base-unit level
        const totalUnits = Math.round(numAmount)
        const base = Math.floor(totalUnits / n)
        const extra = totalUnits - base * n
        return { apiSplitType: "EXACT", splits: included.map((uid, i) => ({ userId: uid, amount: base + (i < extra ? 1 : 0) })) }
      }
      // 2-decimal currencies: split in cents so the total is exact
      const totalCents = Math.round(numAmount * 100)
      const base = Math.floor(totalCents / n)
      const extra = totalCents - base * n
      return { apiSplitType: "EXACT", splits: included.map((uid, i) => ({ userId: uid, amount: (base + (i < extra ? 1 : 0)) / 100 })) }
    }
    if (splitType === "PERCENTAGE") {
      const withPct = memberIds.filter((uid) => parseAmountInput(percentageSplits[uid] || "0") > 0)
      if (mode === "add") {
        // The API accepts percentages for PERCENTAGE splits even though the shared type says amounts
        return { apiSplitType: "PERCENTAGE", splits: withPct.map((uid) => ({ userId: uid, percentage: parseAmountInput(percentageSplits[uid] || "0") })) as any }
      }
      // Edit sends exact amounts derived from the percentages
      return {
        apiSplitType: "EXACT",
        splits: withPct.map((uid) => {
          const raw = numAmount * parseAmountInput(percentageSplits[uid] || "0") / 100
          return { userId: uid, amount: isNoDec ? Math.round(raw) : Math.round(raw * 100) / 100 }
        }),
      }
    }
    return {
      apiSplitType: "EXACT",
      splits: memberIds
        .filter((uid) => parseAmountInput(customSplits[uid] || "0") > 0)
        .map((uid) => ({ userId: uid, amount: parseAmountInput(customSplits[uid] || "0") })),
    }
  }

  function submit() {
    const { apiSplitType, splits } = buildSplits()
    onSubmit({
      description: desc.trim(),
      amount: numAmount,
      category,
      paidById: paidBy || user?.id || "",
      splitType: apiSplitType,
      splits,
      date: date.toISOString(),
      currency: activeCurrency,
    })
  }

  // Validity: amount present, and % / custom splits add up
  const fieldsOk = !!desc.trim() && !!amount && !isNaN(numAmount)
  const splitsOk = (() => {
    if (splitType === "PERCENTAGE") {
      const pctTotal = memberIds.reduce((t, uid) => t + parseAmountInput(percentageSplits[uid] || "0"), 0)
      return Math.abs(pctTotal - 100) <= 0.01
    }
    if (splitType === "CUSTOM") {
      const customTotal = memberIds.reduce((t, uid) => t + parseAmountInput(customSplits[uid] || "0"), 0)
      return Math.abs(customTotal - numAmount) <= 0.01
    }
    return true
  })()
  const isDirty = (() => {
    const o = original.current
    if (mode === "add" || !o) return true
    const splitChanged =
      splitType !== o.splitType ||
      JSON.stringify([...equallyIncluded].sort()) !== JSON.stringify([...o.equallyIncluded].sort()) ||
      JSON.stringify(percentageSplits) !== JSON.stringify(o.percentageSplits) ||
      JSON.stringify(customSplits) !== JSON.stringify(o.customSplits)
    return (
      desc.trim() !== o.desc.trim() || amount !== o.amount || currency !== o.currency || category !== o.category ||
      paidBy !== o.paidBy || toLocalDateKey(date) !== toLocalDateKey(new Date(o.date)) || splitChanged
    )
  })()
  const canSave = fieldsOk && splitsOk && isDirty && !isPending

  return (
    <InAppFullScreenModal visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingHorizontal: 20 }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>{mode === "add" ? "Add Expense" : "Edit Expense"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {mode === "edit" && onDelete && (
              <TouchableOpacity onPress={onDelete} style={{ backgroundColor: "rgba(244,63,94,0.15)", borderRadius: 20, padding: 8 }} accessibilityLabel="Delete expense">
                <Ionicons name="trash-outline" size={18} color={C.negative} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }} accessibilityLabel="Close">
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <ExpenseFormFields
            desc={desc} setDesc={setDesc}
            amount={amount} setAmount={setAmount}
            currency={activeCurrency} setCurrency={setCurrency}
            category={category} setCategory={setCategory}
            paidBy={paidBy} setPaidBy={setPaidBy}
            date={date} setDate={setDate}
            members={members} gc={gc} user={user}
            splitType={splitType} setSplitType={setSplitType}
            equallyIncluded={equallyIncluded} setEquallyIncluded={setEquallyIncluded}
            percentageSplits={percentageSplits} setPercentageSplits={setPercentageSplits}
            customSplits={customSplits} setCustomSplits={setCustomSplits}
          />
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(28, insets.bottom + 16), borderTopWidth: 1, borderTopColor: C.border }}>
          <TouchableOpacity
            onPress={submit}
            disabled={!canSave}
            style={{ backgroundColor: canSave ? "#6366f1" : "#374151", borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center", opacity: canSave || mode === "add" ? 1 : 0.5 }}
          >
            {isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{mode === "add" ? "Add Expense" : "Save Changes"}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </InAppFullScreenModal>
  )
}

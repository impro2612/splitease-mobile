import { memo } from "react"
import { View, ActivityIndicator } from "react-native"
import { Text } from "@/components/ui/Typography"
import { useTheme } from "@/lib/theme"
import { formatCurrency } from "@/lib/utils"
import { CURRENCIES } from "@/lib/currencies"
import { AnimatedPieChart, BarChart, PIE_COLORS } from "./charts"

/**
 * Group → Insights: per-currency totals, your share, and the pie/bar charts.
 * Memoised so typing elsewhere on the group screen doesn't re-run the chart maths.
 */
export const InsightsTab = memo(function InsightsTab({ expenses, members, userId, gc, fxRates, fxAttempted }: {
  expenses: any[]
  members: any[]
  userId: string | undefined
  gc: { code: string; symbol: string }
  fxRates: Record<string, number>
  fxAttempted: boolean
}) {
  const C = useTheme()
      // Per-currency totals and my-share
      const totalByCurrency: Record<string, number> = {}
      const myShareByCurrency: Record<string, number> = {}
      for (const e of expenses) {
        const cur = e.currency ?? gc.code
        totalByCurrency[cur] = (totalByCurrency[cur] ?? 0) + e.amount
        const mySplit = e.splits?.find((sp: any) => sp.userId === userId)
        if (mySplit) myShareByCurrency[cur] = (myShareByCurrency[cur] ?? 0) + mySplit.amount
      }
      // Sorted currency lists: default first, then alphabetical
      const currencyOrder = [
        gc.code,
        ...Object.keys(totalByCurrency).filter(c => c !== gc.code).sort(),
      ]
      const isMultiCurrency = currencyOrder.length > 1

      // Convert all non-default currencies to default for main totals
      const totalGroupExpense = Object.entries(totalByCurrency).reduce((sum, [c, amt]) => {
        if (c === gc.code) return sum + amt
        const rate = fxRates[c]
        return sum + (rate ? amt * rate : 0)
      }, 0)
      const myShare = Object.entries(myShareByCurrency).reduce((sum, [c, amt]) => {
        if (c === gc.code) return sum + amt
        const rate = fxRates[c]
        return sum + (rate ? amt * rate : 0)
      }, 0)
      const missingRates = currencyOrder.slice(1).filter(c => !fxRates[c])
      // After the fetch attempt has finished, show what we can instead of spinning forever
      const ratesLoaded = !isMultiCurrency || missingRates.length === 0 || fxAttempted

      // Per-member share — convert all currencies to default gc before summing
      const memberShareMap: Record<string, number> = {}
      for (const m of members) memberShareMap[m.userId] = 0
      for (const e of expenses) {
        const expCur = e.currency ?? gc.code
        const rate = expCur === gc.code ? 1 : (fxRates[expCur] ?? null)
        if (rate === null) continue // skip until rate is loaded
        for (const s of (e.splits ?? [])) {
          if (memberShareMap[s.userId] !== undefined) memberShareMap[s.userId] += s.amount * rate
        }
      }
      const pieData = members
        .map((m: any, i: number) => ({
          name: m.userId === userId ? "You" : (m.user?.name ?? "?"),
          amount: memberShareMap[m.userId] ?? 0,
          color: PIE_COLORS[i % PIE_COLORS.length],
          userId: m.userId,
        }))
        .filter((d) => d.amount > 0)

      return (
        <View style={{ gap: 16, paddingVertical: 12 }}>
          {/* Summary cards */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            {/* GROUP TOTAL */}
            <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 }}>
              <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>GROUP TOTAL</Text>
              <Text style={{ color: C.text, fontSize: 22, fontWeight: "800" }}>
                {ratesLoaded ? formatCurrency(totalGroupExpense, gc.symbol, gc.code) : "…"}
              </Text>
              <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 4 }}>{expenses.length} expenses</Text>
              {ratesLoaded && missingRates.length > 0 && (
                <Text style={{ color: "#f59e0b", fontSize: 10, marginTop: 4 }}>
                  Excludes {missingRates.join(", ")} (exchange rate unavailable)
                </Text>
              )}
              {isMultiCurrency && (
                <View style={{ marginTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 }}>
                  {currencyOrder.filter(c => (totalByCurrency[c] ?? 0) > 0).map(c => {
                    const ci = CURRENCIES.find(x => x.code === c) ?? { symbol: c, code: c, flag: "" }
                    return (
                      <View key={c} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ color: C.textMuted, fontSize: 11 }}>{ci.flag} {c}</Text>
                        <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600" }}>{formatCurrency(totalByCurrency[c], ci.symbol, ci.code)}</Text>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>

            {/* YOUR SHARE */}
            <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)", padding: 16 }}>
              <Text style={{ color: C.textSub, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>YOUR SHARE</Text>
              <Text style={{ color: "#6366f1", fontSize: 22, fontWeight: "800" }}>
                {ratesLoaded ? formatCurrency(myShare, gc.symbol, gc.code) : "…"}
              </Text>
              <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 4 }}>
                {totalGroupExpense > 0 && ratesLoaded ? `${((myShare / totalGroupExpense) * 100).toFixed(1)}% of total` : "—"}
              </Text>
              {isMultiCurrency && (
                <View style={{ marginTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: "rgba(99,102,241,0.15)", paddingTop: 8 }}>
                  {currencyOrder.filter(c => (myShareByCurrency[c] ?? 0) > 0).map(c => {
                    const ci = CURRENCIES.find(x => x.code === c) ?? { symbol: c, code: c, flag: "" }
                    return (
                      <View key={c} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ color: C.textMuted, fontSize: 11 }}>{ci.flag} {c}</Text>
                        <Text style={{ color: C.accentText, fontSize: 11, fontWeight: "600" }}>{formatCurrency(myShareByCurrency[c], ci.symbol, ci.code)}</Text>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          </View>

          {/* Charts — only render once all rates are loaded to avoid segAnims ref length mismatch */}
          {!ratesLoaded ? (
            <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 32, alignItems: "center" }}>
              <ActivityIndicator color="#6366f1" />
              <Text style={{ color: C.textSub, fontSize: 13, marginTop: 8 }}>Loading exchange rates…</Text>
            </View>
          ) : (
            <>
              {/* Pie chart */}
              {pieData.length > 0 && (
                <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 20, alignItems: "center" }}>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 15, marginBottom: 20 }}>Expense Distribution</Text>
                  <AnimatedPieChart key={pieData.length} data={pieData} size={240} symbol={gc.symbol} code={gc.code} />
                  {/* Legend */}
                  <View style={{ width: "100%", marginTop: 20, gap: 10 }}>
                    {pieData.map((d, i) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: d.color }} />
                        <Text style={{ flex: 1, color: C.textSub, fontSize: 13 }}>{d.name}</Text>
                        <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{formatCurrency(d.amount, gc.symbol, gc.code)}</Text>
                        <Text style={{ color: C.textMuted, fontSize: 12, width: 42, textAlign: "right" }}>
                          {totalGroupExpense > 0 ? `${((d.amount / totalGroupExpense) * 100).toFixed(1)}%` : "0%"}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Who Paid Bar Chart */}
              {(() => {
                const paidMap: Record<string, number> = {}
                for (const m of members) paidMap[m.userId] = 0
                for (const e of expenses) {
                  const expCur = e.currency ?? gc.code
                  const rate = expCur === gc.code ? 1 : (fxRates[expCur] ?? null)
                  if (rate === null) continue
                  if (paidMap[e.paidById] !== undefined) paidMap[e.paidById] += e.amount * rate
                }
                const barData = members
                  .map((m: any, i: number) => ({
                    name: m.userId === userId ? "You" : (m.user?.name?.split(" ")[0] ?? "?"),
                    amount: paidMap[m.userId] ?? 0,
                    color: PIE_COLORS[i % PIE_COLORS.length],
                    userId: m.userId,
                  }))
                  .filter(d => d.amount > 0)
                  .sort((a, b) => b.amount - a.amount)

                if (barData.length === 0) return null
                return <BarChart data={barData} maxAmt={barData[0].amount} barHeight={140} symbol={gc.symbol} code={gc.code} />
              })()}
            </>
          )}
        </View>
      )
})

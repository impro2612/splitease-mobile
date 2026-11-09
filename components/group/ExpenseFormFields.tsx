import { useState } from "react"
import { View, ScrollView, TouchableOpacity, FlatList } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Text, TextInput } from "@/components/ui/Typography"
import { InAppFullScreenModal } from "@/components/ui/InAppModal"
import { Avatar } from "@/components/ui/Avatar"
import { ExpenseIcon } from "@/components/ExpenseIcon"
import { getExpenseIcon } from "@/lib/expense-icons"
import { formatDate, guessCategory, parseAmountInput } from "@/lib/utils"
import { CURRENCIES, NO_DECIMAL_CURRENCIES } from "@/lib/currencies"
import { tokens, useTheme } from "@/lib/theme"
import { openDatePicker } from "./date-picker"
// ── Module-level component — must live OUTSIDE GroupDetail so React sees a
// stable component identity on every render. If defined inside the parent,
// every setState call creates a new function reference, React unmounts/remounts
// the component, and the TextInput loses focus (keyboard dismissed after each letter).
export function ExpenseFormFields({
  desc, setDesc, amount, setAmount, currency, setCurrency, category, setCategory,
  paidBy, setPaidBy, date, setDate,
  members, gc, user,
  splitType, setSplitType,
  equallyIncluded, setEquallyIncluded,
  percentageSplits, setPercentageSplits,
  customSplits, setCustomSplits,
}: any) {
  const C = useTheme()
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")
  const detectedCategory = guessCategory(desc)
  const categoryIcon = getExpenseIcon(desc)
  const activeCurrencyCode = currency || gc.code
  const activeCurrencyInfo = CURRENCIES.find(c => c.code === activeCurrencyCode) ?? gc

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled={true}>
      {/* Amount first — big and centred, currency as a small chip above it */}
      <View style={{ alignItems: "center", paddingTop: 6, paddingBottom: 18 }}>
        <TouchableOpacity
          onPress={() => setShowCurrencyPicker(true)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: activeCurrencyCode !== gc.code ? tokens.accentSoft : C.iconBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 }}
          accessibilityLabel="Change currency"
        >
          <Text style={{ fontSize: 14 }}>{(activeCurrencyInfo as any).flag ?? ""}</Text>
          <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "700" }}>{activeCurrencyCode}</Text>
          <Ionicons name="chevron-down" size={12} color={C.textMuted} />
        </TouchableOpacity>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: amount ? C.text : C.textMuted, fontSize: 40, fontWeight: "800", marginRight: 2 }}>{activeCurrencyInfo.symbol}</Text>
          <TextInput
            style={{ color: C.text, fontSize: 44, fontWeight: "800", minWidth: 60, textAlign: "center", fontVariant: ["tabular-nums"], paddingVertical: 0 }}
            placeholder="0"
            placeholderTextColor={C.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount"
          />
        </View>
      </View>

      {/* Description */}
      <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>What was it for?</Text>
      <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: tokens.radius.md, paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: desc.trim() ? 8 : 16, flexDirection: "row", alignItems: "center" }}>
        <TextInput
          style={{ color: C.text, fontSize: 15, flex: 1 }}
          placeholder="e.g. Dinner, cab, hotel"
          placeholderTextColor={C.textMuted}
          value={desc}
          onChangeText={(t) => { setDesc(t); setCategory(guessCategory(t)) }}
        />
      </View>
      {desc.trim() ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <Ionicons name={categoryIcon.icon} size={15} color={categoryIcon.color} />
          <Text style={{ color: C.textMuted, fontSize: 12, textTransform: "capitalize" }}>{detectedCategory}</Text>
        </View>
      ) : null}

      {/* Currency picker modal (inline within form fields component) */}
      <InAppFullScreenModal visible={showCurrencyPicker} onRequestClose={() => { setShowCurrencyPicker(false); setCurrencySearch("") }}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Expense Currency</Text>
            <TouchableOpacity onPress={() => { setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
            <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
            <TextInput style={{ color: C.text, flex: 1, fontSize: 15 }} placeholder="Search currency..." placeholderTextColor={C.textMuted} value={currencySearch} onChangeText={setCurrencySearch} autoCapitalize="none" />
            {currencySearch.length > 0 && <TouchableOpacity onPress={() => setCurrencySearch("")}><Ionicons name="close-circle" size={16} color={C.textMuted} /></TouchableOpacity>}
          </View>
          {/* Default currency first */}
          {!currencySearch && (
            <View style={{ marginHorizontal: 20, marginBottom: 8 }}>
              <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>GROUP DEFAULT</Text>
              <TouchableOpacity
                onPress={() => { setCurrency(gc.code); setShowCurrencyPicker(false); setCurrencySearch("") }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}
              >
                <Text style={{ fontSize: 24 }}>{gc.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600" }}>{gc.code}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>{gc.name}</Text>
                </View>
                {activeCurrencyCode === gc.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={CURRENCIES.filter(c =>
              (currencySearch ? c.code.toLowerCase().includes(currencySearch.toLowerCase()) || c.name.toLowerCase().includes(currencySearch.toLowerCase()) : c.code !== gc.code)
            )}
            keyExtractor={item => item.code}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={!currencySearch ? <Text style={{ color: C.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>OTHER CURRENCIES</Text> : null}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setCurrency(item.code); setShowCurrencyPicker(false); setCurrencySearch("") }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}
              >
                <Text style={{ fontSize: 24 }}>{item.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: "600" }}>{item.code}</Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>{item.name}</Text>
                </View>
                {activeCurrencyCode === item.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </InAppFullScreenModal>

      {/* Date */}
      <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Date</Text>
      <TouchableOpacity
        onPress={() => openDatePicker(date, setDate)}
        style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}
      >
        <Ionicons name="calendar-outline" size={18} color={C.textSub} />
        <Text style={{ color: C.text, fontSize: 15 }}>{formatDate(date)}</Text>
      </TouchableOpacity>

      {/* Paid by */}
      <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>Paid by</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {members.map((m: any) => (
          <TouchableOpacity
            key={m.userId}
            onPress={() => setPaidBy(m.userId)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: paidBy === m.userId ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)", borderRadius: 12, borderWidth: paidBy === m.userId ? 2 : 1, borderColor: paidBy === m.userId ? "#6366f1" : C.border, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}
          >
            <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={24} />
            <Text style={{ color: paidBy === m.userId ? "#fff" : C.textSub, fontWeight: "600", fontSize: 13 }}>
              {m.userId === user?.id ? "You" : m.user?.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Split section ── */}
      {(() => {
        const numAmount = parseAmountInput(amount) || 0
        const disabled = numAmount <= 0
        const memberIds = members.map((m: any) => m.userId)
        const included = equallyIncluded.length > 0 ? equallyIncluded : memberIds

        const pctTotal = memberIds.reduce((s: number, uid: string) => s + (parseAmountInput(percentageSplits[uid] || "0")), 0)
        const customTotal = memberIds.reduce((s: number, uid: string) => s + (parseAmountInput(customSplits[uid] || "0")), 0)
        const pctError = splitType === "PERCENTAGE" && numAmount > 0 && Math.abs(pctTotal - 100) > 0.01 ? `${pctTotal.toFixed(1)}% of 100%` : null
        const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrencyCode)
        const fmt = (n: number) => isNoDec ? Math.round(n).toString() : n.toFixed(2)
        const customError = splitType === "CUSTOM" && numAmount > 0 && Math.abs(customTotal - numAmount) > (isNoDec ? 0.5 : 0.01) ? `Total ${activeCurrencyInfo.symbol}${fmt(customTotal)} must equal ${activeCurrencyInfo.symbol}${fmt(numAmount)}` : null

        return (
          <View style={{ marginTop: 4, marginBottom: 8 }}>
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              Split{disabled ? <Text style={{ color: C.textMuted, fontWeight: "500" }}>  ·  enter an amount first</Text> : null}
            </Text>

            {/* Tab row */}
            <View style={{ flexDirection: "row", backgroundColor: C.iconBg, borderRadius: 12, padding: 3, marginBottom: 14 }}>
              {(["EQUAL", "PERCENTAGE", "CUSTOM"] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  disabled={disabled}
                  onPress={() => { if (!disabled) setSplitType(st) }}
                  style={{ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center", backgroundColor: splitType === st ? "#6366f1" : "transparent" }}
                >
                  <Text style={{ color: splitType === st ? "#fff" : "#64748b", fontSize: 12, fontWeight: "600" }}>
                    {st === "EQUAL" ? "Equally" : st === "PERCENTAGE" ? "%" : "Custom"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Equally */}
            {splitType === "EQUAL" && (
              <View style={{ gap: 8 }}>
                {members.map((m: any) => {
                  const isIncluded = included.includes(m.userId)
                  const isNoDec = NO_DECIMAL_CURRENCIES.has(activeCurrencyCode)
                  const rawPerPerson = included.length > 0 ? numAmount / included.length : 0
                  const perPerson = isNoDec ? Math.round(rawPerPerson) : rawPerPerson
                  return (
                    <TouchableOpacity
                      key={m.userId}
                      disabled={disabled}
                      onPress={() => {
                        if (disabled) return
                        const current = equallyIncluded.length > 0 ? equallyIncluded : memberIds
                        if (isIncluded && current.length === 1) return
                        setEquallyIncluded(isIncluded ? current.filter((id: string) => id !== m.userId) : [...current, m.userId])
                      }}
                      style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: isIncluded ? "rgba(99,102,241,0.3)" : C.border }}
                    >
                      <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={32} />
                      <Text style={{ flex: 1, color: C.text, fontWeight: "600", fontSize: 13, marginLeft: 10 }}>
                        {m.userId === user?.id ? "You" : m.user?.name}
                      </Text>
                      {isIncluded && numAmount > 0 && (
                        <Text style={{ color: C.textSub, fontSize: 12, marginRight: 10 }}>
                          {activeCurrencyInfo.symbol}{perPerson.toFixed(2)}
                        </Text>
                      )}
                      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: isIncluded ? "#6366f1" : "#334155", backgroundColor: isIncluded ? "#6366f1" : "transparent", alignItems: "center", justifyContent: "center" }}>
                        {isIncluded && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Percentage */}
            {splitType === "PERCENTAGE" && (
              <View style={{ gap: 8 }}>
                {members.map((m: any) => {
                  const pct = percentageSplits[m.userId] ?? ""
                  const pctNum = parseAmountInput(pct) || 0
                  const perPerson = (pctNum / 100) * numAmount
                  return (
                    <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", height: 52, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
                      <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={32} />
                      <Text style={{ flex: 1, color: C.text, fontWeight: "600", fontSize: 13, marginLeft: 10 }} numberOfLines={1}>
                        {m.userId === user?.id ? "You" : m.user?.name}
                      </Text>
                      {numAmount > 0 && pctNum > 0 && (
                        <Text style={{ color: C.textMuted, fontSize: 11, marginRight: 6 }}>{activeCurrencyInfo.symbol}{perPerson.toFixed(2)}</Text>
                      )}
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.iconBg, borderRadius: 8, paddingHorizontal: 6, height: 32, width: 64 }}>
                        <TextInput
                          style={{ flex: 1, color: C.text, fontSize: 13, fontWeight: "600", textAlign: "right", padding: 0, height: 32 }}
                          placeholder="0"
                          placeholderTextColor={C.textMuted}
                          value={pct}
                          onChangeText={(v) => setPercentageSplits({ ...percentageSplits, [m.userId]: v.replace(/[^0-9.]/g, "") })}
                          keyboardType="decimal-pad"
                          editable={!disabled}
                        />
                        <Text style={{ color: C.textMuted, fontSize: 12, marginLeft: 2 }}>%</Text>
                      </View>
                    </View>
                  )
                })}
                {pctError && <Text style={{ color: C.negative, fontSize: 12, marginTop: 4 }}>⚠ {pctError} used</Text>}
                {!pctError && numAmount > 0 && <Text style={{ color: C.positive, fontSize: 12, marginTop: 4 }}>✓ Splits to 100%</Text>}
              </View>
            )}

            {/* Custom */}
            {splitType === "CUSTOM" && (
              <View style={{ gap: 8 }}>
                {members.map((m: any) => {
                  const val = customSplits[m.userId] ?? ""
                  return (
                    <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", height: 52, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
                      <Avatar name={m.user?.name} email={m.user?.email} image={m.user?.image} size={32} />
                      <Text style={{ flex: 1, color: C.text, fontWeight: "600", fontSize: 13, marginLeft: 10 }} numberOfLines={1}>
                        {m.userId === user?.id ? "You" : m.user?.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.iconBg, borderRadius: 8, paddingHorizontal: 6, height: 32, width: 80 }}>
                        <Text style={{ color: C.textMuted, fontSize: 12, marginRight: 2 }}>{gc.symbol}</Text>
                        <TextInput
                          style={{ flex: 1, color: C.text, fontSize: 13, fontWeight: "600", padding: 0, height: 32 }}
                          placeholder="0.00"
                          placeholderTextColor={C.textMuted}
                          value={val}
                          onChangeText={(v) => setCustomSplits({ ...customSplits, [m.userId]: v.replace(/[^0-9.]/g, "") })}
                          keyboardType="decimal-pad"
                          editable={!disabled}
                        />
                      </View>
                    </View>
                  )
                })}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Text style={{ color: customError ? C.negative : "#64748b", fontSize: 12 }}>
                    {customError ? `⚠ ${customError}` : `Total: ${gc.symbol}${customTotal.toFixed(2)}`}
                  </Text>
                  <Text style={{ color: C.textMuted, fontSize: 12 }}>of {gc.symbol}{numAmount.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </View>
        )
      })()}

    </ScrollView>
  )
}

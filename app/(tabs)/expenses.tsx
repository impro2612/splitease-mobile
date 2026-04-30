import { useState, useCallback } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, FlatList, useWindowDimensions, RefreshControl,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { PieChart, BarChart } from "react-native-gifted-charts"
import * as DocumentPicker from "expo-document-picker"
import * as Linking from "expo-linking"
import { useTheme } from "@/lib/theme"
import { gmailApi, transactionsApi, budgetsApi, API_BASE_URL } from "@/lib/api"
import * as SecureStore from "expo-secure-store"
import Toast from "react-native-toast-message"
import { CATEGORIES } from "@/lib/categorize-client"

const CATEGORY_ICONS: Record<string, string> = {
  "Salary / Income":  "💰",
  "Food / Dining":    "🍕",
  "Rent / Housing":   "🏠",
  "Transport":        "🚕",
  "Shopping":         "🛒",
  "Subscriptions":    "📺",
  "Transfers":        "↔️",
  "Bills / Utilities":"💡",
  "EMI / Loans":      "🏦",
  "Miscellaneous":    "📦",
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food / Dining":    "#f97316",
  "Shopping":         "#8b5cf6",
  "Transport":        "#3b82f6",
  "Bills / Utilities":"#f59e0b",
  "Subscriptions":    "#ec4899",
  "Rent / Housing":   "#10b981",
  "EMI / Loans":      "#ef4444",
  "Transfers":        "#6b7280",
  "Salary / Income":  "#22c55e",
  "Miscellaneous":    "#94a3b8",
}

function formatINR(amount: number) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000)   return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toFixed(0)}`
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-")
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-IN", { month: "short", year: "2-digit" })
}

export default function Expenses() {
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const queryClient = useQueryClient()

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  )
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "insights" | "budgets">("overview")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetCategory, setBudgetCategory] = useState(CATEGORIES[1])
  const [budgetAmount, setBudgetAmount] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  // Queries
  const { data: gmailStatus } = useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => gmailApi.status().then((r) => r.data),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["tx-summary", selectedMonth],
    queryFn: () => transactionsApi.summary(selectedMonth).then((r) => r.data),
  })

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["transactions", selectedMonth, selectedCategory],
    queryFn: () => transactionsApi.list({
      month: selectedMonth,
      category: selectedCategory ?? undefined,
    }).then((r) => r.data),
  })

  const { data: insights } = useQuery({
    queryKey: ["tx-insights", selectedMonth],
    queryFn: () => transactionsApi.insights(selectedMonth).then((r) => r.data),
    enabled: activeTab === "insights",
  })

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => budgetsApi.list().then((r) => r.data),
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ["tx-summary"] })
    await queryClient.invalidateQueries({ queryKey: ["transactions"] })
    setRefreshing(false)
  }, [queryClient])

  // Gmail connect
  async function connectGmail() {
    const token = await SecureStore.getItemAsync("session_token")
    const url = `${API_BASE_URL}/api/gmail/auth?token=${token}`
    await Linking.openURL(url)
  }

  // CSV import
  const importMutation = useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               "application/vnd.ms-excel", "text/comma-separated-values"],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return null
      const file = result.assets[0]
      return transactionsApi.importCSV({ uri: file.uri, name: file.name, mimeType: file.mimeType ?? "text/csv" })
        .then((r) => r.data)
    },
    onSuccess: (data) => {
      if (!data) return
      queryClient.invalidateQueries({ queryKey: ["tx-summary"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      Toast.show({ type: "success", text1: `Imported ${data.imported} transactions`, text2: data.bank ? `from ${data.bank}` : undefined })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Import failed"
      Toast.show({ type: "error", text1: msg })
    },
  })

  const setBudgetMutation = useMutation({
    mutationFn: () => budgetsApi.set(budgetCategory, parseFloat(budgetAmount)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] })
      setShowBudgetModal(false)
      setBudgetAmount("")
      Toast.show({ type: "success", text1: "Budget saved" })
    },
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["tx-summary"] })
    },
  })

  const syncNowMutation = useMutation({
    mutationFn: () => gmailApi.syncNow(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["tx-summary"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: ["gmail-status"] })
      const { imported } = res.data
      Toast.show({ type: "success", text1: imported > 0 ? `Synced ${imported} transactions` : "No new transactions found" })
    },
    onError: () => Toast.show({ type: "error", text1: "Sync failed. Please try again." }),
  })

  // Month navigation
  function changeMonth(delta: number) {
    const [y, m] = selectedMonth.split("-").map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    setSelectedCategory(null)
  }

  // Pie chart data
  const pieData = (summary?.categoryBreakdown ?? [])
    .filter((c: { amount: number }) => c.amount > 0)
    .slice(0, 6)
    .map((c: { category: string; amount: number }) => ({
      value: c.amount,
      color: CATEGORY_COLORS[c.category] ?? "#94a3b8",
      label: c.category.split(" / ")[0],
      focused: selectedCategory === c.category,
    }))

  // Bar chart data
  const barData = (summary?.monthlyTrend ?? []).map((t: { month: string; expense: number }) => ({
    value: t.expense,
    label: monthLabel(t.month),
    frontColor: t.month === selectedMonth ? "#6366f1" : "#374151",
  }))

  const transactions = txData?.transactions ?? []
  const grouped = transactions.reduce((acc: Record<string, typeof transactions>, t: { date: string; [key: string]: unknown }) => {
    const day = new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })
    if (!acc[day]) acc[day] = []
    acc[day].push(t)
    return acc
  }, {})

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header + Month Selector */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: C.text, fontSize: 22, fontWeight: "700" }}>Expenses</Text>
            {gmailStatus?.connected && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ade80" }} />
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {!gmailStatus?.connected && (
              <TouchableOpacity onPress={connectGmail} style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="mail" size={14} color="#6366f1" />
                <Text style={{ color: "#6366f1", fontSize: 12, fontWeight: "600" }}>Connect Gmail</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => importMutation.mutate()} style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
              {importMutation.isPending
                ? <ActivityIndicator size="small" color="#6366f1" />
                : <Ionicons name="cloud-upload-outline" size={14} color="#6366f1" />}
              <Text style={{ color: "#6366f1", fontSize: 12, fontWeight: "600" }}>Import</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Month nav */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 15, minWidth: 110, textAlign: "center" }}>
            {new Date(parseInt(selectedMonth.split("-")[0]), parseInt(selectedMonth.split("-")[1]) - 1)
              .toLocaleString("en-IN", { month: "long", year: "numeric" })}
          </Text>
          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={20} color={C.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 4, marginBottom: 8 }}>
        {(["overview", "transactions", "insights", "budgets"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{ flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center",
              backgroundColor: activeTab === tab ? "#6366f1" : C.card,
              borderWidth: 1, borderColor: activeTab === tab ? "#6366f1" : C.border }}
          >
            <Text style={{ color: activeTab === tab ? "#fff" : C.textSub, fontSize: 11, fontWeight: "600", textTransform: "capitalize" }}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {summaryLoading ? (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
        ) : !summary || summary.transactionCount === 0 ? (
          <EmptyState
            onConnectGmail={connectGmail}
            onImport={() => importMutation.mutate()}
            onSyncNow={() => syncNowMutation.mutate()}
            syncing={syncNowMutation.isPending}
            gmailConnected={!!gmailStatus?.connected}
            C={C}
          />
        ) : (
          <>
            {activeTab === "overview" && (
              <OverviewTab
                summary={summary} pieData={pieData} barData={barData}
                selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
                width={width} C={C}
              />
            )}
            {activeTab === "transactions" && (
              <TransactionsTab
                grouped={grouped} txLoading={txLoading}
                categories={CATEGORIES} selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                onDelete={(id: string) => Alert.alert("Delete", "Remove this transaction?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => deleteCategoryMutation.mutate(id) },
                ])}
                C={C}
              />
            )}
            {activeTab === "insights" && (
              <InsightsTab insights={insights} C={C} />
            )}
            {activeTab === "budgets" && (
              <BudgetsTab
                budgets={budgets} summary={summary}
                onAdd={() => setShowBudgetModal(true)} C={C}
              />
            )}
          </>
        )}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

      {/* Budget modal */}
      <Modal visible={showBudgetModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBudgetModal(false)}>
        <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: insets.top + 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: "700" }}>Set Budget</Text>
            <TouchableOpacity onPress={() => setShowBudgetModal(false)}>
              <Ionicons name="close" size={22} color={C.text} />
            </TouchableOpacity>
          </View>

          <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 8 }}>Category</Text>
          <FlatList
            data={CATEGORIES.filter((c) => c !== "Salary / Income" && c !== "Transfers")}
            numColumns={2}
            style={{ maxHeight: 200, marginBottom: 16 }}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setBudgetCategory(item)}
                style={{ flex: 1, margin: 4, padding: 10, borderRadius: 12, backgroundColor: budgetCategory === item ? "#6366f1" : C.card, borderWidth: 1, borderColor: budgetCategory === item ? "#6366f1" : C.border, flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={{ fontSize: 14 }}>{CATEGORY_ICONS[item]}</Text>
                <Text style={{ color: budgetCategory === item ? "#fff" : C.text, fontSize: 11, fontWeight: "600", flex: 1 }} numberOfLines={1}>{item}</Text>
              </TouchableOpacity>
            )}
          />

          <Text style={{ color: C.textSub, fontSize: 13, marginBottom: 8 }}>Monthly Limit (₹)</Text>
          <View style={{ backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 24 }}>
            <TextInput
              style={{ color: C.text, fontSize: 18, fontWeight: "600" }}
              placeholder="e.g. 8000"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              value={budgetAmount}
              onChangeText={setBudgetAmount}
            />
          </View>

          <TouchableOpacity
            onPress={() => setBudgetMutation.mutate()}
            disabled={!budgetAmount || setBudgetMutation.isPending}
            style={{ backgroundColor: !budgetAmount ? "#374151" : "#6366f1", borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" }}
          >
            {setBudgetMutation.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save Budget</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ onConnectGmail, onImport, onSyncNow, syncing, gmailConnected, C }: {
  onConnectGmail: () => void; onImport: () => void; onSyncNow: () => void
  syncing: boolean; gmailConnected: boolean; C: ReturnType<typeof useTheme>
}) {
  if (gmailConnected) {
    return (
      <View style={{ alignItems: "center", padding: 40 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(34,197,94,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Ionicons name="mail" size={36} color="#4ade80" />
        </View>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Gmail Connected</Text>
        <Text style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 32 }}>
          No transactions found for this month. Tap sync to fetch your bank emails now, or upload a CSV statement.
        </Text>
        <TouchableOpacity
          onPress={onSyncNow}
          disabled={syncing}
          style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12, width: "100%", opacity: syncing ? 0.7 : 1 }}
        >
          {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sync" size={18} color="#fff" />}
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{syncing ? "Syncing..." : "Sync Gmail Now"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onImport} style={{ backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.border, width: "100%" }}>
          <Ionicons name="cloud-upload-outline" size={18} color={C.text} />
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>Upload CSV / Excel</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={{ alignItems: "center", padding: 40 }}>
      <Text style={{ fontSize: 60, marginBottom: 16 }}>📊</Text>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Track your spending</Text>
      <Text style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 32 }}>Connect Gmail for automatic transaction import, or upload a bank statement CSV.</Text>
      <TouchableOpacity onPress={onConnectGmail} style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, width: "100%" }}>
        <Ionicons name="mail" size={18} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Connect Gmail (Automatic)</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onImport} style={{ backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: C.border, width: "100%" }}>
        <Ionicons name="cloud-upload-outline" size={18} color={C.text} />
        <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>Upload CSV / Excel</Text>
      </TouchableOpacity>
    </View>
  )
}

function OverviewTab({ summary, pieData, barData, selectedCategory, setSelectedCategory, width, C }: {
  summary: { totalIncome: number; totalExpense: number; netSavings: number; categoryBreakdown: { category: string; amount: number }[] };
  pieData: { value: number; color: string; label: string; focused: boolean }[];
  barData: { value: number; label: string; frontColor: string }[];
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  width: number;
  C: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Summary cards */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Income", amount: summary.totalIncome, color: "#4ade80" },
          { label: "Spent",  amount: summary.totalExpense, color: "#f87171" },
          { label: "Saved",  amount: summary.netSavings,   color: summary.netSavings >= 0 ? "#6366f1" : "#f87171" },
        ].map((s) => (
          <View key={s.label} style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.textSub, fontSize: 11, marginBottom: 4 }}>{s.label}</Text>
            <Text style={{ color: s.color, fontWeight: "700", fontSize: 15 }}>{formatINR(s.amount)}</Text>
          </View>
        ))}
      </View>

      {/* Pie chart */}
      {pieData.length > 0 && (
        <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 14, marginBottom: 16 }}>Spending Breakdown</Text>
          <View style={{ alignItems: "center" }}>
            <PieChart
              data={pieData}
              donut
              radius={90}
              innerRadius={55}
              innerCircleColor={C.card}
              centerLabelComponent={() => (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 16 }}>{formatINR(summary.totalExpense)}</Text>
                  <Text style={{ color: C.textSub, fontSize: 10 }}>total</Text>
                </View>
              )}
              onPress={(item: { label: string }) => setSelectedCategory(selectedCategory === item.label?.split("/")[0]?.trim() ? null : item.label)}
              focusOnPress
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {pieData.map((d) => (
              <TouchableOpacity key={d.label} onPress={() => setSelectedCategory(selectedCategory === d.label ? null : d.label)} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
                <Text style={{ color: C.textSub, fontSize: 11 }}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Bar chart */}
      {barData.length > 0 && (
        <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 14, marginBottom: 16 }}>6-Month Trend</Text>
          <BarChart
            data={barData}
            barWidth={28}
            spacing={12}
            roundedTop
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{ color: C.textMuted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: C.textMuted, fontSize: 9 }}
            noOfSections={3}
            maxValue={Math.max(...barData.map((d: { value: number }) => d.value)) * 1.2}
            isAnimated
            animationDuration={600}
            width={width - 100}
            yAxisLabelFormatter={(v: number) => formatINR(v)}
          />
        </View>
      )}

      {/* Category list */}
      <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
        <Text style={{ color: C.text, fontWeight: "600", fontSize: 14, marginBottom: 12 }}>By Category</Text>
        {summary.categoryBreakdown.filter((c: { amount: number }) => c.amount > 0).map((c: { category: string; amount: number }) => {
          const pct = summary.totalExpense > 0 ? (c.amount / summary.totalExpense) * 100 : 0
          return (
            <TouchableOpacity key={c.category} onPress={() => setSelectedCategory(selectedCategory === c.category ? null : c.category)} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>{CATEGORY_ICONS[c.category]}</Text>
                <Text style={{ color: C.text, flex: 1, fontSize: 13 }}>{c.category}</Text>
                <Text style={{ color: C.text, fontWeight: "700", fontSize: 13 }}>{formatINR(c.amount)}</Text>
              </View>
              <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2 }}>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: CATEGORY_COLORS[c.category] ?? "#6366f1", width: `${pct}%` }} />
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function TransactionsTab({ grouped, txLoading, categories, selectedCategory, setSelectedCategory, onDelete, C }: {
  grouped: Record<string, { id: string; date: string; description: string; amount: number; type: string; category: string; bank?: string }[]>;
  txLoading: boolean;
  categories: readonly string[];
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  onDelete: (id: string) => void;
  C: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Category filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setSelectedCategory(null)} style={{ backgroundColor: !selectedCategory ? "#6366f1" : C.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 6, borderWidth: 1, borderColor: !selectedCategory ? "#6366f1" : C.border }}>
          <Text style={{ color: !selectedCategory ? "#fff" : C.textSub, fontSize: 12, fontWeight: "600" }}>All</Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity key={cat} onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)} style={{ backgroundColor: selectedCategory === cat ? "#6366f1" : C.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6, borderWidth: 1, borderColor: selectedCategory === cat ? "#6366f1" : C.border, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 12 }}>{CATEGORY_ICONS[cat]}</Text>
            <Text style={{ color: selectedCategory === cat ? "#fff" : C.textSub, fontSize: 11, fontWeight: "600" }}>{cat.split(" / ")[0]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {txLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 20 }} />
      ) : Object.keys(grouped).length === 0 ? (
        <Text style={{ color: C.textSub, textAlign: "center", marginTop: 40 }}>No transactions</Text>
      ) : (
        Object.entries(grouped).map(([day, txns]) => (
          <View key={day} style={{ marginBottom: 16 }}>
            <Text style={{ color: C.textSub, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>{day}</Text>
            <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
              {txns.map((t, i) => (
                <TouchableOpacity
                  key={t.id}
                  onLongPress={() => onDelete(t.id)}
                  style={{ flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: i < txns.length - 1 ? 1 : 0, borderBottomColor: C.border }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: (CATEGORY_COLORS[t.category] ?? "#6366f1") + "22", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                    <Text style={{ fontSize: 18 }}>{CATEGORY_ICONS[t.category] ?? "📦"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>{t.description}</Text>
                    <Text style={{ color: C.textSub, fontSize: 11, marginTop: 2 }}>{t.category}{t.bank ? ` · ${t.bank}` : ""}</Text>
                  </View>
                  <Text style={{ color: t.type === "credit" ? "#4ade80" : "#f87171", fontWeight: "700", fontSize: 14 }}>
                    {t.type === "credit" ? "+" : "-"}₹{t.amount.toFixed(0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  )
}

function InsightsTab({ insights, C }: {
  insights?: {
    aiSummary: string;
    topCategories: { category: string; amount: number; changePercent: number | null }[];
    spendingLeaks: { description: string; count: number; total: number }[];
    budgetAlerts: { category: string; budget: number; spent: number; overspent: number }[];
    highSpendDays: { day: string; amount: number }[];
  };
  C: ReturnType<typeof useTheme>;
}) {
  if (!insights) return <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />

  return (
    <View style={{ paddingHorizontal: 20, gap: 16 }}>
      {/* AI summary */}
      {insights.aiSummary ? (
        <View style={{ backgroundColor: "rgba(99,102,241,0.1)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 18 }}>✨</Text>
            <Text style={{ color: "#a5b4fc", fontWeight: "700", fontSize: 13 }}>AI Summary</Text>
          </View>
          <Text style={{ color: C.text, fontSize: 13, lineHeight: 20 }}>{insights.aiSummary}</Text>
        </View>
      ) : null}

      {/* Top categories */}
      {insights.topCategories.length > 0 && (
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, marginBottom: 12 }}>🏆 Top Spending</Text>
          {insights.topCategories.map((c, i) => (
            <View key={c.category} style={{ flexDirection: "row", alignItems: "center", marginBottom: i < insights.topCategories.length - 1 ? 12 : 0 }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>{CATEGORY_ICONS[c.category]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }}>{c.category}</Text>
                {c.changePercent !== null && (
                  <Text style={{ color: c.changePercent > 0 ? "#f87171" : "#4ade80", fontSize: 11 }}>
                    {c.changePercent > 0 ? "▲" : "▼"} {Math.abs(c.changePercent)}% vs last month
                  </Text>
                )}
              </View>
              <Text style={{ color: C.text, fontWeight: "700" }}>₹{c.amount.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Spending leaks */}
      {insights.spendingLeaks.length > 0 && (
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, marginBottom: 12 }}>🔍 Spending Leaks</Text>
          <Text style={{ color: C.textSub, fontSize: 12, marginBottom: 10 }}>Small frequent transactions adding up</Text>
          {insights.spendingLeaks.map((l) => (
            <View key={l.description} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: C.text, flex: 1, fontSize: 13 }}>{l.description}</Text>
              <Text style={{ color: C.textSub, fontSize: 11, marginRight: 8 }}>×{l.count}</Text>
              <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 13 }}>₹{l.total.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Budget alerts */}
      {insights.budgetAlerts.length > 0 && (
        <View style={{ backgroundColor: "rgba(248,113,113,0.1)", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(248,113,113,0.3)" }}>
          <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 14, marginBottom: 12 }}>⚠️ Over Budget</Text>
          {insights.budgetAlerts.map((a) => (
            <View key={a.category} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }}>{CATEGORY_ICONS[a.category]} {a.category}</Text>
                <Text style={{ color: "#f87171", fontWeight: "700", fontSize: 13 }}>+₹{a.overspent.toFixed(0)} over</Text>
              </View>
              <Text style={{ color: C.textSub, fontSize: 11 }}>Spent ₹{a.spent.toFixed(0)} · Budget ₹{a.budget.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* High spend days */}
      {insights.highSpendDays.length > 0 && (
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontWeight: "700", fontSize: 14, marginBottom: 12 }}>📅 High Spend Days</Text>
          {insights.highSpendDays.map((d) => (
            <View key={d.day} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: C.text, fontSize: 13 }}>{new Date(d.day).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}</Text>
              <Text style={{ color: "#f87171", fontWeight: "700" }}>₹{d.amount.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function BudgetsTab({ budgets, summary, onAdd, C }: {
  budgets: { category: string; amount: number }[];
  summary: { categoryBreakdown: { category: string; amount: number }[] };
  onAdd: () => void;
  C: ReturnType<typeof useTheme>;
}) {
  const spentMap: Record<string, number> = {}
  for (const c of summary.categoryBreakdown) spentMap[c.category] = c.amount

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <TouchableOpacity onPress={onAdd} style={{ backgroundColor: "#6366f1", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Set Monthly Budget</Text>
      </TouchableOpacity>

      {budgets.length === 0 ? (
        <Text style={{ color: C.textSub, textAlign: "center", marginTop: 20 }}>No budgets set yet. Add limits for each spending category.</Text>
      ) : (
        budgets.map((b) => {
          const spent = spentMap[b.category] ?? 0
          const pct   = Math.min((spent / b.amount) * 100, 100)
          const over  = spent > b.amount
          return (
            <View key={b.category} style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: over ? "rgba(248,113,113,0.4)" : C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontSize: 20, marginRight: 8 }}>{CATEGORY_ICONS[b.category]}</Text>
                <Text style={{ color: C.text, fontWeight: "600", flex: 1 }}>{b.category}</Text>
                <Text style={{ color: over ? "#f87171" : C.text, fontWeight: "700" }}>
                  ₹{spent.toFixed(0)} / ₹{b.amount.toFixed(0)}
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: over ? "#f87171" : "#6366f1", width: `${pct}%` }} />
              </View>
              {over && <Text style={{ color: "#f87171", fontSize: 11, marginTop: 6 }}>⚠️ Over by ₹{(spent - b.amount).toFixed(0)}</Text>}
            </View>
          )
        })
      )}
    </View>
  )
}

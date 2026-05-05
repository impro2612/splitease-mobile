import { useState, useCallback, useEffect, useRef } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, FlatList, useWindowDimensions, RefreshControl,
  KeyboardAvoidingView, Platform, Animated, Keyboard,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { PieChart, BarChart } from "react-native-gifted-charts"
import * as DocumentPicker from "expo-document-picker"
import { useTheme } from "@/lib/theme"
import { transactionsApi, budgetsApi } from "@/lib/api"
import Toast from "react-native-toast-message"
import { CATEGORIES } from "@/lib/categorize-client"

const CATEGORY_ICONS: Record<string, string> = {
  "Salary / Income":  "💰",
  "Food / Dining":    "🍕",
  "Rent / Housing":   "🏠",
  "Transport":        "🚕",
  "Travel":           "✈️",
  "Shopping":         "🛒",
  "Subscriptions":    "📺",
  "UPI Payments":     "📱",
  "Transfers":        "↔️",
  "Bills / Utilities":"💡",
  "EMI / Loans":      "🏦",
  "Credit Card Payments":"💳",
  "Medical / Pharmacy":"💊",
  "Bank Charges":     "🧾",
  "Miscellaneous":    "📦",
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food / Dining":    "#f97316",
  "Shopping":         "#8b5cf6",
  "Transport":        "#3b82f6",
  "Travel":           "#06b6d4",
  "Bills / Utilities":"#f59e0b",
  "Subscriptions":    "#ec4899",
  "UPI Payments":     "#10b981",
  "Rent / Housing":   "#10b981",
  "EMI / Loans":      "#ef4444",
  "Credit Card Payments":"#0ea5e9",
  "Medical / Pharmacy":"#14b8a6",
  "Bank Charges":     "#f43f5e",
  "Transfers":        "#6b7280",
  "Salary / Income":  "#22c55e",
  "Miscellaneous":    "#94a3b8",
}

const PDF_IMPORT_QUOTES = [
  "The safest way to double your money is to fold it & forget it.😂",
  "I’m stuck between 'I need to save money' and 'you only live once.'😩",
  "My wallet is like an onion: opening it makes me cry.🥹",
  "I tried to follow a budget, but it unfollowed me back.🙃",
  "I am just one step away from being rich. All I need now is money.🤣",
  "Money talks, but mine just says goodbye.😒",
  "My money leaves faster than my motivation on Monday.😛",
  "I opened my bank app for motivation… got depression instead.😇",
  "I love saving money… I just love spending it more.🤪",
  "Salary credited: 😎 Bills deducted: 🤡",
] as const

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
  const [budgetCategory, setBudgetCategory] = useState<(typeof CATEGORIES)[number]>(CATEGORIES[1])
  const [budgetAmount, setBudgetAmount] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTrendIndex, setSelectedTrendIndex] = useState<number | null>(null)

  // PDF password modal
  const [pendingPdfFile, setPendingPdfFile] = useState<{ uri: string; name: string } | null>(null)
  const [pdfPasswordVisible, setPdfPasswordVisible] = useState(false)
  const [pdfPassword, setPdfPassword] = useState("")
  const [pdfPasswordError, setPdfPasswordError] = useState("")
  const [pdfPasswordLoading, setPdfPasswordLoading] = useState(false)
  const [pdfQuoteIndex, setPdfQuoteIndex] = useState(0)
  const quoteOpacity = useRef(new Animated.Value(1)).current
  const pdfModalTranslateY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!pdfPasswordVisible || !pdfPasswordLoading) {
      setPdfQuoteIndex(0)
      quoteOpacity.setValue(1)
      return
    }

    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(quoteOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(quoteOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start()
      setPdfQuoteIndex((prev) => (prev + 1) % PDF_IMPORT_QUOTES.length)
    }, 5000)

    return () => clearInterval(id)
  }, [pdfPasswordLoading, pdfPasswordVisible, quoteOpacity])

  useEffect(() => {
    if (Platform.OS !== "android") return
    if (!pdfPasswordVisible || pdfPasswordLoading) {
      pdfModalTranslateY.setValue(0)
      return
    }

    const showEvent = Keyboard.addListener("keyboardDidShow", (event) => {
      const lift = Math.min(240, Math.max(90, event.endCoordinates.height * 0.42))
      Animated.timing(pdfModalTranslateY, {
        toValue: -lift,
        duration: 200,
        useNativeDriver: true,
      }).start()
    })

    const hideEvent = Keyboard.addListener("keyboardDidHide", () => {
      Animated.timing(pdfModalTranslateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start()
    })

    return () => {
      showEvent.remove()
      hideEvent.remove()
      pdfModalTranslateY.setValue(0)
    }
  }, [pdfPasswordLoading, pdfPasswordVisible, pdfModalTranslateY])

  // Queries
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

  // PDF bank statement import
  async function uploadPdf(file: { uri: string; name: string }, password?: string) {
    try {
      const res = await transactionsApi.importPDF(file, selectedMonth, password)
      const data = res.data
      queryClient.invalidateQueries({ queryKey: ["tx-summary"] })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      setPdfPasswordVisible(false)
      setPendingPdfFile(null)
      setPdfPassword("")
      setPdfPasswordError("")
      Toast.show({
        type: data.imported > 0 ? "success" : "info",
        text1: data.imported > 0 ? `Imported ${data.imported} transactions` : "No new transactions found",
        text2: data.imported > 0 ? `from ${data.total} found in PDF` : "They may already be imported",
      })
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { needsPassword?: boolean; error?: string } } }
      if (axiosErr.response?.status === 422 && axiosErr.response?.data?.needsPassword) {
        setPendingPdfFile(file)
        setPdfPassword("")
        setPdfPasswordError("")
        setPdfPasswordVisible(true)
      } else {
        const msg = axiosErr.response?.data?.error ?? "Import failed. Try a different PDF."
        if (password) {
          setPdfPasswordError(msg)
        } else {
          Toast.show({ type: "error", text1: msg })
        }
      }
    }
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return
      const file = result.assets[0]
      await uploadPdf({ uri: file.uri, name: file.name })
    },
  })

  async function handlePasswordSubmit() {
    if (!pendingPdfFile || !pdfPassword) return
    setPdfQuoteIndex(0)
    setPdfPasswordLoading(true)
    await uploadPdf(pendingPdfFile, pdfPassword)
    setPdfPasswordLoading(false)
  }

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

  // Month navigation
  function changeMonth(delta: number) {
    const [y, m] = selectedMonth.split("-").map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    setSelectedCategory(null)
    setSelectedTrendIndex(null)
  }

  // Pie chart data
  const pieData = (summary?.categoryBreakdown ?? [])
    .filter((c: { amount: number }) => c.amount > 0)
    .slice(0, 6)
    .map((c: { category: string; amount: number }) => ({
      value: c.amount,
      color: CATEGORY_COLORS[c.category] ?? "#94a3b8",
      label: c.category.split(" / ")[0],
      category: c.category,
      focused: selectedCategory === c.category,
    }))

  // Bar chart data
  const barData = (summary?.monthlyTrend ?? []).map((t: { month: string; expense: number }, index: number) => ({
    value: t.expense,
    label: monthLabel(t.month),
    frontColor: t.month === selectedMonth ? "#6366f1" : "#374151",
    onPress: () => setSelectedTrendIndex((prev) => (prev === index ? null : index)),
    topLabelComponent: () =>
      selectedTrendIndex === index ? (
        <View style={{ marginBottom: 6, backgroundColor: "#111827", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{formatINR(t.expense)}</Text>
        </View>
      ) : null,
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
          <Text style={{ color: C.text, fontSize: 22, fontWeight: "700" }}>Expenses</Text>
          <TouchableOpacity onPress={() => importMutation.mutate()} disabled={importMutation.isPending} style={{ backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 5 }}>
            {importMutation.isPending
              ? <ActivityIndicator size="small" color="#6366f1" />
              : <Ionicons name="document-text-outline" size={14} color="#6366f1" />}
            <Text style={{ color: "#6366f1", fontSize: 12, fontWeight: "600" }}>
              {importMutation.isPending ? "Importing..." : "Import PDF"}
            </Text>
          </TouchableOpacity>
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
            onImport={() => importMutation.mutate()}
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
            data={CATEGORIES.filter((c) => c !== "Salary / Income")}
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

      {/* PDF Password Modal */}
      <Modal visible={pdfPasswordVisible} animationType="fade" transparent onRequestClose={() => setPdfPasswordVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 16 : 0}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.75)",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <Animated.View style={{ backgroundColor: C.card, borderRadius: 24, padding: 24, width: "100%", borderWidth: 1, borderColor: C.border, transform: [{ translateY: pdfModalTranslateY }] }}>
              {pdfPasswordLoading ? (
                <View style={{ alignItems: "center" }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(99,102,241,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <ActivityIndicator color="#6366f1" size="large" />
                  </View>
                  <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Fetching data from the PDF</Text>
                  <Text style={{ color: C.textSub, fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 20 }}>
                    Hang tight while we read your statement and sort the transactions.
                  </Text>
                  <View style={{ width: "100%", backgroundColor: C.inputBg, borderRadius: 18, borderWidth: 1, borderColor: C.border, paddingHorizontal: 18, paddingVertical: 18 }}>
                    <Text style={{ color: "#8b85b3", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", textAlign: "center", marginBottom: 8 }}>
                      Quote While We Wait
                    </Text>
                    <Animated.Text
                      style={{
                        color: "#ddd6fe",
                        fontSize: 18,
                        lineHeight: 28,
                        textAlign: "center",
                        opacity: quoteOpacity,
                        fontStyle: "italic",
                        fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: undefined }),
                      }}
                    >
                      {`"${PDF_IMPORT_QUOTES[pdfQuoteIndex]}"`}
                    </Animated.Text>
                  </View>
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Text style={{ fontSize: 22 }}>🔒</Text>
                    <Text style={{ color: C.text, fontSize: 17, fontWeight: "700" }}>PDF Password Required</Text>
                  </View>
                  <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 20, marginBottom: 20 }}>
                    This bank statement is password-protected. Enter the password (usually your DOB in DDMMYYYY or account number).
                  </Text>
                  <View style={{
                    backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1,
                    borderColor: pdfPasswordError ? "#f87171" : C.border,
                    paddingHorizontal: 16, height: 52, justifyContent: "center", marginBottom: 6,
                  }}>
                    <TextInput
                      style={{ color: C.text, fontSize: 16 }}
                      placeholder="Enter PDF password"
                      placeholderTextColor={C.textMuted}
                      secureTextEntry
                      value={pdfPassword}
                      onChangeText={(t) => { setPdfPassword(t); setPdfPasswordError("") }}
                      onSubmitEditing={handlePasswordSubmit}
                      autoFocus={Platform.OS === "ios"}
                      returnKeyType="done"
                    />
                  </View>
                  {pdfPasswordError ? (
                    <Text style={{ color: "#f87171", fontSize: 12, marginBottom: 16 }}>{pdfPasswordError}</Text>
                  ) : (
                    <View style={{ height: 16 }} />
                  )}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => { setPdfPasswordVisible(false); setPdfPassword(""); setPdfPasswordError(""); setPendingPdfFile(null) }}
                      style={{ flex: 1, backgroundColor: C.inputBg, borderRadius: 14, height: 50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border }}
                    >
                      <Text style={{ color: C.text, fontWeight: "600" }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePasswordSubmit}
                      disabled={!pdfPassword}
                      style={{ flex: 1, backgroundColor: !pdfPassword ? "#374151" : "#6366f1", borderRadius: 14, height: 50, alignItems: "center", justifyContent: "center" }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700" }}>Unlock & Import</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EmptyState({ onImport, C }: {
  onImport: () => void; C: ReturnType<typeof useTheme>
}) {
  return (
    <View style={{ alignItems: "center", padding: 40 }}>
      <Text style={{ fontSize: 60, marginBottom: 16 }}>📊</Text>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>Track your spending</Text>
      <Text style={{ color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 32 }}>
        Upload a PDF bank statement to automatically import and categorize your transactions.
      </Text>
      <TouchableOpacity onPress={onImport} style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 8, width: "100%" }}>
        <Ionicons name="document-text-outline" size={18} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Import Bank Statement (PDF)</Text>
      </TouchableOpacity>
    </View>
  )
}

function OverviewTab({ summary, pieData, barData, selectedCategory, setSelectedCategory, width, C }: {
  summary: { totalIncome: number; totalExpense: number; netSavings: number; categoryBreakdown: { category: string; amount: number }[] };
  pieData: { value: number; color: string; label: string; category: string; focused: boolean }[];
  barData: { value: number; label: string; frontColor: string; onPress?: () => void; topLabelComponent?: () => React.JSX.Element | null }[];
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
              selectedIndex={pieData.findIndex((item) => item.category === selectedCategory)}
              onPress={(item: { category?: string }) => {
                if (!item.category) return
                setSelectedCategory(selectedCategory === item.category ? null : item.category)
              }}
              focusOnPress
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {pieData.map((d) => (
              <TouchableOpacity key={d.category} onPress={() => setSelectedCategory(selectedCategory === d.category ? null : d.category)} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
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

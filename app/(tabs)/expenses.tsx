import { useState, useCallback, useEffect, useRef } from "react"
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, FlatList, useWindowDimensions, RefreshControl,
  KeyboardAvoidingView, Platform, Animated, Keyboard,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import { PieChart } from "react-native-gifted-charts"
import * as DocumentPicker from "expo-document-picker"
import { useTheme } from "@/lib/theme"
import { transactionsApi } from "@/lib/api"
import Toast from "react-native-toast-message"
import { CATEGORIES } from "@/lib/categorize-client"

const CATEGORY_ICONS: Record<string, string> = {
  "Salary / Income":  "💰",
  "Food / Dining":    "🍕",
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
  const { width, height } = useWindowDimensions()
  const queryClient = useQueryClient()

  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  )
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "insights" | "suggestions">("overview")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDirection, setSelectedDirection] = useState<"all" | "incoming" | "outgoing">("all")
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTrendIndex, setSelectedTrendIndex] = useState<number | null>(null)

  // PDF password modal
  const [pendingPdfFile, setPendingPdfFile] = useState<{ uri: string; name: string } | null>(null)
  const [pdfPasswordVisible, setPdfPasswordVisible] = useState(false)
  const [pdfPassword, setPdfPassword] = useState("")
  const [pdfPasswordError, setPdfPasswordError] = useState("")
  const [pdfPasswordLoading, setPdfPasswordLoading] = useState(false)
  const [pdfQuoteIndex, setPdfQuoteIndex] = useState(0)
  const [pdfKeyboardHeight, setPdfKeyboardHeight] = useState(0)
  const [pdfKeyboardVisible, setPdfKeyboardVisible] = useState(false)
  const [pdfModalHeight, setPdfModalHeight] = useState(0)
  const quoteOpacity = useRef(new Animated.Value(1)).current

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
    }, 10000)

    return () => clearInterval(id)
  }, [pdfPasswordLoading, pdfPasswordVisible, quoteOpacity])

  useEffect(() => {
    if (Platform.OS !== "android" || !pdfPasswordVisible) return

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setPdfKeyboardHeight(event.endCoordinates.height)
      setPdfKeyboardVisible(true)
    })
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setPdfKeyboardVisible(false)
      setPdfKeyboardHeight(0)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [pdfPasswordVisible])

  useEffect(() => {
    if (!pdfPasswordVisible) {
      setPdfKeyboardVisible(false)
      setPdfKeyboardHeight(0)
      setPdfModalHeight(0)
    }
  }, [pdfPasswordVisible])

  // Queries
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["tx-summary", selectedMonth],
    queryFn: () => transactionsApi.summary(selectedMonth).then((r) => r.data),
  })

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["transactions", selectedMonth, selectedCategory, selectedDirection],
    queryFn: () => transactionsApi.list({
      month: selectedMonth,
      category: selectedCategory ?? undefined,
      type:
        selectedDirection === "incoming"
          ? "credit"
          : selectedDirection === "outgoing"
            ? "debit"
            : undefined,
    }).then((r) => r.data),
  })

  const { data: insights } = useQuery({
    queryKey: ["tx-insights", selectedMonth],
    queryFn: () => transactionsApi.insights(selectedMonth).then((r) => r.data),
    enabled: activeTab === "insights",
  })

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["tx-suggestions", selectedMonth],
    queryFn: () => transactionsApi.suggestions(selectedMonth).then((r) => r.data.suggestion as {
      analyzedMonth: string
      title: string
      summary: string
      source?: "gemini" | "built" | null
      recommendations: string[]
      updatedAt: string
    } | null),
    enabled: activeTab === "suggestions",
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
      queryClient.invalidateQueries({ queryKey: ["tx-suggestions"] })
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
  const barData = (summary?.monthlyTrend ?? []).map((t: { month: string; income: number; expense: number }, index: number) => {
    const expense = t.expense
    return {
      value: expense,
      label: monthLabel(t.month),
      frontColor: t.month === selectedMonth ? "#6366f1" : "#374151",
      onPress: () => setSelectedTrendIndex((prev) => (prev === index ? null : index)),
    }
  })

  const transactions = txData?.transactions ?? []
  const grouped = transactions.reduce((acc: Record<string, typeof transactions>, t: { date: string; [key: string]: unknown }) => {
    const day = new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })
    if (!acc[day]) acc[day] = []
    acc[day].push(t)
    return acc
  }, {})

  const androidVisibleHeight = pdfKeyboardVisible ? Math.max(0, height - pdfKeyboardHeight) : height
  const androidCenteredTop = Math.max(insets.top + 16, (androidVisibleHeight - pdfModalHeight) / 2)
  const androidCardStyle = Platform.OS === "android" && pdfModalHeight > 0
    ? {
        position: "absolute" as const,
        left: 24,
        right: 24,
        top: androidCenteredTop,
      }
    : null

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
        {(["overview", "transactions", "insights", "suggestions"] as const).map((tab) => (
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
        {summaryLoading && activeTab !== "suggestions" ? (
          <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
        ) : (!summary || summary.transactionCount === 0) && activeTab !== "suggestions" ? (
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
                width={width} C={C} selectedTrendIndex={selectedTrendIndex}
              />
            )}
            {activeTab === "transactions" && (
              <TransactionsTab
                grouped={grouped} txLoading={txLoading}
                categories={CATEGORIES} selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                selectedDirection={selectedDirection}
                setSelectedDirection={setSelectedDirection}
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
            {activeTab === "suggestions" && (
              <SuggestionsTab C={C} suggestion={suggestions} loading={suggestionsLoading} />
            )}
          </>
        )}
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>

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
            <Animated.View
              onLayout={(event) => setPdfModalHeight(event.nativeEvent.layout.height)}
              style={{
                backgroundColor: C.card,
                borderRadius: 24,
                padding: 24,
                width: "100%",
                borderWidth: 1,
                borderColor: C.border,
                ...(androidCardStyle ?? {}),
              }}
            >
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

function OverviewTab({ summary, pieData, barData, selectedCategory, setSelectedCategory, width, C, selectedTrendIndex }: {
  summary: { month?: string; totalIncome: number; totalExpense: number; netSavings: number; categoryBreakdown: { category: string; amount: number }[] };
  pieData: { value: number; color: string; label: string; category: string; focused: boolean }[];
  barData: { value: number; label: string; frontColor: string; onPress?: () => void }[];
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  width: number;
  C: ReturnType<typeof useTheme>;
  selectedTrendIndex: number | null;
}) {
  const chartHeight = 220
  const yAxisLabelWidth = 52
  const chartContainerWidth = width - 80
  const chartWidth = Math.max(220, chartContainerWidth - yAxisLabelWidth)
  const selectedTrend = selectedTrendIndex !== null ? barData[selectedTrendIndex] : null
  const maxTrendValue = Math.max(...barData.map((d: { value: number }) => d.value), 0)
  const chartMaxValue = maxTrendValue > 0 ? maxTrendValue * 1.15 : 1
  const sectionCount = 3
  const yAxisSteps = Array.from({ length: sectionCount }, (_, index) => {
    const remaining = sectionCount - index
    return Math.round((chartMaxValue / sectionCount) * remaining)
  })
  const selectedBubbleBottom = selectedTrend
    ? Math.max(20, Math.min(chartHeight - 8, (selectedTrend.value / chartMaxValue) * chartHeight + 14))
    : 0

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Summary cards */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Income", amount: summary.totalIncome, color: "#6366f1" },
          { label: "Spent",  amount: summary.totalExpense, color: "#f87171" },
          { label: "Saved",  amount: summary.netSavings,   color: summary.netSavings >= 0 ? "#4ade80" : "#f87171" },
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

      {/* Bar chart */}
      {barData.length > 0 && (
        <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontWeight: "600", fontSize: 14, marginBottom: 16 }}>Last 6-Months Trend</Text>
          <View style={{ position: "relative", overflow: "hidden", flexDirection: "row" }}>
            <View style={{ width: yAxisLabelWidth, height: chartHeight, justifyContent: "space-between", paddingBottom: 28 }}>
              <Text style={{ color: C.textMuted, fontSize: 10, textAlign: "right" }}>{yAxisSteps[0]}</Text>
              <Text style={{ color: C.textMuted, fontSize: 10, textAlign: "right" }}>{yAxisSteps[1]}</Text>
              <Text style={{ color: C.textMuted, fontSize: 10, textAlign: "right" }}>{yAxisSteps[2]}</Text>
              <Text style={{ color: C.textMuted, fontSize: 10, textAlign: "right" }}>0</Text>
            </View>
            <View style={{ width: chartWidth, height: chartHeight, position: "relative", paddingBottom: 28 }}>
              {yAxisSteps.map((step, index) => {
                const bottom = ((step / chartMaxValue) * (chartHeight - 28))
                return (
                  <View
                    key={`${step}-${index}`}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom,
                      borderTopWidth: 1,
                      borderColor: "#d1d5db",
                      borderStyle: "dashed",
                      opacity: 0.7,
                    }}
                  />
                )
              })}
              <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                {barData.map((bar, index) => {
                  const barHeight = maxTrendValue > 0 ? Math.max(2, (bar.value / chartMaxValue) * (chartHeight - 28)) : 2
                  return (
                    <View key={`${summary.month ?? "month"}-${bar.label}-${index}`} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", position: "relative" }}>
                      {selectedTrendIndex === index && (
                        <View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            bottom: selectedBubbleBottom,
                            minWidth: 84,
                            backgroundColor: "#111827",
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderWidth: 1,
                            borderColor: C.border,
                            alignItems: "center",
                            zIndex: 2,
                          }}
                        >
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{formatINR(bar.value)}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={bar.onPress}
                        style={{
                          width: "100%",
                          height: chartHeight - 28,
                          alignItems: "center",
                          justifyContent: "flex-end",
                        }}
                      >
                        <Animated.View
                          style={{
                            width: 28,
                            height: barHeight,
                            backgroundColor: bar.frontColor,
                            borderTopLeftRadius: 14,
                            borderTopRightRadius: 14,
                          }}
                        />
                      </TouchableOpacity>
                      <Text style={{ color: C.textMuted, fontSize: 9, marginTop: 10 }}>{bar.label}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

function TransactionsTab({ grouped, txLoading, categories, selectedCategory, setSelectedCategory, selectedDirection, setSelectedDirection, onDelete, C }: {
  grouped: Record<string, { id: string; date: string; description: string; amount: number; type: string; category: string; bank?: string }[]>;
  txLoading: boolean;
  categories: readonly string[];
  selectedCategory: string | null;
  setSelectedCategory: (c: string | null) => void;
  selectedDirection: "all" | "incoming" | "outgoing";
  setSelectedDirection: (direction: "all" | "incoming" | "outgoing") => void;
  onDelete: (id: string) => void;
  C: ReturnType<typeof useTheme>;
}) {
  const filterPills: Array<{
    key: string;
    label: string;
    icon?: string;
    selected: boolean;
    onPress: () => void;
  }> = [
    {
      key: "all",
      label: "All",
      selected: !selectedCategory && selectedDirection === "all",
      onPress: () => {
        setSelectedCategory(null)
        setSelectedDirection("all")
      },
    },
    {
      key: "incoming",
      label: "Incoming",
      selected: selectedDirection === "incoming",
      onPress: () => {
        setSelectedCategory(null)
        setSelectedDirection("incoming")
      },
    },
    {
      key: "outgoing",
      label: "Outgoing",
      selected: selectedDirection === "outgoing",
      onPress: () => {
        setSelectedCategory(null)
        setSelectedDirection("outgoing")
      },
    },
    ...categories.map((cat) => ({
      key: cat,
      label: cat.split(" / ")[0],
      icon: CATEGORY_ICONS[cat],
      selected: selectedCategory === cat,
      onPress: () => {
        setSelectedDirection("all")
        setSelectedCategory(selectedCategory === cat ? null : cat)
      },
    })),
  ]

  return (
    <View style={{ paddingHorizontal: 20 }}>
      {/* Unified filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {filterPills.map((pill) => (
          <TouchableOpacity
            key={pill.key}
            onPress={pill.onPress}
            style={{
              backgroundColor: pill.selected ? "#6366f1" : C.card,
              borderRadius: 20,
              paddingHorizontal: pill.icon ? 12 : 14,
              paddingVertical: 7,
              marginRight: 6,
              borderWidth: 1,
              borderColor: pill.selected ? "#6366f1" : C.border,
              flexDirection: "row",
              alignItems: "center",
              gap: pill.icon ? 4 : 0,
            }}
          >
            {pill.icon ? <Text style={{ fontSize: 12 }}>{pill.icon}</Text> : null}
            <Text style={{ color: pill.selected ? "#fff" : C.textSub, fontSize: pill.icon ? 11 : 12, fontWeight: "600" }}>{pill.label}</Text>
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

function SuggestionsTab({ C, suggestion, loading }: {
  C: ReturnType<typeof useTheme>;
  suggestion: {
    analyzedMonth: string
    title: string
    summary: string
    source?: "gemini" | "built" | null
    recommendations: string[]
    updatedAt: string
  } | null | undefined
  loading: boolean
}) {
  if (loading) {
    return <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
  }

  if (!suggestion) {
    return (
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(99,102,241,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Ionicons name="bulb-outline" size={28} color="#6366f1" />
          </View>
          <Text style={{ color: C.text, fontSize: 19, fontWeight: "700", marginBottom: 8 }}>Suggestions</Text>
          <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 22 }}>
            Upload or re-import the PDF statement for this selected month to generate advisor-style suggestions for this month. Each month keeps its own findings.
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={{ paddingHorizontal: 20, gap: 16 }}>
      <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: C.border }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(99,102,241,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Ionicons name="bulb-outline" size={28} color="#6366f1" />
        </View>
        <Text style={{ color: C.text, fontSize: 19, fontWeight: "700", marginBottom: 4 }}>Suggestions for {suggestion.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Text style={{ color: C.textMuted, fontSize: 11 }}>
            Last updated {new Date(suggestion.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
          {suggestion.source ? (
            <View
              style={{
                backgroundColor: suggestion.source === "gemini" ? "rgba(99,102,241,0.14)" : C.inputBg,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: suggestion.source === "gemini" ? "rgba(99,102,241,0.35)" : C.border,
              }}
            >
              <Text style={{ color: suggestion.source === "gemini" ? "#a5b4fc" : C.textSub, fontSize: 10, fontWeight: "700" }}>
                {suggestion.source === "gemini" ? "Gemini" : "Built-in"}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 22 }}>
          {suggestion.summary}
        </Text>
      </View>

      {suggestion.recommendations.map((item, index) => (
        <View key={`${suggestion.analyzedMonth}-${index}`} style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, flexDirection: "row", gap: 12 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(99,102,241,0.16)", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
            <Text style={{ color: "#a5b4fc", fontWeight: "700", fontSize: 12 }}>{index + 1}</Text>
          </View>
          <Text style={{ flex: 1, color: C.text, fontSize: 14, lineHeight: 22 }}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

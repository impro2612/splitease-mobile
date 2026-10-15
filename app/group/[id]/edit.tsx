import { useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Keyboard, Modal, Platform, ScrollView, TouchableOpacity, View } from "react-native"
import { Text, TextInput } from "@/components/ui/Typography"
import DateTimePicker from "@react-native-community/datetimepicker"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import Toast from "react-native-toast-message"
import { groupsApi } from "@/lib/api"
import { CURRENCIES } from "@/lib/currencies"
import { useTheme } from "@/lib/theme"
import { GROUP_COLORS, GROUP_EMOJIS, toLocalDateKey } from "@/lib/utils"
import { InAppFullScreenModal } from "@/components/ui/InAppModal"
import { useAuthStore } from "@/store/auth"
import { tokens } from "@/lib/theme"
import { haptic } from "@/lib/haptics"

type GroupFormSnapshot = {
  name: string
  emoji: string
  color: string
  currency: string
  location: string
  lat: number | null
  lng: number | null
  startDate: string | null
  endDate: string | null
}

function toDateOnly(date: Date | null) {
  return date ? toLocalDateKey(date) : null
}

function dateFromApi(value?: string | null) {
  return value ? new Date(value) : null
}

export default function EditGroup() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const C = useTheme()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [showStartPicker, setShowStartPicker] = useState(false)
  const [showEndPicker, setShowEndPicker] = useState(false)
  const [location, setLocation] = useState("")
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)
  const [locationResults, setLocationResults] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [locationSearching, setLocationSearching] = useState(false)
  const locationDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [emoji, setEmoji] = useState("💰")
  const [color, setColor] = useState("#6366f1")
  const [groupCurrency, setGroupCurrency] = useState("INR")
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [currencySearch, setCurrencySearch] = useState("")
  const [initialSnapshot, setInitialSnapshot] = useState<GroupFormSnapshot | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { user } = useAuthStore()

  const { data: group, isLoading } = useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })

  useEffect(() => {
    if (!group || initialSnapshot) return
    const snapshot: GroupFormSnapshot = {
      name: group.name ?? "",
      emoji: group.emoji ?? "💰",
      color: group.color ?? "#6366f1",
      currency: group.currency ?? "INR",
      location: group.location ?? "",
      lat: group.lat ?? null,
      lng: group.lng ?? null,
      startDate: group.startDate ? toLocalDateKey(new Date(group.startDate)) : null,
      endDate: group.endDate ? toLocalDateKey(new Date(group.endDate)) : null,
    }
    setInitialSnapshot(snapshot)
    setName(snapshot.name)
    setEmoji(snapshot.emoji)
    setColor(snapshot.color)
    setGroupCurrency(snapshot.currency)
    setLocation(snapshot.location)
    setLocationLat(snapshot.lat)
    setLocationLng(snapshot.lng)
    setStartDate(dateFromApi(snapshot.startDate))
    setEndDate(dateFromApi(snapshot.endDate))
  }, [group, initialSnapshot])

  const currentSnapshot = useMemo<GroupFormSnapshot>(() => ({
    name: name.trim(),
    emoji,
    color,
    currency: groupCurrency,
    location: location.trim(),
    lat: location.trim() ? locationLat : null,
    lng: location.trim() ? locationLng : null,
    startDate: toDateOnly(startDate),
    endDate: toDateOnly(endDate),
  }), [name, emoji, color, groupCurrency, location, locationLat, locationLng, startDate, endDate])

  const hasChanges = !!initialSnapshot && JSON.stringify(currentSnapshot) !== JSON.stringify(initialSnapshot)
  const canSave = hasChanges && !!name.trim()

  function closeScreen() {
    Keyboard.dismiss()
    router.back()
  }

  function handleLocationChange(text: string) {
    setLocation(text)
    setLocationLat(null)
    setLocationLng(null)
    if (locationDebounce.current) clearTimeout(locationDebounce.current)
    if (!text.trim() || text.trim().length < 2) {
      setLocationResults([])
      return
    }
    locationDebounce.current = setTimeout(async () => {
      setLocationSearching(true)
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text.trim())}&format=json&addressdetails=1&limit=10&dedupe=1`
        const res = await fetch(url, { headers: { "User-Agent": "SplitIT/1.0 (+https://splitwithease.vercel.app)" } })
        const data = await res.json()
        if (!Array.isArray(data)) {
          setLocationResults([])
          return
        }

        const seen = new Set<string>()
        const results = data
          .sort((a: any, b: any) => (b.importance ?? 0) - (a.importance ?? 0))
          .map((item: any) => {
            const addr = item.address ?? {}
            const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county ?? addr.state_district
            const state = addr.state ?? addr.region
            const country = addr.country ?? ""
            const parts = [city, state, country].filter(Boolean)
            const label = parts.filter((p, i) => i === 0 || p.toLowerCase() !== parts[i - 1].toLowerCase()).join(", ")
            return { display_name: label || item.display_name.split(",").slice(0, 3).join(",").trim(), lat: item.lat, lon: item.lon }
          })
          .filter((r: any) => {
            if (seen.has(r.display_name)) return false
            seen.add(r.display_name)
            return true
          })
          .slice(0, 5)

        setLocationResults(results)
      } catch {
        setLocationResults([])
      } finally {
        setLocationSearching(false)
      }
    }, 400)
  }

  function selectLocation(item: { display_name: string; lat: string; lon: string }) {
    setLocation(item.display_name)
    setLocationLat(parseFloat(item.lat))
    setLocationLng(parseFloat(item.lon))
    setLocationResults([])
    Keyboard.dismiss()
  }

  const updateMutation = useMutation({
    mutationFn: () => groupsApi.update(id, {
      name: currentSnapshot.name,
      emoji: currentSnapshot.emoji,
      color: currentSnapshot.color,
      currency: currentSnapshot.currency,
      location: currentSnapshot.location || null,
      lat: currentSnapshot.lat,
      lng: currentSnapshot.lng,
      startDate: currentSnapshot.startDate,
      endDate: currentSnapshot.endDate,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["activity"] })
      queryClient.invalidateQueries({ queryKey: ["timeline"] })
      Toast.show({ type: "success", text1: "Group updated!" })
      router.back()
    },
    onError: (err: any) => Toast.show({ type: "error", text1: err?.response?.data?.error ?? "Failed to update group" }),
  })

  // Only admins can delete a group (the API enforces this too)
  const isAdmin = !!group?.members?.some((m: any) => m.userId === user?.id && m.role === "ADMIN")

  const deleteMutation = useMutation({
    mutationFn: () => groupsApi.delete(id),
    onSuccess: () => {
      haptic.success()
      setConfirmDelete(false)
      queryClient.removeQueries({ queryKey: ["group", id] })
      queryClient.removeQueries({ queryKey: ["balances", id] })
      queryClient.invalidateQueries({ queryKey: ["groups"] })
      queryClient.invalidateQueries({ queryKey: ["balance-summary"] })
      queryClient.invalidateQueries({ queryKey: ["activity"] })
      queryClient.invalidateQueries({ queryKey: ["timeline"] })
      Toast.show({ type: "success", text1: "Group deleted" })
      // Drop the deleted group's screens from the back stack
      router.dismissTo("/(tabs)/groups" as any)
    },
    onError: (err: any) => {
      haptic.error()
      Toast.show({ type: "error", text1: err?.response?.data?.error ?? "Failed to delete group" })
    },
  })

  if (isLoading || !initialSnapshot) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }} edges={["top"]}>
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    )
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ color: C.text, fontSize: 24, fontWeight: "700" }}>Edit Group</Text>
              <TouchableOpacity onPress={closeScreen} style={{ backgroundColor: C.iconBg, borderRadius: 22, padding: 10 }}>
                <Ionicons name="close" size={20} color={C.text} />
              </TouchableOpacity>
            </View>
            <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color + "33", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{name || "Group name"}</Text>
                <Text style={{ color: C.textSub, fontSize: 12 }}>
                  {startDate ? startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No dates set"}
                  {startDate && endDate ? ` → ${endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Group name *</Text>
            <View style={{ backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 48, justifyContent: "center", marginBottom: 10 }}>
              <TextInput style={{ color: C.text, fontSize: 15 }} placeholder="e.g. NYC Trip, Apartment" placeholderTextColor={C.textMuted} value={name} onChangeText={setName} />
            </View>

            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 6 }}>📅 Dates (optional)</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowStartPicker(true) }}
                style={{ flex: 1, backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: startDate ? "#6366f1" : C.border, height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 }}>
                <Ionicons name="calendar-outline" size={16} color={startDate ? "#6366f1" : C.textSub} />
                <Text style={{ color: startDate ? C.text : C.textMuted, fontSize: 14, flex: 1 }} numberOfLines={1}>
                  {startDate ? startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Start date"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowEndPicker(true) }}
                style={{ flex: 1, backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: endDate ? "#6366f1" : C.border, height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 }}>
                <Ionicons name="calendar-outline" size={16} color={endDate ? "#6366f1" : C.textSub} />
                <Text style={{ color: endDate ? C.text : C.textMuted, fontSize: 14, flex: 1 }} numberOfLines={1}>
                  {endDate ? endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "End date"}
                </Text>
              </TouchableOpacity>
            </View>
            {showStartPicker && (
              <DateTimePicker
                value={startDate ?? new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, d) => { setShowStartPicker(false); if (d) { setStartDate(d); if (endDate && d > endDate) setEndDate(null) } }}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endDate ?? startDate ?? new Date()}
                mode="date"
                minimumDate={startDate ?? undefined}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_, d) => { setShowEndPicker(false); if (d) setEndDate(d) }}
              />
            )}

            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 6 }}>📍 Location (optional)</Text>
            <View style={{ backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: locationLat ? "#6366f1" : C.border, paddingHorizontal: 16, height: 48, justifyContent: "center", marginBottom: locationResults.length > 0 || locationSearching ? 4 : 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="location-outline" size={16} color={locationLat ? "#6366f1" : C.textSub} />
              <TextInput style={{ flex: 1, color: C.text, fontSize: 15 }} placeholder="e.g. Goa, India" placeholderTextColor={C.textMuted} value={location} onChangeText={handleLocationChange} />
              {locationLat ? <Ionicons name="checkmark-circle" size={16} color={C.positive} /> : null}
            </View>
            {locationSearching && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, paddingHorizontal: 4 }}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={{ color: C.textSub, fontSize: 12 }}>Searching…</Text>
              </View>
            )}
            {locationResults.length > 0 && (
              <View style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: "hidden" }}>
                {locationResults.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => selectLocation(item)}
                    style={{ padding: 12, borderBottomWidth: idx < locationResults.length - 1 ? 1 : 0, borderBottomColor: C.border, flexDirection: "row", alignItems: "center", gap: 10 }}
                  >
                    <Ionicons name="location" size={14} color="#6366f1" />
                    <Text style={{ flex: 1, color: C.text, fontSize: 13 }} numberOfLines={2}>{item.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 6 }}>Group Currency</Text>
            <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={{ backgroundColor: C.inputBg, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 18 }}>{CURRENCIES.find(c => c.code === groupCurrency)?.flag}</Text>
                <Text style={{ color: C.text, fontSize: 15 }}>{groupCurrency} — {CURRENCIES.find(c => c.code === groupCurrency)?.name}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>

            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 6, marginTop: 2 }}>Icon</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {GROUP_EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => setEmoji(e)} style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: emoji === e ? "rgba(99,102,241,0.3)" : C.iconBg, borderWidth: emoji === e ? 2 : 1, borderColor: emoji === e ? "#6366f1" : C.border, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 21 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: C.textSub, fontSize: 13, fontWeight: "500", marginBottom: 8 }}>Color</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {GROUP_COLORS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: C.isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.4)" }} />
              ))}
            </View>

            {isAdmin && (
              <View style={{ marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: C.border }}>
                <TouchableOpacity
                  onPress={() => { haptic.warning(); setConfirmDelete(true) }}
                  accessibilityLabel="Delete group"
                  style={{ height: 50, borderRadius: tokens.radius.md, backgroundColor: tokens.negativeSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={C.negative} />
                  <Text style={{ color: C.negative, fontWeight: "700", fontSize: 15 }}>Delete group</Text>
                </TouchableOpacity>
                <Text style={{ color: C.textMuted, fontSize: 12, textAlign: "center", marginTop: 8 }}>
                  Only admins can do this, and only once everyone is settled up. It removes the group for every member.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(24, insets.bottom + 12), paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg }}>
            <TouchableOpacity
              onPress={() => updateMutation.mutate()}
              disabled={!canSave || updateMutation.isPending}
              style={{ backgroundColor: canSave ? "#6366f1" : "#374151", opacity: canSave ? 1 : 0.55, borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" }}
            >
              {updateMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Delete confirmation */}
        <Modal transparent visible={confirmDelete} animationType="fade" onRequestClose={() => !deleteMutation.isPending && setConfirmDelete(false)}>
          <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "center", padding: 24 }}>
            <View style={{ backgroundColor: C.card, borderRadius: tokens.radius.xl, padding: 24 }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: tokens.negativeSoft, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 14 }}>
                <Ionicons name="trash-outline" size={24} color={C.negative} />
              </View>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: "800", textAlign: "center" }}>Delete "{group?.name}"?</Text>
              <Text style={{ color: C.textSub, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 }}>
                All of this group's expenses, balances and settlements will be permanently deleted for every member. This can't be undone.
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
                <TouchableOpacity
                  onPress={() => setConfirmDelete(false)}
                  disabled={deleteMutation.isPending}
                  style={{ flex: 1, height: 48, borderRadius: tokens.radius.md, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ color: C.text, fontWeight: "700", fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  style={{ flex: 1, height: 48, borderRadius: tokens.radius.md, backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center" }}
                >
                  {deleteMutation.isPending
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Delete</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <InAppFullScreenModal visible={showCurrencyPicker} onRequestClose={() => setShowCurrencyPicker(false)}>
          <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: "700" }}>Group Currency</Text>
              <TouchableOpacity onPress={() => { setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ backgroundColor: C.iconBg, borderRadius: 20, padding: 8 }}>
                <Ionicons name="close" size={18} color={C.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginHorizontal: 20, paddingHorizontal: 14, height: 46, marginBottom: 12 }}>
              <Ionicons name="search" size={16} color={C.textMuted} style={{ marginRight: 8 }} />
              <TextInput style={{ color: C.text, flex: 1, fontSize: 14 }} placeholder="Search currency..." placeholderTextColor={C.textMuted} value={currencySearch} onChangeText={setCurrencySearch} autoCapitalize="none" />
              {currencySearch.length > 0 && <TouchableOpacity onPress={() => setCurrencySearch("")}><Ionicons name="close-circle" size={16} color={C.textMuted} /></TouchableOpacity>}
            </View>
            <FlatList
              data={CURRENCIES.filter(c => c.code.toLowerCase().includes(currencySearch.toLowerCase()) || c.name.toLowerCase().includes(currencySearch.toLowerCase()))}
              keyExtractor={item => item.code}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(40, insets.bottom + 20) }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => { setGroupCurrency(item.code); setShowCurrencyPicker(false); setCurrencySearch("") }} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                    <Text style={{ fontSize: 16, color: C.text, fontWeight: "600" }}>{item.symbol}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: "600" }}>{item.code}</Text>
                    <Text style={{ color: C.textSub, fontSize: 12 }}>{item.name}</Text>
                  </View>
                  <Text style={{ fontSize: 24, marginRight: groupCurrency === item.code ? 8 : 0 }}>{item.flag}</Text>
                  {groupCurrency === item.code && <Ionicons name="checkmark-circle" size={20} color="#6366f1" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </InAppFullScreenModal>
      </View>
    </>
  )
}

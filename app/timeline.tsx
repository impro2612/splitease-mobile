import { useRef, useState, useMemo } from "react"
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, ScrollView } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/lib/theme"
import { useQuery } from "@tanstack/react-query"
import { timelineApi } from "@/lib/api"
import WebView from "react-native-webview"
import { LEAFLET_CSS, LEAFLET_JS } from "@/lib/leaflet-bundle"

const PURPLE = "#a78bfa"
const PURPLE_BG = "rgba(167,139,250,0.12)"

type Pin = {
  id: string; name: string; emoji: string
  location: string | null; lat: number; lng: number
  startDate: string | null; endDate: string | null
}

function fmtRange(start: string | null, end: string | null) {
  if (!start) return ""
  const s = new Date(start)
  const e = end ? new Date(end) : null
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
  if (!e || s.toDateString() === e.toDateString()) return s.toLocaleDateString("en-IN", opts)
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth())
    return `${s.getDate()} – ${e.toLocaleDateString("en-IN", opts)}`
  return `${s.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-IN", opts)}`
}

function buildMapHtml(pins: Pin[], bottomInset: number = 0) {
  // Replace </ with <\/ so the HTML parser can't see </script> inside the JSON blob
  const pinsJson = JSON.stringify(pins.map(p => ({
    lat: p.lat, lng: p.lng,
    name: p.name, emoji: p.emoji,
    dateRange: fmtRange(p.startDate, p.endDate),
    location: p.location ?? null,
  }))).replace(/<\//g, "<\\/")

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>${LEAFLET_CSS}</style>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; background:#e8edf2; }
  .leaflet-control-zoom { border:none !important; }
  .leaflet-control-zoom a {
    background:#ffffff !important; color:#334155 !important;
    border:1px solid #cbd5e1 !important; width:32px !important; height:32px !important;
    line-height:32px !important; font-size:18px !important; border-radius:8px !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15) !important;
  }
  .leaflet-control-zoom a:hover { background:#f1f5f9 !important; }
  .leaflet-control-attribution { display:none !important; }
  .leaflet-bottom { padding-bottom: ${bottomInset + 8}px; }
  .pin-wrap { position:relative; width:36px; height:44px; }
  .pin-bubble {
    position:absolute; top:0; left:50%; transform:translateX(-50%);
    background:#7c3aed; border-radius:50% 50% 50% 0; width:32px; height:32px;
    display:flex; align-items:center; justify-content:center; font-size:16px;
    box-shadow: 0 3px 10px rgba(124,58,237,0.45);
    transform: translateX(-50%) rotate(-45deg);
  }
  .pin-emoji { transform: rotate(45deg); display:block; }
  .pin-tip {
    position:absolute; bottom:0; left:50%; transform:translateX(-50%);
    width:6px; height:14px;
    background:linear-gradient(to bottom, #7c3aed, transparent);
    border-radius:0 0 4px 4px;
  }
  .popup-box {
    background:#ffffff; border:1px solid #e2e8f0; border-radius:12px;
    padding:10px 14px; min-width:160px;
    font-family: -apple-system, sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }
  .popup-title { font-size:14px; font-weight:700; color:#1e293b; margin-bottom:3px; }
  .popup-date { font-size:11px; color:#64748b; margin-bottom:2px; }
  .popup-location { font-size:11px; color:#94a3b8; display:flex; align-items:center; gap:3px; }
  .leaflet-popup-content-wrapper { background:transparent; box-shadow:none; padding:0; }
  .leaflet-popup-content { margin:0 !important; }
  .leaflet-popup-tip-container { display:none; }
</style>
</head>
<body>
<div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
const pins = ${pinsJson};

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

const map = L.map('map', {
  center: [20, 10], zoom: 2, minZoom: 2, maxZoom: 16,
  zoomControl: false,
});
L.control.zoom({ position: 'bottomright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  maxZoom: 19,
  subdomains: 'abcd',
}).addTo(map);

pins.forEach(p => {
  const iconHtml = \`<div class="pin-wrap">
    <div class="pin-bubble"><span class="pin-emoji">\${esc(p.emoji)}</span></div>
    <div class="pin-tip"></div>
  </div>\`;
  const icon = L.divIcon({ html: iconHtml, className: '', iconSize: [36, 44], iconAnchor: [18, 44], popupAnchor: [0, -48] });
  const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);

  const popupContent = \`<div class="popup-box">
    <div class="popup-title">\${esc(p.emoji)} \${esc(p.name)}</div>
    \${p.dateRange ? '<div class="popup-date">' + esc(p.dateRange) + '</div>' : ''}
    \${p.location ? '<div class="popup-location">📍 ' + esc(p.location) + '</div>' : ''}
  </div>\`;
  marker.bindPopup(popupContent, { closeButton: false, autoPan: true });
  marker.on('click', () => marker.openPopup());
});

if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 6);
else if (pins.length > 1) {
  const bounds = L.latLngBounds(pins.map(p => [p.lat, p.lng]));
  map.fitBounds(bounds.pad(0.3));
}
</script>
</body>
</html>`
}

export default function Timeline() {
  const C = useTheme()
  const { bottom: bottomInset } = useSafeAreaInsets()
  const fadeAnim = useRef(new Animated.Value(0)).current

  const { data: pins = [], isLoading, isError } = useQuery<Pin[]>({
    queryKey: ["timeline-pins"],
    queryFn: async () => { const r = await timelineApi.pins(); return r.data },
  })

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    pins.forEach(p => { if (p.startDate) years.add(new Date(p.startDate).getFullYear()) })
    return Array.from(years).sort((a, b) => b - a)
  }, [pins])

  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const activeYear = selectedYear ?? availableYears[0] ?? null

  const visiblePins = useMemo(() => {
    if (!activeYear) return pins
    return pins.filter(p => p.startDate && new Date(p.startDate).getFullYear() === activeYear)
  }, [pins, activeYear])

  const handleYearSelect = (year: number) => {
    fadeAnim.setValue(0)
    setSelectedYear(year)
  }

  const hasMap = visiblePins.length > 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.iconBg, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: PURPLE_BG, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="earth-outline" size={20} color={PURPLE} />
        </View>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", flex: 1 }}>Your Timeline</Text>
        {!isLoading && (
          <View style={{ backgroundColor: PURPLE_BG, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: PURPLE, fontSize: 12, fontWeight: "700" }}>{visiblePins.length} place{visiblePins.length !== 1 ? "s" : ""}</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={PURPLE} size="large" />
          <Text style={{ color: C.textSub, marginTop: 12, fontSize: 13 }}>Loading your map…</Text>
        </View>
      ) : !hasMap ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: PURPLE_BG, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Ionicons name="earth-outline" size={40} color={PURPLE} />
          </View>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>No places yet</Text>
          <Text style={{ color: C.textSub, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
            Add a location when creating a group — it'll show up as a pin on your world map.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <WebView
              key={activeYear ?? "all"}
              source={{ html: buildMapHtml(visiblePins, bottomInset) }}
              style={{ flex: 1, backgroundColor: C.bg }}
              scrollEnabled={false}
              onLoad={() => Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()}
              originWhitelist={["*"]}
              javaScriptEnabled
            />
          </Animated.View>

          {/* Floating year filter over map */}
          {availableYears.length > 0 && (
            <View style={{
              position: "absolute", top: 16, left: 0, right: 0,
              zIndex: 10, pointerEvents: "box-none",
            }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                style={{ flexGrow: 0 }}
              >
                {availableYears.map(year => {
                  const isActive = year === activeYear
                  return (
                    <TouchableOpacity
                      key={year}
                      onPress={() => handleYearSelect(year)}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 20, paddingVertical: 9,
                        borderRadius: 24,
                        backgroundColor: isActive ? "rgba(124,58,237,0.92)" : "rgba(15,23,42,0.72)",
                        borderWidth: 1,
                        borderColor: isActive ? "#a78bfa" : "rgba(255,255,255,0.18)",
                        shadowColor: isActive ? "#7c3aed" : "#000",
                        shadowOffset: { width: 0, height: isActive ? 6 : 3 },
                        shadowOpacity: isActive ? 0.55 : 0.25,
                        shadowRadius: isActive ? 12 : 5,
                        elevation: isActive ? 10 : 4,
                      }}
                    >
                      <Text style={{
                        color: isActive ? "#ffffff" : "rgba(203,213,225,0.85)",
                        fontSize: 14, fontWeight: "700", letterSpacing: 0.8,
                      }}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  )
}

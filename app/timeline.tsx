import { useMemo, useRef, useState } from "react"
import { View, TouchableOpacity, ActivityIndicator, Animated, ScrollView } from "react-native"
import { Text } from "@/components/ui/Typography"
import { EmptyState } from "@/components/ui/EmptyState"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTheme, featureAccents, useFeatureAccent } from "@/lib/theme"
import { useQuery } from "@tanstack/react-query"
import { timelineApi } from "@/lib/api"
import WebView from "react-native-webview"
import { withPlus } from "@/components/PlusGate"


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

function escHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildMapHtml(pins: Pin[], bottomInset: number) {
  const pinsJson = JSON.stringify(pins.map(p => ({
    lat: p.lat, lng: p.lng,
    name: escHtml(p.name),
    emoji: escHtml(p.emoji),
    dateRange: fmtRange(p.startDate, p.endDate),
    location: p.location ? escHtml(p.location) : "",
  }))).replace(/<\//g, "<\\/")

  const pageBg = "#e8edf2"
  const controlBg = "#ffffff"
  const controlText = "#334155"
  const controlBorder = "#cbd5e1"
  const controlHover = "#f1f5f9"
  const popupBg = "#ffffff"
  const popupBorder = "#e2e8f0"
  const popupTitle = "#1e293b"
  const popupSub = "#64748b"
  // OpenFreeMap: free vector tiles, no API key or usage limits (Carto's basemaps now need a key).
  // OSM data, so the attribution must stay visible.
  const mapStyle = "https://tiles.openfreemap.org/styles/liberty"

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; overflow:hidden; background:${pageBg}; }
  .maplibregl-ctrl-group { background:transparent !important; box-shadow:none !important; }
  .maplibregl-ctrl-group button {
    background:${controlBg} !important; border:1px solid ${controlBorder} !important;
    width:36px !important; height:36px !important; border-radius:8px !important;
    margin-top:6px; box-shadow: 0 1px 4px rgba(0,0,0,0.15) !important;
  }
  .maplibregl-ctrl-group button:active { background:${controlHover} !important; }
  .maplibregl-ctrl-group button + button { border-top:1px solid ${controlBorder} !important; }
  .maplibregl-ctrl-bottom-right { bottom:${bottomInset + 14}px !important; right:4px; }
  .maplibregl-ctrl-bottom-left { bottom:${bottomInset + 6}px !important; }
  .maplibregl-ctrl-attrib { font-size:10px; color:${controlText}; }
  .pin-wrap { position:relative; width:36px; height:44px; cursor:pointer; }
  .pin-bubble {
    position:absolute; top:0; left:50%;
    background:#8b5cf6; border-radius:50% 50% 50% 0; width:32px; height:32px;
    display:flex; align-items:center; justify-content:center; font-size:16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    transform: translateX(-50%) rotate(-45deg);
  }
  .pin-emoji { transform: rotate(45deg); display:block; }
  .pin-tip {
    position:absolute; bottom:0; left:50%; transform:translateX(-50%);
    width:6px; height:14px;
    background:linear-gradient(to bottom, #8b5cf6, transparent);
    border-radius:0 0 4px 4px;
  }
  .maplibregl-popup-content { background:transparent; box-shadow:none; padding:0; }
  .maplibregl-popup-tip { display:none; }
  .popup-box {
    background:${popupBg}; border:1px solid ${popupBorder}; border-radius:12px;
    padding:10px 14px; min-width:160px;
    font-family: -apple-system, sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }
  .popup-title { font-size:14px; font-weight:700; color:${popupTitle}; margin-bottom:3px; }
  .popup-date, .popup-location { font-size:11px; color:${popupSub}; margin-top:2px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="maperr" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;text-align:center;padding:32px;font-family:-apple-system,sans-serif;color:${popupSub};font-size:14px;line-height:20px"></div>
<script>
function showMapError(msg) {
  const el = document.getElementById('maperr');
  el.textContent = msg; el.style.display = 'flex';
}
</script>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js" onerror="showMapError('Couldn\\'t load the map. Check your connection and reopen Timeline.')"></script>
<script>
const pins = ${pinsJson};
const webgl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
if (typeof maplibregl === 'undefined') { /* script failed; message already shown */ }
else if (!webgl) showMapError("This device can't display the map.");
else {

const map = new maplibregl.Map({
  container: 'map',
  style: '${mapStyle}',
  center: [10, 20], zoom: 1, minZoom: 0.5, maxZoom: 16,
  renderWorldCopies: false,
  dragRotate: false, pitchWithRotate: false, touchPitch: false,
  attributionControl: false,
});
map.touchZoomRotate.disableRotation();
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

pins.forEach(p => {
  const el = document.createElement('div');
  el.className = 'pin-wrap';
  el.innerHTML = \`<div class="pin-bubble"><span class="pin-emoji">\${p.emoji}</span></div><div class="pin-tip"></div>\`;
  const popup = new maplibregl.Popup({ closeButton: false, offset: [0, -46], maxWidth: '260px' }).setHTML(\`<div class="popup-box">
    <div class="popup-title">\${p.emoji} \${p.name}</div>
    \${p.dateRange ? '<div class="popup-date">' + p.dateRange + '</div>' : ''}
    \${p.location ? '<div class="popup-location">📍 ' + p.location + '</div>' : ''}
  </div>\`);
  new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
});

const pad = { top: 80, left: 40, right: 40, bottom: ${bottomInset + 80} };
if (pins.length === 1) map.jumpTo({ center: [pins[0].lng, pins[0].lat], zoom: 5 });
else if (pins.length > 1) {
  const b = new maplibregl.LngLatBounds();
  pins.forEach(p => b.extend([p.lng, p.lat]));
  map.fitBounds(b, { padding: pad, maxZoom: 8, duration: 0 });
}
}
</script>
</body>
</html>`
}

function Timeline() {
  const C = useTheme()
  // Violet, matching the Timeline icon in the More menu
  const PURPLE = useFeatureAccent("timeline").text
  const PURPLE_BG = featureAccents.timeline.soft
  const { bottom: bottomInset } = useSafeAreaInsets()
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const { data: pins = [], isLoading, isError } = useQuery<Pin[]>({
    queryKey: ["timeline-pins"],
    queryFn: async () => { const r = await timelineApi.pins(); return r.data },
  })

  const availableYears = useMemo(() => {
    const years = new Set<number>()
    pins.forEach(p => { if (p.startDate) years.add(new Date(p.startDate).getFullYear()) })
    return Array.from(years).sort((a, b) => b - a)
  }, [pins])

  const activeYear = selectedYear ?? availableYears[0] ?? null
  const visiblePins = useMemo(() => {
    if (!activeYear) return pins
    return pins.filter(p => p.startDate && new Date(p.startDate).getFullYear() === activeYear)
  }, [pins, activeYear])

  const hasMap = visiblePins.length > 0

  const handleYearSelect = (year: number) => {
    fadeAnim.setValue(0)
    setSelectedYear(year)
  }

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
        <Text style={{ color: C.text, fontSize: 20, fontWeight: "800", flex: 1 }}>Timeline</Text>
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
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon="map-outline"
            title="No places yet"
            subtitle="Add a location to a group and it'll appear as a pin on your map."
            accent={featureAccents.timeline}
          />
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <WebView
            key={activeYear ?? "all"}
            source={{ html: buildMapHtml(visiblePins, bottomInset) }}
            style={{ flex: 1, backgroundColor: "#e8edf2" }}
            scrollEnabled={false}
            onLoad={() => Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            overScrollMode="never"
          />
          {availableYears.length > 0 && (
            <View style={{ position: "absolute", top: 16, left: 0, right: 0, pointerEvents: "box-none" }}>
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
                        borderColor: isActive ? PURPLE : "rgba(255,255,255,0.18)",
                        shadowColor: isActive ? featureAccents.timeline.solid : "#000",
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
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

export default withPlus(Timeline, "Timeline")

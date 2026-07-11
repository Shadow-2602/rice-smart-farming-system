/**
 * Bilingual lookup. Provides:
 *   - t(key, lang)        legacy single-key getter (used by Layout / older code)
 *   - getStrings(lang)    flat object with the design's translation keys
 *   - DISEASE_NAMES       English → Malay map for disease labels
 *
 * The design exports a nested t.diseases / t.sev object — getStrings() shapes
 * the data so existing JSX from Claude Design works without modification.
 */

export const DISEASE_NAMES = {
  "Bacterial Leaf Blight": "Hawar Daun Bakteria",
  "Brown Spot":           "Bintik Perang",
  "Leaf Blast":           "Barah Daun",
  "Sheath Blight":        "Hawar Sarung",
  "Tungro":               "Tungro",
  "Healthy":              "Sihat",
};

const SHARED = {
  en: {
    appName: "Rice Smart Farming",
    eyebrow: "AI Field Ops · Kedah, Malaysia",
    pgTitle: "Field Intelligence",
    dashSub:  "Real-time disease detection & yield forecasting",
    activeSensors: "Active Sensors",
    imagesToday:   "Images Today",
    diseasesToday: "Diseases Today",
    unreadAlerts:  "Unread Alerts",
    avgYield:      "Avg. Yield",
    yieldSub:      "≈ tonnes / hectare",
    yieldTrend:    "vs target",
    target:        "of target",
    sensorMap:        "Field Map · Kedah",
    yieldChart:       "Yield Trend · 30 Days",
    recentDetections: "Recent Disease Detections",
    recentAlerts:     "Recent Alerts",
    viewAll:    "View all",
    time:       "Time",
    disease:    "Disease",
    sensor:     "Sensor",
    confidence: "Confidence",
    severity:   "Severity",
    action:     "Action",
    viewImg:    "View",
    sev: { healthy: "Healthy", low: "Low", medium: "Medium", high: "High" },
    zone:        "Zone",
    coords:      "Coordinates",
    sensorYield: "Sensor Yield",
    detHistory:  "Detection History",
    imgGallery:  "Recent Images",
    fAll:    "All",
    fCrit:   "Critical",
    fWarn:   "Warning",
    fInfo:   "Info",
    unreadOnly: "Unread Only",
    markRead:   "Mark Read",
    markAllRead: "Mark all as read",
    dismiss:    "Dismiss",
    detections: "Detections",
    dateRange:  "Date Range",
    apply:      "Apply",
    exportCSV:  "Export CSV",
    avgYieldLbl:   "Avg. Yield",
    disBreak:      "Disease Breakdown",
    yieldOverTime: "Yield Over Time",
    disTrend:      "Disease Trend",
    to:       "to",
    active:   "Active",
    inactive: "Inactive",
    critical: "critical",
    warning:  "warning",
    live:     "System Live",
    perHa:    "kg/ha",
    back:     "← Back",
    soilIntel: "Field Intelligence",
    soilMeta:  "Avg detection confidence per sensor",
    climateMeta: "Kedah Weather · Live",
    sun:  "Sun",
    wind: "Wind",
    rain: "Rain",
    fieldName:  "Kedah Pilot Field",
    nitrogen:   "Image Quality",
    phosphorus: "Avg Confidence",
    potassium:  "Detection Rate",
    fieldType:  "Paddy",
    sensorsLbl: "Sensors",
    alertsLbl:  "Alerts",
    historyLbl: "History & Analytics",
    historySub: "Date-ranged analytics",
    nav: { dashboard: "Dashboard", sensors: "Sensors", alerts: "Alerts", history: "History", advisory: "Advisory" },
    advisoryLbl:    "AI Advisory",
    advisorySub:    "Ask the LLM about your field",
    askPlaceholder: "Ask about your field, diseases, yield, or treatments…",
    sendBtn:        "Send",
    chatHint:       "Powered by Ollama · Llama 3 · running locally",
    examplePrompts: [
      "What's the most common disease right now?",
      "Should I be worried about Sensor 3?",
      "Recommend treatment for Bacterial Leaf Blight",
      "Compare yield across the three zones",
    ],
    ollamaOffline:  "Ollama is not running. Start it with `ollama serve` and pull the model with `ollama pull llama3`.",
    modelNotPulled: "Model not pulled yet. Run `ollama pull llama3` and refresh.",
    typing:         "Thinking…",
    contextDrawer:  "View context",
    clearChat:      "Clear",
  },
  ms: {
    appName: "Pertanian Padi Pintar",
    eyebrow: "Operasi AI · Kedah, Malaysia",
    pgTitle: "Perisikan Lapangan",
    dashSub:  "Pengesanan penyakit masa nyata & ramalan hasil",
    activeSensors: "Sensor Aktif",
    imagesToday:   "Imej Hari Ini",
    diseasesToday: "Penyakit Hari Ini",
    unreadAlerts:  "Amaran Belum Baca",
    avgYield:      "Purata Hasil",
    yieldSub:      "≈ tan / hektar",
    yieldTrend:    "berbanding sasaran",
    target:        "daripada sasaran",
    sensorMap:        "Peta Lapangan · Kedah",
    yieldChart:       "Trend Hasil · 30 Hari",
    recentDetections: "Pengesanan Penyakit Terkini",
    recentAlerts:     "Amaran Terkini",
    viewAll:    "Lihat semua",
    time:       "Masa",
    disease:    "Penyakit",
    sensor:     "Sensor",
    confidence: "Keyakinan",
    severity:   "Keterukan",
    action:     "Tindakan",
    viewImg:    "Lihat",
    sev: { healthy: "Sihat", low: "Rendah", medium: "Sederhana", high: "Tinggi" },
    zone:        "Zon",
    coords:      "Koordinat",
    sensorYield: "Hasil Sensor",
    detHistory:  "Sejarah Pengesanan",
    imgGallery:  "Imej Terkini",
    fAll:    "Semua",
    fCrit:   "Kritikal",
    fWarn:   "Amaran",
    fInfo:   "Maklumat",
    unreadOnly: "Belum Baca Sahaja",
    markRead:   "Tandai Dibaca",
    markAllRead: "Tandai semua dibaca",
    dismiss:    "Buang",
    detections: "Pengesanan",
    dateRange:  "Julat Tarikh",
    apply:      "Guna",
    exportCSV:  "Eksport CSV",
    avgYieldLbl:   "Purata Hasil",
    disBreak:      "Pecahan Penyakit",
    yieldOverTime: "Hasil Sepanjang Masa",
    disTrend:      "Trend Penyakit",
    to:       "hingga",
    active:   "Aktif",
    inactive: "Tidak Aktif",
    critical: "kritikal",
    warning:  "amaran",
    live:     "Sistem Langsung",
    perHa:    "kg/ha",
    back:     "← Kembali",
    soilIntel: "Perisikan Lapangan",
    soilMeta:  "Keyakinan pengesanan purata per sensor",
    climateMeta: "Cuaca Kedah · Langsung",
    sun:  "Matahari",
    wind: "Angin",
    rain: "Hujan",
    fieldName:  "Padang Perintis Kedah",
    nitrogen:   "Kualiti Imej",
    phosphorus: "Keyakinan Purata",
    potassium:  "Kadar Pengesanan",
    fieldType:  "Padi",
    sensorsLbl: "Sensor",
    alertsLbl:  "Amaran",
    historyLbl: "Sejarah & Analitik",
    historySub: "Analitik mengikut tarikh",
    nav: { dashboard: "Papan Pemuka", sensors: "Sensor", alerts: "Amaran", history: "Sejarah", advisory: "Penasihat" },
    advisoryLbl:    "Penasihat AI",
    advisorySub:    "Tanya LLM tentang ladang anda",
    askPlaceholder: "Tanya tentang ladang, penyakit, hasil atau rawatan…",
    sendBtn:        "Hantar",
    chatHint:       "Dikuasakan oleh Ollama · Llama 3 · berjalan di komputer",
    examplePrompts: [
      "Apakah penyakit paling biasa sekarang?",
      "Patutkah saya bimbang tentang Sensor 3?",
      "Cadangkan rawatan untuk Hawar Daun Bakteria",
      "Bandingkan hasil antara tiga zon",
    ],
    ollamaOffline:  "Ollama tidak berjalan. Mulakan dengan `ollama serve` dan tarik model dengan `ollama pull llama3`.",
    modelNotPulled: "Model belum ditarik. Jalankan `ollama pull llama3` dan muat semula.",
    typing:         "Memikirkan…",
    contextDrawer:  "Lihat konteks",
    clearChat:      "Padam",
  },
};

/* Disease label maps (English-only on the EN side, EN→MS on the MS side) */
SHARED.en.diseases = Object.fromEntries(
  Object.keys(DISEASE_NAMES).map((en) => [en, en])
);
SHARED.ms.diseases = { ...DISEASE_NAMES };

export function getStrings(lang = "en") {
  return SHARED[lang] || SHARED.en;
}

/* ------------------------------------------------------------------------- */
/* Legacy single-key API kept so existing components (Layout, etc.) still work */
const LEGACY_ALIASES = {
  dashboard: "nav.dashboard", sensors: "nav.sensors",
  alerts:    "nav.alerts",    history: "nav.history",
  advisory:  "nav.advisory",
  no_data:   { en: "No data yet",       ms: "Tiada data" },
  loading:   { en: "Loading...",        ms: "Memuatkan..." },
  filter_severity: { en: "All severities", ms: "Semua keterukan" },
  filter_unread:   { en: "Unread only",    ms: "Belum dibaca sahaja" },
  page_prev: { en: "Previous", ms: "Sebelum" },
  page_next: { en: "Next",     ms: "Seterus" },
  status:    "active",
};

export function t(key, lang = "en") {
  const strings = getStrings(lang);
  // Direct keys
  if (key in strings) {
    const v = strings[key];
    return typeof v === "string" ? v : key;
  }
  // Aliases
  const alias = LEGACY_ALIASES[key];
  if (alias) {
    if (typeof alias === "object" && alias[lang]) return alias[lang];
    if (typeof alias === "string") {
      const parts = alias.split(".");
      let cur = strings;
      for (const p of parts) cur = cur?.[p];
      if (cur) return cur;
    }
  }
  // Severity prefix
  if (key.startsWith("severity_")) {
    const lvl = key.slice("severity_".length);
    if (strings.sev?.[lvl]) return strings.sev[lvl];
    return lvl;
  }
  return key;
}

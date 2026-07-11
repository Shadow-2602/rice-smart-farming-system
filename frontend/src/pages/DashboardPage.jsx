import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

import { useUI } from "../store";
import { getStrings } from "../i18n";
import {
  getSummary, getClimate, listSensors, listAlerts, listDiseases, listYields,
  annotatedImageUrl, watcherStatus,
} from "../api/api";
import SeverityBadge from "../components/SeverityBadge";
import { YieldChart, ConfBar } from "../components/Charts";

/* ───────── Gauge arc (climate card) ───────── */
function GaugeArc({ value = 28, max = 45 }) {
  const r = 80, cx = 110, cy = 100;
  const startAngle = -200 * Math.PI / 180;
  const endAngle   =   20 * Math.PI / 180;
  const pct = value / max;
  const sweepTotal = endAngle - startAngle;
  const sweep = sweepTotal * pct;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(startAngle + sweep);
  const y2 = cy + r * Math.sin(startAngle + sweep);
  const xe = cx + r * Math.cos(endAngle);
  const ye = cy + r * Math.sin(endAngle);
  return (
    <svg width="220" height="120" className="gauge-svg">
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${xe} ${ye}`}
            fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2}`}
            fill="none" stroke="url(#gaugeGrad)" strokeWidth="8" strokeLinecap="round" />
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#c8e63c" />
          <stop offset="100%" stopColor="#4a9a60" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ───────── Field map ───────── */
function FieldMap({ sensors, t }) {
  const center = sensors.length && sensors[0].latitude
    ? [sensors[0].latitude, sensors[0].longitude]
    : [6.130, 100.376];
  return (
    <MapContainer
      center={center} zoom={11}
      scrollWheelZoom={false}
      zoomControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} />
      {sensors.map((s) =>
        s.latitude && s.longitude ? (
          <CircleMarker
            key={s.id}
            center={[s.latitude, s.longitude]}
            radius={10}
            pathOptions={{
              fillColor: s.is_active ? "#22c55e" : "#9ca3af",
              color:     s.is_active ? "rgba(34,197,94,0.4)" : "rgba(156,163,175,0.4)",
              weight: 3, opacity: 1, fillOpacity: 0.9,
            }}
          >
            <Tooltip className="lf-tip" direction="top">
              <div style={{
                fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "#1a1a1a",
                background: "#fff", border: "1px solid rgba(0,0,0,0.10)",
                padding: "8px 12px", borderRadius: 10, boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
              }}>
                {s.name}{" "}
                <span style={{ color: s.is_active ? "#16a34a" : "#9ca3af", fontSize: 10, fontWeight: 700, marginLeft: 5 }}>
                  {s.is_active ? t.active : t.inactive}
                </span>
                <div style={{ fontSize: 10, color: "#6b7280" }}>
                  {s.latitude.toFixed(4)}°N {s.longitude.toFixed(4)}°E
                </div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>{s.field_zone}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ) : null
      )}
    </MapContainer>
  );
}

/* ═══════════════════════════════ Page ═══════════════════════════════ */
export default function DashboardPage() {
  const lang = useUI((s) => s.lang);
  const t = getStrings(lang);

  const [summary,  setSummary]  = useState(null);
  const [climate,  setClimate]  = useState(null);
  const [sensors,  setSensors]  = useState([]);
  const [alerts,   setAlerts]   = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [yields,   setYields]   = useState([]);
  const [watcher,  setWatcher]  = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // allSettled so one slow/broken endpoint (e.g. an old backend before
      // a fresh route lands) doesn't blank the entire dashboard.
      const results = await Promise.allSettled([
        getSummary(),
        getClimate(50),
        listSensors(),
        listAlerts({ is_dismissed: false, page: 1, page_size: 5 }),
        // sort=recent → uses sensor_images.created_at, so new images that
        // got backdated capture dates still appear at the top of the live
        // detection feed.
        listDiseases({ page: 1, page_size: 8, sort: "recent" }),
        // Fetch enough yield rows to cover ~30 days of capture history.
        // With ~4k predictions spread over 30 days, 1000 rows ≈ 1 week of
        // the latest data. We grab more so the 30-day area chart fills out.
        listYields({ page: 1, page_size: 1000 }),
        watcherStatus(),
      ]);
      if (cancelled) return;

      const pick = (i) => results[i].status === "fulfilled" ? results[i].value : null;
      results.forEach((r, i) => {
        if (r.status === "rejected") console.error(`Dashboard request ${i} failed:`, r.reason);
      });

      const s  = pick(0);
      const cl = pick(1);
      const sn = pick(2);
      const al = pick(3);
      const ds = pick(4);
      const yd = pick(5);
      const w  = pick(6);

      if (s)  setSummary(s);
      if (cl) setClimate(cl);
      if (sn) setSensors(sn);
      if (al) setAlerts(al.items);
      if (ds) setDiseases(ds.items);
      if (yd) setYields(yd.items);
      if (w)  setWatcher(w);
    }
    load();
    // Faster refresh (10s) so a new image flowing through the watcher actually
    // appears on the dashboard during a live demo without waiting half a minute.
    const id = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  /* Yield series for the area chart — bucket by date, average */
  const yieldData = useMemo(() => {
    const buckets = {};
    for (const y of yields) {
      const d = y.predicted_at.slice(0, 10);
      if (!buckets[d]) buckets[d] = { sum: 0, n: 0 };
      if (y.predicted_yield_kg_per_hectare) {
        buckets[d].sum += y.predicted_yield_kg_per_hectare;
        buckets[d].n += 1;
      }
    }
    // Sort by ISO key BEFORE formatting — otherwise "10 May" sorts before
    // "3 May" because lexicographic '1' < '3'.
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date: new Date(date).toLocaleDateString("en-MY", { month: "short", day: "numeric" }),
        value: b.n ? Math.round(b.sum / b.n) : 0,
      }))
      .slice(-30);
  }, [yields]);

  /* Most-common disease for the header pill */
  const mostCommon = summary?.most_common_disease;
  const mostCommonShown = lang === "ms" && summary?.most_common_disease_ms
    ? summary.most_common_disease_ms : mostCommon;

  /* KPI cards */
  const kpis = summary ? [
    {
      label: t.activeSensors,
      value: `${summary.sensors_active} / ${summary.sensors_total}`,
      sub: summary.sensors_total - summary.sensors_active > 0
        ? `${summary.sensors_total - summary.sensors_active} offline`
        : "all online",
      icon: "📡",
      bg: "rgba(74,154,96,0.08)",
    },
    {
      label: t.imagesToday,
      value: summary.images_today.toLocaleString(),
      sub: "all sensors",
      icon: "🌿",
      bg: "rgba(200,230,60,0.10)",
    },
    {
      label: t.diseasesToday,
      value: summary.detections_today.toLocaleString(),
      sub: "non-healthy",
      icon: "🔬",
      bg: "rgba(249,115,22,0.08)",
    },
    {
      label: t.unreadAlerts,
      value: `${summary.critical_alerts_unread + summary.warning_alerts_unread}`,
      sub: `${summary.critical_alerts_unread} ${t.critical}`,
      icon: "⚠️",
      bg: "rgba(239,68,68,0.07)",
    },
  ] : [];

  /* Avg confidence for "Field Intelligence" header (calculated from disease rows) */
  const avgConfidence = useMemo(() => {
    const valid = diseases.filter(d => d.confidence_score != null);
    if (valid.length === 0) return null;
    const m = valid.reduce((s, d) => s + d.confidence_score, 0) / valid.length;
    return (m * 100).toFixed(1);
  }, [diseases]);

  return (
    <div>
      <div className="pg-eyebrow">{t.eyebrow}</div>
      <div className="pg-title-row">
        <div className="pg-title" style={{ marginBottom: 0 }}>{t.pgTitle}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {watcher?.last_result?.new_images > 0 && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 700, color: "#15803d",
              background: "rgba(132,204,22,0.18)",
              border: "1px solid rgba(132,204,22,0.45)",
              padding: "4px 11px", borderRadius: 20,
              whiteSpace: "nowrap",
            }}>
              <span className="live-dot" style={{ background: "#15803d" }} />
              +{watcher.last_result.new_images} ingested
              {watcher.last_result.processed > 0 && ` · ${watcher.last_result.processed} processed`}
            </div>
          )}
          <div className="live-pill"><div className="live-dot" />{t.live}</div>
          {mostCommon && (
            <div style={{
              fontSize: 11, color: "var(--text3)",
              background: "rgba(255,255,255,0.7)", border: "1px solid var(--border)",
              padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap",
            }}>
              Most common: <span style={{ color: "#ef4444", fontWeight: 700 }}>{mostCommonShown}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        {kpis.map((k, i) => (
          <div key={i} className="card kpi-card slide-up" style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="kpi-icon-wrap" style={{ background: k.bg }}>{k.icon}</div>
            <div className="kpi-lbl">{k.label}</div>
            <div className="kpi-val">{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Field Intelligence (c7) + ClimateIQ (c5) — slightly rebalanced
          so ClimateIQ has more breathing room and Field Intelligence is less
          empty-looking when there are only a few yield buckets. */}
      <div className="bento" style={{ marginBottom: 14 }}>
        <div className="c7 slide-up" style={{ animationDelay: "0.26s" }}>
          <div className="card intel-card">
            <div className="intel-header">
              <div>
                <div className="intel-title">{t.soilIntel}</div>
                <div className="intel-meta">
                  {t.soilMeta}{avgConfidence ? ` · ${avgConfidence}%` : ""}
                </div>
              </div>
              <div style={{
                display: "flex", flexDirection: "column", gap: 4,
                alignItems: "flex-end", fontSize: 11, color: "var(--text3)", minWidth: 130,
              }}>
                {sensors.slice(0, 3).map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: ["#22c55e", "#6bc4b8", "#c8e63c"][i],
                    }} />
                    {s.name}: <span style={{ fontFamily: "JetBrains Mono" }}>
                      {s.latitude?.toFixed(3)}°N
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ height: 170, position: "relative" }}>
              {yieldData.length >= 2 ? (
                <YieldChart data={yieldData} color="#a8cc20" height={170} />
              ) : (
                <div style={{
                  height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text3)", fontSize: 11, fontStyle: "italic",
                }}>
                  {yieldData.length === 1
                    ? `Only one capture day so far — chart appears once a second day's data lands.`
                    : "Awaiting yield predictions…"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ClimateIQ — averages the last 50 ingested images' weather readings */}
        <div className="c5 slide-up" style={{ animationDelay: "0.30s" }}>
          <div className="card" style={{ padding: "22px 24px", height: "100%", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>ClimateIQ</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                  {t.climateMeta}
                  {climate?.sample_size ? ` · avg of last ${climate.sample_size}` : ""}
                </div>
              </div>
              <button className="intel-expand">↗</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>
              <div>
                Air Quality: {climate?.aqi_band ?? "—"}
                {climate?.pollutant_value != null && ` (AQI ${Math.round(climate.pollutant_value)})`}
              </div>
              <div>Humidity: {climate?.humidity != null ? `${Math.round(climate.humidity)}%` : "—"}</div>
              <div>
                UV Index: {climate?.uv_band ? `↑ ${climate.uv_band}` : "—"}
                {climate?.uv_index != null && ` (${Math.round(climate.uv_index)})`}
              </div>
            </div>
            <div style={{ position: "relative", display: "flex", justifyContent: "center", margin: "0 auto" }}>
              <GaugeArc value={climate?.temperature ?? 0} max={45} />
              <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", textAlign: "center", lineHeight: 1 }}>
                <span style={{ fontSize: 52, fontWeight: 300, fontFamily: "JetBrains Mono", letterSpacing: "-0.05em", color: "var(--text)" }}>
                  {climate?.temperature != null ? Math.round(climate.temperature) : "—"}
                </span>
                <sup style={{ fontSize: 20, fontWeight: 300, color: "var(--text)", verticalAlign: "top", marginTop: 10, display: "inline-block" }}>°C</sup>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: "auto", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              {[
                { icon: "☀", lbl: t.sun,  val: climate?.sun_pct != null ? `${Math.round(climate.sun_pct)}% sun` : "—" },
                { icon: "⟁", lbl: t.wind, val: climate?.wind_speed != null ? `${Math.round(climate.wind_speed)} km/h` : "—" },
                { icon: "🌧", lbl: t.rain, val: climate?.precipitation_total != null ? `${climate.precipitation_total.toFixed(1)} mm` : "—" },
              ].map((x, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 15 }}>{x.icon}</div>
                  <div style={{ fontSize: 9.5, color: "var(--text3)", marginTop: 2 }}>{x.lbl}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginTop: 1 }}>{x.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Field card (c7) + Yield Hero (c5) — Yield Hero shrunk so it
          doesn't dominate the page. min-height also tightened from 260→210. */}
      <div className="bento" style={{ marginBottom: 14 }}>
        <div className="c7 slide-up" style={{ animationDelay: "0.34s", minHeight: 210 }}>
          <div className="field-card" style={{ height: "100%", minHeight: 210 }}>
            <img
              src="https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=1200&q=80"
              alt="Kedah paddy field"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              onError={e => { e.target.style.display = "none"; }}
            />
            <div className="field-overlay" style={{ background: "linear-gradient(to top,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.05) 55%)" }} />
            <div className="field-bottom">
              <div className="field-name">{t.fieldName}</div>
              <div className="field-stats">
                <div className="field-stat">{lang === "ms" ? "Jenis" : "Type"}<span className="field-stat-val">{t.fieldType}</span></div>
                <div className="field-stat">{t.nitrogen}<span className="field-stat-val">HD 1080p</span></div>
                <div className="field-stat">{t.phosphorus}<span className="field-stat-val">{avgConfidence ? `${avgConfidence}%` : "—"}</span></div>
                <div className="field-stat">{t.potassium}<span className="field-stat-val">
                  {summary && summary.images_today > 0
                    ? `${((summary.detections_today / summary.images_today) * 100).toFixed(1)}%`
                    : "—"}
                </span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="c5 slide-up" style={{ animationDelay: "0.38s" }}>
          <div className="yield-hero yield-hero--compact" style={{ height: "100%", minHeight: 210 }}>
            <div>
              <div className="yh-label">{t.avgYield} · {t.perHa}</div>
              <div className="yh-number">
                {summary?.avg_yield_kg_per_hectare
                  ? Math.round(summary.avg_yield_kg_per_hectare).toLocaleString()
                  : "—"}
                <span className="yh-unit"> kg/ha</span>
              </div>
              <div className="yh-sub">
                {summary?.avg_yield_kg_per_hectare
                  ? `≈ ${(summary.avg_yield_kg_per_hectare / 1000).toFixed(2)} ${lang === "ms" ? "tan" : "tonnes"} / ${lang === "ms" ? "hektar" : "hectare"}`
                  : ""}
              </div>
            </div>
            <div>
              <div className="yh-trend">↑ XGBoost {t.yieldTrend}</div>
              {(() => {
                const target = 4320;
                const v = summary?.avg_yield_kg_per_hectare || 0;
                const pct = Math.min(100, (v / target) * 100);
                return (
                  <>
                    <div className="yh-bar">
                      <div className="yh-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9.5, color: "rgba(255,255,255,0.30)" }}>
                      <span>0</span>
                      <span style={{ color: "rgba(200,230,60,0.65)", fontWeight: 600 }}>
                        {pct.toFixed(0)}% {t.target}
                      </span>
                      <span>{target.toLocaleString()}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Map + Recent Alerts + Yield Chart */}
      <div className="bento" style={{ marginBottom: 14 }}>
        <div className="c5 slide-up" style={{ animationDelay: "0.46s" }}>
          <div className="card" style={{ padding: 18, height: "100%", minHeight: 280 }}>
            <div className="sec-label">{t.sensorMap}</div>
            <div style={{ height: 240, borderRadius: 12, overflow: "hidden" }}>
              <FieldMap sensors={sensors} t={t} />
            </div>
          </div>
        </div>

        <div className="c3 slide-up" style={{ animationDelay: "0.50s" }}>
          <div className="card" style={{ padding: 18, height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="sec-label" style={{ marginBottom: 0 }}>{t.recentAlerts}</div>
              <Link to="/alerts" className="link-btn">{t.viewAll}</Link>
            </div>
            {alerts.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--text3)", padding: "12px 0" }}>—</div>
            )}
            {alerts.slice(0, 5).map(a => (
              <div key={a.id} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.05)",
              }}>
                <SeverityBadge severity={a.severity} />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: "var(--text)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {lang === "ms" && a.title_ms ? a.title_ms : a.title}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="c4 slide-up" style={{ animationDelay: "0.54s" }}>
          <div className="card" style={{ padding: 18, height: "100%" }}>
            <div className="sec-label">{t.yieldChart}</div>
            <div style={{ height: 230, position: "relative" }}>
              {yieldData.length ? (
                <YieldChart data={yieldData.slice(-20)} color="#c8e63c" height={230} />
              ) : (
                <div style={{ color: "var(--text3)", fontSize: 12, padding: 20 }}>—</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detection table */}
      <div className="bento">
        <div className="c12 slide-up" style={{ animationDelay: "0.58s" }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
              <div className="sec-label" style={{ marginBottom: 0 }}>{t.recentDetections}</div>
              <div style={{ fontSize: 10.5, color: "var(--text3)" }}>
                {summary
                  ? `Showing ${diseases.length} of ${summary.detections_today.toLocaleString()} today`
                  : ""}
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.time}</th>
                  <th>{t.disease}</th>
                  <th>{t.sensor}</th>
                  <th>{t.confidence}</th>
                  <th>{t.severity}</th>
                  <th>{t.action}</th>
                </tr>
              </thead>
              <tbody>
                {diseases.map(d => {
                  const sensorName = sensors.find(s => s.id === d.sensor_id)?.name || "—";
                  const label = d.disease_label || "Healthy";
                  // Prefer ingested_at (true arrival time) so the row label tells you
                  // "X min ago" — predicted_at is backdated for chart spread and
                  // misleads when you're looking for the row you just dropped in.
                  const stamp = d.ingested_at || d.predicted_at;
                  const ageMs = Date.now() - new Date(stamp).getTime();
                  const fresh = ageMs >= 0 && ageMs < 2 * 60 * 1000; // <2min = visibly highlight
                  const ageLbl =
                    ageMs < 60_000          ? "just now" :
                    ageMs < 3_600_000       ? `${Math.round(ageMs / 60_000)} min ago` :
                    ageMs < 86_400_000      ? `${Math.round(ageMs / 3_600_000)} h ago` :
                                              new Date(stamp).toLocaleDateString();
                  return (
                    <tr key={d.id} style={fresh ? { background: "rgba(132,204,22,0.12)" } : undefined}>
                      <td>
                        <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "var(--text2)" }}>
                          {ageLbl}
                        </span>
                        {fresh && (
                          <span style={{
                            marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#15803d",
                            background: "rgba(132,204,22,0.25)", padding: "2px 6px", borderRadius: 8,
                          }}>NEW</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                          {lang === "ms" && d.disease_label_ms ? d.disease_label_ms : label}
                        </div>
                        {lang === "ms" && d.disease_label_ms && (
                          <div style={{ fontSize: 10, color: "var(--text3)" }}>{label}</div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: 12, color: "var(--text2)" }}>{sensorName}</span>
                      </td>
                      <td style={{ minWidth: 130 }}>
                        {d.confidence_score != null
                          ? <ConfBar conf={d.confidence_score} />
                          : <span style={{ color: "var(--text3)" }}>—</span>}
                      </td>
                      <td><SeverityBadge severity={d.severity_level || "none"} /></td>
                      <td>
                        {d.sensor_image_id && d.severity_level !== "none" ? (
                          <a
                            href={annotatedImageUrl(d.sensor_image_id)}
                            target="_blank" rel="noreferrer"
                            className="view-link"
                          >{t.viewImg}</a>
                        ) : <span style={{ color: "var(--text3)", fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

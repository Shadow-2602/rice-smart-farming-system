import { useEffect, useMemo, useState } from "react";
import { useUI } from "../store";
import { getStrings, DISEASE_NAMES } from "../i18n";
import { listDiseases, listYields, listSensors } from "../api/api";
import { YieldChart, DiseaseChart, ConfBar } from "../components/Charts";
import SeverityBadge from "../components/SeverityBadge";

const DISEASE_KEY = {
  "Bacterial Leaf Blight": "BLB",
  "Brown Spot":            "BS",
  "Leaf Blast":            "LB",
  "Sheath Blight":         "SB",
  "Tungro":                "T",
  "Healthy":               "H",
};
const DISEASE_COLOR = {
  "Bacterial Leaf Blight": "#ef4444",
  "Brown Spot":            "#f97316",
  "Leaf Blast":            "#eab308",
  "Sheath Blight":         "#22c55e",
  "Tungro":                "#a78bfa",
  "Healthy":               "#4a9a60",
};

export default function HistoryPage() {
  const lang = useUI((s) => s.lang);
  const t = getStrings(lang);

  const today    = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [start, setStart]     = useState(monthAgo);
  const [end, setEnd]         = useState(today);
  const [diseases, setDiseases] = useState([]);
  const [yields, setYields]   = useState([]);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const params = {
      from: `${start}T00:00:00Z`,
      to:   `${end}T23:59:59Z`,
      page: 1, page_size: 1000,
    };
    try {
      const [d, y, s] = await Promise.all([
        listDiseases(params),
        listYields(params),
        listSensors(),
      ]);
      setDiseases(d.items);
      setYields(y.items);
      setSensors(s);
    } catch (err) {
      setLoadError("Failed to load history — is the backend running?");
      console.error("HistoryPage load failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  /* ─── Derived data ─── */
  const sensorMap = useMemo(() => {
    const m = {};
    for (const s of sensors) m[s.id] = s.name;
    return m;
  }, [sensors]);

  const diseaseHistory = useMemo(() => {
    const buckets = {};
    for (const d of diseases) {
      if (!d.disease_label || d.severity_level === "none") continue;
      const date = d.predicted_at.slice(0, 10);
      const key = DISEASE_KEY[d.disease_label] || "H";
      if (!buckets[date]) buckets[date] = { date, BLB: 0, BS: 0, LB: 0, SB: 0, T: 0, H: 0 };
      buckets[date][key] = (buckets[date][key] || 0) + 1;
    }
    return Object.values(buckets)
      .sort((a, b) => a.date.localeCompare(b.date))    // sort ISO first
      .map(b => ({ ...b, date: new Date(b.date).toLocaleDateString("en-MY", { month: "short", day: "numeric" }) }));
  }, [diseases]);

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
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))           // sort ISO keys first
      .map(([d, b]) => ({
        date: new Date(d).toLocaleDateString("en-MY", { month: "short", day: "numeric" }),
        value: b.n ? Math.round(b.sum / b.n) : 0,
      }));
  }, [yields]);

  const diseaseTotals = useMemo(() => {
    const totals = {};
    for (const name of Object.keys(DISEASE_NAMES)) totals[name] = 0;
    for (const d of diseases) {
      if (d.severity_level === "none" || !d.disease_label) continue;
      totals[d.disease_label] = (totals[d.disease_label] || 0) + 1;
    }
    return totals;
  }, [diseases]);

  /* Quick-stat tiles */
  const totalDetections = diseases.filter(d => d.severity_level !== "none").length;
  const avgYield = yields.length
    ? Math.round(yields.reduce((s, y) => s + (y.predicted_yield_kg_per_hectare || 0), 0)
                  / yields.filter(y => y.predicted_yield_kg_per_hectare).length || 1)
    : null;
  const highSeverity = diseases.filter(d => d.severity_level === "high").length;
  const sensorsUp = sensors.filter(s => s.is_active).length;
  const totalSensors = sensors.length;
  const uptimePct = totalSensors ? Math.round((sensorsUp / totalSensors) * 100) : 0;

  const qs = [
    { lbl: t.detections,  val: totalDetections.toLocaleString(),    sub: `${start} → ${end}`, icon: "🔬" },
    { lbl: t.avgYieldLbl, val: avgYield ? avgYield.toLocaleString() : "—", sub: t.perHa, icon: "🌾" },
    { lbl: t.fCrit,       val: highSeverity.toLocaleString(),       sub: "high-severity events", icon: "🚨" },
    { lbl: "Uptime",      val: `${uptimePct}%`,                     sub: `${sensorsUp} of ${totalSensors} sensors`, icon: "📡" },
  ];

  function exportCSV() {
    const rows = [
      ["timestamp", "type", "sensor", "value", "label"],
      ...diseases.map(d => [d.predicted_at, "disease", sensorMap[d.sensor_id] || d.sensor_id, d.confidence_score, d.disease_label]),
      ...yields.map(y => [y.predicted_at, "yield",   sensorMap[y.sensor_id] || y.sensor_id, y.predicted_yield_kg_per_hectare, ""]),
    ];
    const csv = rows.map(r =>
      r.map(v => `"${(v ?? "").toString().replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rice_history_${start}_${end}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="pg-eyebrow">{t.eyebrow}</div>
      <div className="pg-title">{t.historyLbl}</div>

      <div className="date-picker-row">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)" }}>{t.dateRange}</div>
        <input className="date-input" type="date" value={start} onChange={e => setStart(e.target.value)} />
        <span style={{ fontSize: 12, color: "var(--text3)" }}>{t.to}</span>
        <input className="date-input" type="date" value={end} onChange={e => setEnd(e.target.value)} />
        <button className="btn-primary" onClick={load}>{t.apply}</button>
        <button className="btn-export" onClick={exportCSV}>
          <span>⬇</span>{t.exportCSV}
        </button>
      </div>

      <div className="quick-stats">
        {qs.map((s, i) => (
          <div key={i} className="card kpi-card slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="kpi-icon-wrap" style={{ background: "rgba(74,154,96,0.08)" }}>{s.icon}</div>
            <div className="kpi-lbl">{s.lbl}</div>
            <div className="kpi-val">{s.val}</div>
            <div className="kpi-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="sec-label">{t.disBreak}</div>
        <div className="disease-chips">
          {Object.keys(DISEASE_NAMES).map((en) => {
            const c = DISEASE_COLOR[en];
            const ms = DISEASE_NAMES[en];
            const count = diseaseTotals[en] || 0;
            return (
              <span
                key={en}
                className="disease-chip"
                style={{ background: `${c}14`, color: c, border: `1px solid ${c}2e` }}
              >
                {lang === "ms" ? ms : en} · {count.toLocaleString()}
              </span>
            );
          })}
        </div>
      </div>

      {loadError && (
        <div className="card" style={{ padding: 16, borderLeft: "3px solid #ef4444", marginBottom: 14, color: "#dc2626", fontSize: 13 }}>
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>
          Loading...
        </div>
      ) : (
        <div className="bento">
          <div className="c8 slide-up" style={{ animationDelay: "0.18s" }}>
            <div className="card" style={{ padding: 18 }}>
              <div className="sec-label">{t.disTrend}</div>
              <div style={{ height: 258, position: "relative" }}>
                {diseaseHistory.length
                  ? <DiseaseChart data={diseaseHistory} height={258} />
                  : <div style={{ color: "var(--text3)", padding: 40, textAlign: "center" }}>—</div>}
              </div>
            </div>
          </div>

          <div className="c4 slide-up" style={{ animationDelay: "0.24s" }}>
            <div className="card" style={{ padding: 18, height: "100%" }}>
              <div className="sec-label">{t.yieldOverTime}</div>
              <div style={{ height: 175, position: "relative" }}>
                {yieldData.length
                  ? <YieldChart data={yieldData} color="#c8e63c" height={175} />
                  : <div style={{ color: "var(--text3)", padding: 30, textAlign: "center" }}>—</div>}
              </div>
              <div style={{ marginTop: 12 }}>
                {Object.keys(DISEASE_NAMES).slice(0, 4).map((en) => {
                  const c = DISEASE_COLOR[en];
                  const count = diseaseTotals[en] || 0;
                  return (
                    <div
                      key={en}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--text2)" }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: c, flexShrink: 0 }} />
                        {lang === "ms" ? DISEASE_NAMES[en] : en}
                      </div>
                      <div style={{ fontFamily: "JetBrains Mono", fontSize: 11.5, fontWeight: 600, color: "var(--text2)" }}>
                        {count.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="c12 slide-up" style={{ animationDelay: "0.30s" }}>
            <div className="card" style={{ padding: 18 }}>
              <div className="sec-label" style={{ marginBottom: 13 }}>{t.detHistory} · {start} → {end}</div>
              {diseases.length === 0 ? (
                <div style={{ color: "var(--text3)", padding: 20, textAlign: "center" }}>—</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t.time}</th>
                      <th>{t.disease}</th>
                      <th>{t.sensor}</th>
                      <th>{t.confidence}</th>
                      <th>{t.severity}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diseases.slice(0, 12).map((d, i) => (
                      <tr key={d.id || i}>
                        <td>
                          <span style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: "var(--text2)" }}>
                            {new Date(d.predicted_at).toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {lang === "ms" && d.disease_label_ms ? d.disease_label_ms : d.disease_label || "—"}
                          </div>
                        </td>
                        <td style={{ color: "var(--text2)" }}>{sensorMap[d.sensor_id] || "—"}</td>
                        <td style={{ minWidth: 120 }}>
                          {d.confidence_score != null ? <ConfBar conf={d.confidence_score} /> : "—"}
                        </td>
                        <td><SeverityBadge severity={d.severity_level || "none"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

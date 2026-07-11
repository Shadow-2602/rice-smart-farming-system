import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useUI } from "../store";
import { getStrings } from "../i18n";
import {
  getSensor, listDiseases, listYields, annotatedImageUrl,
} from "../api/api";
import SeverityBadge from "../components/SeverityBadge";
import { YieldChart, ConfBar, ZoneBadge } from "../components/Charts";

export default function SensorDetailPage() {
  const { id } = useParams();
  const lang = useUI((s) => s.lang);
  const t = getStrings(lang);

  const [sensor, setSensor]     = useState(null);
  const [diseases, setDiseases] = useState([]);
  const [yields, setYields]     = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [s, d, y] = await Promise.all([
          getSensor(id),
          // sort=recent → orders by sensor_images.created_at (ingestion time) so
          // freshly arrived detections appear first regardless of their
          // backdated capture date.
          listDiseases({ sensor_id: id, page: 1, page_size: 30, sort: "recent" }),
          listYields({ sensor_id: id, page: 1, page_size: 100 }),
        ]);
        setSensor(s);
        setDiseases(d.items);
        setYields(y.items);
      } catch (err) { console.error("Sensor load failed:", err); }
    }
    load();
  }, [id]);

  const yieldData = useMemo(() => yields
    .filter(y => y.predicted_yield_kg_per_hectare != null)
    .slice()
    // sort by raw timestamp BEFORE formatting — string-sorted "10 May" would
    // come before "3 May" because '1' < '3' lexicographically.
    .sort((a, b) => a.predicted_at.localeCompare(b.predicted_at))
    .map(y => ({
      date: new Date(y.predicted_at).toLocaleDateString("en-MY", { month: "short", day: "numeric" }),
      value: y.predicted_yield_kg_per_hectare,
    }))
    .slice(-30),
  [yields]);

  const avgYield = useMemo(() => {
    const valid = yields.filter(y => y.predicted_yield_kg_per_hectare);
    if (!valid.length) return null;
    return Math.round(valid.reduce((s, y) => s + y.predicted_yield_kg_per_hectare, 0) / valid.length);
  }, [yields]);

  if (!sensor) {
    return (
      <div className="card" style={{ padding: 40, marginTop: 30, textAlign: "center", color: "var(--text3)" }}>
        Loading...
      </div>
    );
  }

  const galleryRows = diseases
    .filter(d => d.sensor_image_id && d.severity_level !== "none")
    .slice(0, 12);

  return (
    <div>
      <div className="pg-eyebrow">{t.eyebrow}</div>
      <Link to="/sensors" className="back-btn">{t.back}</Link>

      <div className="card" style={{
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 13, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
            {sensor.name}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 3 }}>
            {sensor.location_name} · {sensor.latitude?.toFixed(4)}°N, {sensor.longitude?.toFixed(4)}°E
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <ZoneBadge zone={sensor.field_zone} />
          <span className={`status-pill ${sensor.is_active ? "status-active" : "status-inactive"}`}>
            {sensor.is_active && (
              <div className="active-dot-wrap" style={{ width: 7, height: 7 }}>
                <div className="active-dot" style={{ width: 7, height: 7 }} />
                <div className="active-ring" />
              </div>
            )}
            {sensor.is_active ? t.active : t.inactive}
          </span>
        </div>
      </div>

      {/* Info tiles */}
      <div className="info-tiles">
        {[
          { lbl: t.zone,   val: sensor.field_zone || "—",                                                        mono: false },
          { lbl: t.coords, val: `${sensor.latitude?.toFixed(4) ?? "—"}°N\n${sensor.longitude?.toFixed(4) ?? "—"}°E`, mono: true  },
          { lbl: t.sensorYield, val: avgYield ? `${avgYield.toLocaleString()} kg/ha` : "—",                       mono: true  },
        ].map((x, i) => (
          <div key={i} className="card info-tile slide-up" style={{ animationDelay: `${0.06 + i * 0.06}s` }}>
            <div className="tile-label">{x.lbl}</div>
            <div
              className="tile-value"
              style={{
                fontFamily: x.mono ? "JetBrains Mono" : "Inter",
                fontSize: x.mono ? 14 : 17,
                whiteSpace: "pre-line",
              }}
            >{x.val}</div>
          </div>
        ))}
      </div>

      {/* Yield chart */}
      <div className="card" style={{ padding: 18, marginBottom: 13 }}>
        <div className="sec-label">{t.yieldChart} — {sensor.name}</div>
        <div style={{ height: 175, position: "relative" }}>
          {yieldData.length
            ? <YieldChart data={yieldData} height={175} />
            : <div style={{ color: "var(--text3)", fontSize: 12, padding: 40, textAlign: "center" }}>—</div>}
        </div>
      </div>

      {/* Image gallery */}
      <div className="card" style={{ padding: 18, marginBottom: 13 }}>
        <div className="sec-label" style={{ marginBottom: 13 }}>{t.imgGallery}</div>
        {galleryRows.length === 0 ? (
          <div style={{ color: "var(--text3)", fontSize: 12, padding: 20, textAlign: "center" }}>—</div>
        ) : (
          <div className="img-gallery">
            {galleryRows.map((d) => {
              const conf = Math.round((d.confidence_score || 0) * 100);
              const label = lang === "ms" && d.disease_label_ms ? d.disease_label_ms : d.disease_label;
              const sevColor = d.severity_level === "high" ? "#ef4444"
                            : d.severity_level === "medium" ? "#f97316"
                            : "#eab308";
              return (
                <a
                  key={d.id}
                  className="gallery-item"
                  href={annotatedImageUrl(d.sensor_image_id)}
                  target="_blank" rel="noreferrer"
                >
                  <img
                    className="gallery-img"
                    src={annotatedImageUrl(d.sensor_image_id)}
                    alt={label}
                    loading="lazy"
                  />
                  <div className="gallery-label" style={{ background: `linear-gradient(transparent, ${sevColor}cc)` }}>
                    {label} · {conf}%
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Detection history */}
      <div className="card" style={{ padding: 18 }}>
        <div className="sec-label" style={{ marginBottom: 13 }}>{t.detHistory}</div>
        {diseases.length === 0 ? (
          <div style={{ color: "var(--text3)", fontSize: 12, padding: 20, textAlign: "center" }}>—</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.time}</th>
                <th>{t.disease}</th>
                <th>{t.confidence}</th>
                <th>{t.severity}</th>
              </tr>
            </thead>
            <tbody>
              {diseases.slice(0, 20).map(d => {
                // Prefer ingested_at (true arrival) so freshly dropped images
                // show "just now" instead of their backdated capture time.
                const stamp = d.ingested_at || d.predicted_at;
                const ageMs = Date.now() - new Date(stamp).getTime();
                const fresh = ageMs >= 0 && ageMs < 2 * 60 * 1000;
                const ageLbl =
                  ageMs < 60_000     ? "just now" :
                  ageMs < 3_600_000  ? `${Math.round(ageMs / 60_000)} min ago` :
                  ageMs < 86_400_000 ? `${Math.round(ageMs / 3_600_000)} h ago` :
                                       new Date(stamp).toLocaleString();
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
                      <div style={{ fontWeight: 600 }}>
                        {lang === "ms" && d.disease_label_ms ? d.disease_label_ms : d.disease_label || "—"}
                      </div>
                    </td>
                    <td>
                      {d.confidence_score != null
                        ? <ConfBar conf={d.confidence_score} />
                        : <span style={{ color: "var(--text3)" }}>—</span>}
                    </td>
                    <td><SeverityBadge severity={d.severity_level || "none"} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

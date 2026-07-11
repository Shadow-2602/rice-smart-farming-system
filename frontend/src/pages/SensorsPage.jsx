import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUI } from "../store";
import { getStrings } from "../i18n";
import { listSensors } from "../api/api";
import { ZoneBadge } from "../components/Charts";

export default function SensorsPage() {
  const lang = useUI((s) => s.lang);
  const t = getStrings(lang);
  const [sensors, setSensors] = useState(null);

  useEffect(() => {
    listSensors().then(setSensors).catch(() => setSensors([]));
  }, []);

  return (
    <div>
      <div className="pg-eyebrow">{t.eyebrow}</div>
      <div className="pg-title">{t.sensorsLbl}</div>

      {sensors === null ? (
        <div className="sensors-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card sensor-card" style={{ height: 180 }} />
          ))}
        </div>
      ) : sensors.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>
          {t.dashSub}
        </div>
      ) : (
        <div className="sensors-grid">
          {sensors.map((s, i) => {
            const zoneLetter = (s.field_zone || "A").replace(/^Zone\s*/i, "").charAt(0);
            const bg = zoneLetter === "A" ? "rgba(74,154,96,0.10)"
                     : zoneLetter === "B" ? "rgba(234,179,8,0.10)"
                     : "rgba(249,115,22,0.10)";
            return (
              <Link
                key={s.id}
                to={`/sensors/${s.id}`}
                className="card sensor-card slide-up"
                style={{ animationDelay: `${i * 0.04}s`, textDecoration: "none", color: "inherit" }}
              >
                <div className="sensor-icon-bg" style={{ background: bg }}>📡</div>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text)", marginBottom: 5 }}>
                  {s.name}
                </div>
                <ZoneBadge zone={s.field_zone} />
                <div style={{ fontSize: 11, color: "var(--text3)", fontFamily: "JetBrains Mono", marginTop: 8 }}>
                  {s.latitude?.toFixed(4)}°N, {s.longitude?.toFixed(4)}°E
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>{s.location_name}</div>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginTop: 12,
                }}>
                  {s.is_active ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#16a34a" }}>
                      <div className="active-dot-wrap">
                        <div className="active-dot" />
                        <div className="active-ring" />
                      </div>
                      {t.active}
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "var(--text3)" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#e5e7eb" }} />
                      {t.inactive}
                    </div>
                  )}
                  <span className="view-link">{t.viewAll} →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

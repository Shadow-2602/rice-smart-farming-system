import { useEffect, useState } from "react";
import { useUI } from "../store";
import { getStrings } from "../i18n";
import { listAlerts, markAlertRead, dismissAlert, markAllAlertsRead } from "../api/api";
import SeverityBadge from "../components/SeverityBadge";

export default function AlertsPage() {
  const lang = useUI((s) => s.lang);
  const t = getStrings(lang);

  const [filter, setFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = { page, page_size: pageSize, is_dismissed: false };
    if (filter === "critical") params.severity = "critical";
    if (filter === "warning")  params.severity = "warning";
    if (filter === "info")     params.severity = "info";
    if (unreadOnly) params.is_read = false;
    try {
      const res = await listAlerts(params);
      setData(res);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, unreadOnly, page]);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const summary = data.items;
  const unreadCrit = summary.filter(a => a.severity === "critical" && !a.is_read).length;
  const unreadWarn = summary.filter(a => a.severity === "warning"  && !a.is_read).length;

  function chipClass(id) {
    if (id !== filter) return "chip";
    if (id === "critical") return "chip ch-critical";
    if (id === "warning")  return "chip ch-warning";
    if (id === "info")     return "chip ch-info";
    return "chip ch-active";
  }

  async function handleRead(id)    { await markAlertRead(id); load(); }
  async function handleDismiss(id) { await dismissAlert(id);  load(); }

  async function handleReadAll() {
    // Honour the current severity filter — don't silently clear alerts
    // outside what the user is looking at.
    const params = {};
    if (filter !== "all") {
      if (filter === "critical" || filter === "warning" || filter === "info") {
        params.severity = filter;
      }
    }
    await markAllAlertsRead(params);
    load();
  }

  // Total unread visible under the current filter — used to disable the button
  const visibleUnread = data.items.filter(a => !a.is_read).length;

  return (
    <div>
      <div className="pg-eyebrow">{t.eyebrow}</div>
      <div className="pg-title-row">
        <div className="pg-title" style={{ marginBottom: 0 }}>{t.alertsLbl}</div>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          <span className="badge badge-high"><span className="badge-dot" />{unreadCrit} {t.fCrit}</span>
          <span className="badge badge-medium"><span className="badge-dot" />{unreadWarn} {t.fWarn}</span>
          <button
            className="btn-sm btn-mark"
            disabled={visibleUnread === 0}
            onClick={handleReadAll}
            style={{ marginLeft: 4 }}
          >
            ✓ {t.markAllRead}
          </button>
        </div>
      </div>

      <div className="filter-chips">
        {[
          { id: "all",      lbl: t.fAll  },
          { id: "critical", lbl: t.fCrit },
          { id: "warning",  lbl: t.fWarn },
          { id: "info",     lbl: t.fInfo },
        ].map(c => (
          <button
            key={c.id}
            className={chipClass(c.id)}
            onClick={() => { setFilter(c.id); setPage(1); }}
          >{c.lbl}</button>
        ))}
        <button
          className="toggle-chip"
          style={{
            background: unreadOnly ? "rgba(22,163,74,0.08)" : "rgba(255,255,255,0.7)",
            borderColor: unreadOnly ? "rgba(22,163,74,0.28)" : "rgba(0,0,0,0.10)",
            color:       unreadOnly ? "#16a34a" : "var(--text2)",
          }}
          onClick={() => { setUnreadOnly(v => !v); setPage(1); }}
        >
          <div style={{
            width: 13, height: 13, borderRadius: 4,
            border: "2px solid currentColor",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700,
          }}>{unreadOnly && "✓"}</div>
          {t.unreadOnly}
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>
          Loading...
        </div>
      ) : data.items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text3)", fontSize: 14 }}>
          No alerts match the current filter.
        </div>
      ) : (
        data.items.map((a, i) => (
          <div
            key={a.id}
            className="card alert-card-full slide-up"
            style={{ animationDelay: `${i * 0.05}s`, opacity: a.is_read ? 0.72 : 1 }}
          >
            <SeverityBadge severity={a.severity} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--text)" }}>
                  {lang === "ms" && a.title_ms ? a.title_ms : a.title}
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", whiteSpace: "nowrap" }}>
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
              {(a.message || a.message_ms) && (
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4, lineHeight: 1.5 }}>
                  {lang === "ms" && a.message_ms ? a.message_ms : a.message}
                </div>
              )}
              <div className="alert-actions">
                {!a.is_read && (
                  <button className="btn-sm btn-mark" onClick={() => handleRead(a.id)}>
                    {t.markRead}
                  </button>
                )}
                <button className="btn-sm btn-dismiss" onClick={() => handleDismiss(a.id)}>
                  {t.dismiss}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {!loading && data.items.length > 0 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >‹</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              className={`page-btn ${p === page ? "active" : ""}`}
              onClick={() => setPage(p)}
            >{p}</button>
          ))}
          {totalPages > 5 && <span className="page-btn" style={{ border: "none", background: "none" }}>…</span>}
          <button
            className="page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >›</button>
        </div>
      )}
    </div>
  );
}

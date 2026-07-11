import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useUI } from "../store";
import { t } from "../i18n";
import { listAlerts } from "../api/api";

const NAV = [
  { to: "/",         key: "dashboard" },
  { to: "/sensors",  key: "sensors"   },
  { to: "/alerts",   key: "alerts"    },
  { to: "/history",  key: "history"   },
  { to: "/advisory", key: "advisory"  },
];

export default function Layout() {
  const { lang, setLang } = useUI();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(null);

  // Refresh unread alert count every 30s for the badge in the nav
  useEffect(() => {
    const tick = () =>
      listAlerts({ is_read: false, is_dismissed: false, page: 1, page_size: 1 })
        .then(r => setUnreadCount(r.total))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date().toLocaleDateString("en-MY", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="app">
      <nav className="topnav">
        <div className="nav-logo">
          <div className="nav-logo-icon">🌾</div>
          <div className="nav-logo-name">
            {lang === "ms" ? "Pertanian Padi Pintar" : "Rice Smart Farming"}
          </div>
        </div>

        <div className="nav-links">
          {NAV.map((n) => {
            const isActive =
              n.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(n.to);
            const showBadge = n.key === "alerts" && unreadCount > 0;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={`nav-link ${isActive ? "active" : ""}`}
                end={n.to === "/"}
              >
                {t(n.key, lang)}
                {showBadge ? ` (${unreadCount})` : ""}
              </NavLink>
            );
          })}
        </div>

        <div className="nav-right">
          <div style={{ fontSize: "12px", color: "var(--text3)", fontWeight: 500 }}>
            {today}
          </div>
          <div className="live-pill">
            <div className="live-dot"></div>
            {lang === "ms" ? "Sistem Langsung" : "System Live"}
          </div>
          <div className="lang-toggle">
            <button
              className={`lang-btn ${lang === "en" ? "active" : ""}`}
              onClick={() => setLang("en")}
            >
              EN
            </button>
            <button
              className={`lang-btn ${lang === "ms" ? "active" : ""}`}
              onClick={() => setLang("ms")}
            >
              MS
            </button>
          </div>
        </div>
      </nav>

      <div className="content">
        <Outlet />
      </div>
    </div>
  );
}

/**
 * Bento card system for the 2026 redesign — glass-morphism cards with
 * exaggerated rounding, soft shadows, and subtle hover lift.
 *
 * The file keeps the old export names (Card, CardHeader, Skeleton, EmptyState)
 * for backwards compatibility but each is reskinned.
 */

export function Card({ children, className = "", hover = true, hero = false }) {
  if (hero) {
    return (
      <div className={`bento-hero ${className}`}>{children}</div>
    );
  }
  return (
    <div className={`bento ${hover ? "bento-hover" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, accent = false }) {
  return (
    <div className="px-5 lg:px-6 pt-5 pb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className={`text-[11px] uppercase tracking-[0.14em] font-semibold ${accent ? "text-glow-500" : "text-slate-500"}`}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }) {
  return <div className={`animate-pulse bg-slate-200/60 rounded-lg ${className}`} />;
}

export function EmptyState({ message }) {
  return (
    <div className="text-center text-slate-400 py-12 text-sm">
      <div className="text-3xl mb-2 opacity-40">∅</div>
      {message}
    </div>
  );
}

/**
 * Big KPI tile — small label, huge bold number, optional sub-label.
 * Used in the dashboard stat row.
 */
export function StatTile({ label, value, sublabel, icon, tone = "default" }) {
  const tones = {
    default:  "text-forest-900",
    accent:   "text-rice-700",
    danger:   "text-rose-600",
    info:     "text-sky-700",
  };
  return (
    <div className="px-5 lg:px-6 py-5 h-full flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-500">
          {label}
        </div>
        {icon && (
          <div className="text-slate-300 group-hover:text-forest-500 transition-colors">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className={`text-3xl lg:text-4xl font-bold tracking-tight tabular ${tones[tone]}`}>
          {value}
        </div>
        {sublabel && (
          <div className="text-xs text-slate-400 mt-1">{sublabel}</div>
        )}
      </div>
    </div>
  );
}

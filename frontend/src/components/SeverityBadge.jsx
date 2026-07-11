/**
 * Pill badge using the design's `.badge` + `.badge-{healthy,low,medium,high}` CSS.
 * Maps backend severity strings into the design's 4-level scale:
 *   none → healthy, low → low, medium → medium, high → high
 *   info → low, warning → medium, critical → high
 */
import { useUI } from "../store";
import { getStrings } from "../i18n";

const REMAP = {
  none: "healthy",
  low: "low",
  medium: "medium",
  high: "high",
  info: "low",
  warning: "medium",
  critical: "high",
};

export default function SeverityBadge({ severity }) {
  const lang = useUI((s) => s.lang);
  const t = getStrings(lang);
  const level = REMAP[severity] || "low";
  return (
    <span className={`badge badge-${level}`}>
      <span className="badge-dot" />
      {t.sev[level]}
    </span>
  );
}

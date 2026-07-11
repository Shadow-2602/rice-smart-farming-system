/**
 * Chart.js wrappers — line area + stacked bar — styled to match Claude Design.
 */
import { useEffect, useRef } from "react";
import {
  Chart, LineController, BarController, LineElement, BarElement,
  PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend,
} from "chart.js";

Chart.register(
  LineController, BarController, LineElement, BarElement,
  PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend,
);

/* ────── Yield (area) chart ────── */
export function YieldChart({ data, color = "#a8cc20", height = 175 }) {
  const ref = useRef(null);
  const ci  = useRef(null);

  useEffect(() => {
    if (ci.current) ci.current.destroy();
    if (!ref.current) return;
    const ctx = ref.current.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, `${color}35`);
    g.addColorStop(1, `${color}00`);

    ci.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map(d => d.date),
        datasets: [{
          data: data.map(d => d.value),
          borderColor: color,
          borderWidth: 2,
          fill: true,
          backgroundColor: g,
          tension: 0.45,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: color,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#fff",
            borderColor: "rgba(0,0,0,0.10)", borderWidth: 1,
            titleColor: "#6b7280", bodyColor: "#1a1a1a",
            bodyFont:  { family: "JetBrains Mono", size: 13, weight: "700" },
            titleFont: { family: "Inter", size: 10 },
            callbacks: { label: ctx => `${ctx.raw.toLocaleString()} kg/ha` },
            cornerRadius: 10, padding: 10,
          },
        },
        scales: {
          x: {
            grid: { display: false }, border: { display: false },
            ticks: { color: "#9ca3af", font: { family: "Inter", size: 10 }, maxTicksLimit: 8 },
          },
          y: {
            grid: { color: "rgba(0,0,0,0.04)" }, border: { display: false },
            ticks: { color: "#9ca3af", font: { family: "JetBrains Mono", size: 10 } },
          },
        },
      },
    });

    return () => { if (ci.current) ci.current.destroy(); };
  }, [data, color, height]);

  return <canvas ref={ref} style={{ width: "100%", height: `${height}px` }} />;
}

/* ────── Disease (stacked bar) chart ────── */
export function DiseaseChart({ data, height = 220 }) {
  const ref = useRef(null);
  const ci  = useRef(null);

  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#a78bfa", "#6bc4b8"];
  const keys   = ["BLB", "BS", "LB", "SB", "T", "H"];
  const labels = ["Bacterial Leaf Blight", "Brown Spot", "Leaf Blast", "Sheath Blight", "Tungro", "Healthy"];

  useEffect(() => {
    if (ci.current) ci.current.destroy();
    if (!ref.current) return;
    const ctx = ref.current.getContext("2d");
    ci.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(d => d.date),
        datasets: keys.map((k, i) => ({
          label: labels[i],
          data:  data.map(d => d[k] || 0),
          backgroundColor: `${colors[i]}cc`,
          borderRadius: 2,
          stack: "s",
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { font: { family: "Inter", size: 10 }, boxWidth: 9, color: "#6b7280", padding: 12 } },
          tooltip: {
            backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.10)", borderWidth: 1,
            titleColor: "#6b7280", bodyColor: "#1a1a1a",
            titleFont: { family: "Inter", size: 10 }, bodyFont: { family: "Inter", size: 11 },
            cornerRadius: 10, padding: 10,
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: "#9ca3af", font: { family: "Inter", size: 10 } } },
          y: { stacked: true, grid: { color: "rgba(0,0,0,0.04)" }, border: { display: false }, ticks: { color: "#9ca3af", font: { family: "JetBrains Mono", size: 10 } } },
        },
      },
    });

    return () => { if (ci.current) ci.current.destroy(); };
  }, [data]);

  return <canvas ref={ref} style={{ width: "100%", height: `${height}px` }} />;
}

/* ────── Confidence bar ────── */
export function ConfBar({ conf }) {
  const pct = Math.max(0, Math.min(100, Math.round(conf * 100)));
  const c = pct >= 85 ? "#ef4444" : pct >= 70 ? "#f97316" : "#eab308";
  return (
    <div className="conf-bar-wrap">
      <div className="conf-bar">
        <div className="conf-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg,#a8cc20,${c})` }} />
      </div>
      <span className="conf-pct">{pct}%</span>
    </div>
  );
}

/* ────── Zone badge ────── */
export function ZoneBadge({ zone }) {
  // zone may come as "Zone A" or just "A"
  const letter = zone?.replace(/^Zone\s*/i, "").trim().toUpperCase().charAt(0) || "A";
  const cls = letter === "A" ? "zone-a" : letter === "B" ? "zone-b" : "zone-c";
  return <span className={`zone-badge ${cls}`}>Zone {letter}</span>;
}

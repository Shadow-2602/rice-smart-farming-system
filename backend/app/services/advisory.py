"""
Advisory service — pulls live context from MySQL and streams chat completions
from a locally-running Ollama instance (LLaMA 3 by default).

Architecture:
  user message --[router]--> build_context(db) ──> system prompt
                                                        │
                                                        ▼
                                            Ollama HTTP /api/chat (stream)
                                                        │
                                                        ▼
                                              SSE-style stream → frontend

The system prompt embeds field telemetry so the LLM can answer questions like
"what disease is most common right now?" with real, current numbers — not
hallucinated ones — and still leverage its general agronomic knowledge.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Iterator

import httpx
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.prediction import Alert, DiseaseDetection, YieldPrediction
from app.models.sensor import Sensor

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------

def build_context(db: Session) -> dict:
    """Snapshot of the current field state for prompt injection."""
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=None
    )

    sensors = db.execute(select(Sensor)).scalars().all()
    sensor_name_by_id = {s.id: s.name for s in sensors}
    zones: dict[str, int] = {}
    for s in sensors:
        z = s.field_zone or "Unassigned"
        zones[z] = zones.get(z, 0) + 1

    # Recent disease detections (non-healthy)
    recent_detections = db.execute(
        select(DiseaseDetection)
        .where(DiseaseDetection.severity_level != "none")
        .order_by(desc(DiseaseDetection.predicted_at))
        .limit(8)
    ).scalars().all()

    # Avg yield across sensors
    avg_yield = db.execute(
        select(func.avg(YieldPrediction.predicted_yield_kg_per_hectare))
    ).scalar()
    avg_yield = float(avg_yield) if avg_yield else None

    # Aggregate counts
    detections_today = db.execute(
        select(func.count())
        .select_from(DiseaseDetection)
        .where(DiseaseDetection.predicted_at >= today_start)
        .where(DiseaseDetection.severity_level != "none")
    ).scalar_one()

    most_common = db.execute(
        select(DiseaseDetection.disease_label, func.count().label("n"))
        .where(DiseaseDetection.disease_label.is_not(None))
        .where(DiseaseDetection.severity_level != "none")
        .group_by(DiseaseDetection.disease_label)
        .order_by(desc("n"))
        .limit(3)
    ).all()

    critical_unread = db.execute(
        select(func.count()).select_from(Alert)
        .where(Alert.severity == "critical")
        .where(Alert.is_read.is_(False))
        .where(Alert.is_dismissed.is_(False))
    ).scalar_one()

    warning_unread = db.execute(
        select(func.count()).select_from(Alert)
        .where(Alert.severity == "warning")
        .where(Alert.is_read.is_(False))
        .where(Alert.is_dismissed.is_(False))
    ).scalar_one()

    return {
        "sensors_total":        len(sensors),
        "sensors_active":       sum(1 for s in sensors if s.is_active),
        "zones":                zones,
        "detections_today":     detections_today,
        "top_diseases":         [{"label": r[0], "count": r[1]} for r in most_common],
        "avg_yield_kg_per_ha":  round(avg_yield, 1) if avg_yield else None,
        "critical_alerts":      critical_unread,
        "warning_alerts":       warning_unread,
        "recent_detections": [
            {
                "sensor": sensor_name_by_id.get(d.sensor_id, "Unknown"),
                "disease": d.disease_label,
                "confidence_pct": round((d.confidence_score or 0) * 100, 1),
                "severity": d.severity_level,
                "when": d.predicted_at.isoformat(timespec="minutes") if d.predicted_at else None,
            }
            for d in recent_detections
        ],
    }


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_EN = """\
You are a knowledgeable AI advisor for a Malaysian rice farm (paddy). Your job
is to help the farmer make practical decisions about their field — disease
treatment, yield management, sensor monitoring — using the live telemetry below.

────────── CURRENT FIELD STATUS ──────────
Sensors: {sensors_active}/{sensors_total} active across {n_zones} zones ({zone_summary})
Disease detections today: {detections_today}
Most common diseases (all-time): {top_diseases_str}
Average yield prediction: {avg_yield_str}
Unread alerts: {critical_alerts} critical, {warning_alerts} warning

────────── LATEST 8 DETECTIONS (newest first) ──────────
{recent_detections_str}

────────── INSTRUCTIONS ──────────
- When the farmer asks about specific sensors, diseases, or stats, use the
  numbers above. Never invent data.
- Be concrete and actionable. If you recommend a treatment, name the active
  ingredient and dosage range typical for Malaysian paddy.
- Cite specific sensor names ("Sensor 3", "Zone A") when relevant.
- If you don't know something, say so plainly — don't guess.
- Keep replies under 200 words unless the farmer asks for detail.
- Reply in English.
"""

SYSTEM_PROMPT_MS = """\
Anda ialah penasihat AI untuk ladang padi di Malaysia. Tugas anda ialah
membantu petani membuat keputusan praktikal mengenai sawah mereka — rawatan
penyakit, pengurusan hasil, pemantauan sensor — menggunakan telemetri langsung di bawah.

────────── STATUS LADANG SEMASA ──────────
Sensor: {sensors_active}/{sensors_total} aktif di {n_zones} zon ({zone_summary})
Pengesanan penyakit hari ini: {detections_today}
Penyakit paling biasa: {top_diseases_str}
Ramalan hasil purata: {avg_yield_str}
Amaran belum dibaca: {critical_alerts} kritikal, {warning_alerts} amaran

────────── 8 PENGESANAN TERKINI (terbaru dahulu) ──────────
{recent_detections_str}

────────── ARAHAN ──────────
- Apabila petani bertanya mengenai sensor, penyakit, atau statistik tertentu,
  gunakan nombor di atas. Jangan reka data.
- Berikan jawapan konkrit dan praktikal. Jika anda mengesyorkan rawatan,
  nyatakan bahan aktif dan julat dos biasa untuk padi Malaysia.
- Sebut nama sensor khusus ("Sensor 3", "Zon A") apabila relevan.
- Jika anda tidak tahu sesuatu, katakan terus terang — jangan teka.
- Kekalkan jawapan di bawah 200 perkataan melainkan petani meminta perincian.
- Jawab dalam Bahasa Malaysia.
"""


def render_system_prompt(ctx: dict, lang: str = "en") -> str:
    template = SYSTEM_PROMPT_MS if lang == "ms" else SYSTEM_PROMPT_EN
    zone_summary = ", ".join(f"{z}={n}" for z, n in ctx["zones"].items())

    top_diseases_str = (
        ", ".join(f"{d['label']} ({d['count']})" for d in ctx["top_diseases"]) or "none"
    )
    avg_yield_str = (
        f"{ctx['avg_yield_kg_per_ha']:,} kg/ha (≈ {ctx['avg_yield_kg_per_ha']/1000:.2f} t/ha)"
        if ctx["avg_yield_kg_per_ha"] else "no yield data yet"
    )

    if ctx["recent_detections"]:
        recent_lines = []
        for r in ctx["recent_detections"]:
            recent_lines.append(
                f"  • {r['when']} — {r['sensor']}: {r['disease']} "
                f"({r['confidence_pct']}% conf, severity={r['severity']})"
            )
        recent_str = "\n".join(recent_lines)
    else:
        recent_str = "  (no recent detections)"

    return template.format(
        sensors_active=ctx["sensors_active"],
        sensors_total=ctx["sensors_total"],
        n_zones=len(ctx["zones"]),
        zone_summary=zone_summary,
        detections_today=ctx["detections_today"],
        top_diseases_str=top_diseases_str,
        avg_yield_str=avg_yield_str,
        critical_alerts=ctx["critical_alerts"],
        warning_alerts=ctx["warning_alerts"],
        recent_detections_str=recent_str,
    )


# ---------------------------------------------------------------------------
# Ollama client
# ---------------------------------------------------------------------------

def stream_chat(messages: list[dict], lang: str, db: Session) -> Iterator[str]:
    """
    Generator that yields plain-text chunks from Ollama. Injects a fresh
    system prompt built from the live database snapshot.
    """
    ctx = build_context(db)
    system_prompt = render_system_prompt(ctx, lang)

    full_messages = [{"role": "system", "content": system_prompt}] + messages
    payload = {
        "model":    settings.OLLAMA_MODEL,
        "messages": full_messages,
        "stream":   True,
    }

    url = f"{settings.OLLAMA_URL.rstrip('/')}/api/chat"

    try:
        with httpx.stream("POST", url, json=payload, timeout=120.0) as r:
            if r.status_code != 200:
                body = b"".join(r.iter_bytes()).decode("utf-8", errors="replace")
                logger.error(f"Ollama returned {r.status_code}: {body}")
                yield (
                    f"[Error] Ollama responded with status {r.status_code}. "
                    f"Make sure the model '{settings.OLLAMA_MODEL}' is pulled "
                    f"(`ollama pull {settings.OLLAMA_MODEL}`)."
                )
                return

            for line in r.iter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msg = data.get("message", {})
                chunk = msg.get("content", "")
                if chunk:
                    yield chunk
                if data.get("done"):
                    break
    except httpx.ConnectError:
        yield (
            f"[Error] Cannot reach Ollama at {settings.OLLAMA_URL}. "
            f"Start it with `ollama serve` and ensure the model is pulled "
            f"(`ollama pull {settings.OLLAMA_MODEL}`)."
        )
    except httpx.ReadTimeout:
        yield "[Error] Ollama timed out generating a response."
    except Exception as exc:
        logger.exception("Unhandled error talking to Ollama")
        yield f"[Error] {exc}"


def health_check() -> dict:
    """Quick probe to tell the frontend whether Ollama is reachable."""
    try:
        r = httpx.get(f"{settings.OLLAMA_URL.rstrip('/')}/api/tags", timeout=3.0)
        if r.status_code == 200:
            tags = r.json().get("models", [])
            names = [m.get("name") for m in tags]
            return {
                "ok": True,
                "model": settings.OLLAMA_MODEL,
                "model_loaded": any(
                    n == settings.OLLAMA_MODEL or n.startswith(f"{settings.OLLAMA_MODEL}:")
                    for n in names
                ),
                "available": names,
            }
        return {"ok": False, "error": f"Ollama responded {r.status_code}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

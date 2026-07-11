"""
Background watcher — periodically scans the configured WATCH_DIR for new
image files and ingests them into MySQL + the AI pipeline.

Folder structure inside WATCH_DIR is treated as a SOURCE OF TEST IMAGES ONLY.
It does NOT define sensor topology — sensors are configured separately via
FIELD_LAYOUT (see app/services/topology.py). Each new image is randomly
assigned to one of the active sensors so the demo data is spread across the
whole field.

De-duplication: each row in sensor_images stores `original_path`. Files
already present in the DB are skipped on subsequent scans.
"""
import logging
import os
import random
import shutil
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.sensor import Sensor
from app.models.sensor_image import SensorImage

logger = logging.getLogger(__name__)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

_thread: threading.Thread | None = None
_stop_event = threading.Event()
_last_scan_at: datetime | None = None
_last_result: dict | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sample_malaysian_weather() -> dict:
    """Realistic ranges for tropical Malaysian rice-growing regions."""
    return {
        "temperature":            round(random.uniform(24, 33), 1),
        "pressure":               round(random.uniform(1008, 1014), 1),
        "dew_point":              round(random.uniform(22, 26), 1),
        "humidity":               round(random.uniform(70, 95), 1),
        "wind_speed":             round(random.uniform(2, 12), 1),
        "gust":                   round(random.uniform(4, 20), 1),
        "wind_chill":             round(random.uniform(24, 32), 1),
        "uv_index":               round(random.uniform(4, 11), 1),
        "feels_like_temperature": round(random.uniform(26, 38), 1),
        "visibility":             round(random.uniform(8, 15), 1),
        "solar_radiation":        round(random.uniform(150, 900), 1),
        "pollutant_value":        round(random.uniform(20, 80), 1),
        "precipitation_rate":     round(random.uniform(0, 5), 2),
        "precipitation_total":    round(random.uniform(0, 25), 2),
    }


def _ingest(db: Session, sensor: Sensor, source: Path) -> None:
    image_id = str(uuid.uuid4())
    dest_dir = settings.raw_path / str(sensor.id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{image_id}{source.suffix.lower()}"
    shutil.copy2(source, dest)

    weather = _sample_malaysian_weather()
    # Backdate captured_at to a random moment in the last 30 days so the dashboard
    # charts have a real spread of capture history. Without this every new image
    # would clump on "today" and the time-series charts would flatten over time.
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    captured_at = now_utc - timedelta(seconds=random.uniform(0, 30 * 86_400))

    record = SensorImage(
        id=image_id,
        sensor_id=sensor.id,
        file_path=str(dest.resolve()),
        original_path=str(source.resolve()),
        captured_at=captured_at,
        is_processed=False,
        **weather,
    )
    db.add(record)
    db.commit()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def scan_once() -> dict:
    """Scan the watch folder, ingest any new files, then trigger the pipeline.
    Safe to call manually (e.g. from an HTTP endpoint)."""
    from worker.pipeline import run_once  # local import avoids circular dep

    watch_dir = Path(settings.WATCH_DIR)
    if not watch_dir.is_dir():
        return {"new_images": 0, "processed": 0, "error": f"WATCH_DIR not found: {watch_dir}"}

    new_count = 0
    db = SessionLocal()
    try:
        # Already-ingested file paths
        seen = {
            row[0]
            for row in db.execute(
                select(SensorImage.original_path).where(SensorImage.original_path.is_not(None))
            ).all()
        }

        # Active sensors — required for image attribution
        sensors = db.execute(
            select(Sensor).where(Sensor.is_active.is_(True))
        ).scalars().all()
        if not sensors:
            return {
                "new_images": 0,
                "processed": 0,
                "error": "No active sensors. Configure FIELD_LAYOUT in .env.",
            }

        # Walk every image file under WATCH_DIR (folder structure ignored).
        for d, _dirnames, filenames in os.walk(watch_dir):
            d = Path(d)
            for fname in filenames:
                f = d / fname
                if f.suffix.lower() not in IMAGE_EXTS:
                    continue
                resolved = str(f.resolve())
                if resolved in seen:
                    continue
                # Random sensor assignment — folder origin doesn't dictate which
                # physical sensor the image belongs to.
                sensor = random.choice(sensors)
                _ingest(db, sensor, f)
                new_count += 1

        # Always drain the pipeline (rows from previous scans may still be pending)
        processed = run_once(db)
        if new_count or processed:
            logger.info(f"Watcher: ingested={new_count} processed={processed}")
        return {"new_images": new_count, "processed": processed}
    finally:
        db.close()


def _loop() -> None:
    logger.info(
        f"Watcher started — polling {settings.WATCH_DIR} every "
        f"{settings.WATCH_INTERVAL_SECONDS}s"
    )
    global _last_scan_at, _last_result
    while not _stop_event.is_set():
        try:
            _last_result = scan_once()
            _last_scan_at = datetime.now(timezone.utc)
        except Exception:
            logger.exception("Watcher scan failed")
        _stop_event.wait(settings.WATCH_INTERVAL_SECONDS)
    logger.info("Watcher stopped")


def start() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop_event.clear()
    _thread = threading.Thread(target=_loop, daemon=True, name="WatcherThread")
    _thread.start()


def stop() -> None:
    _stop_event.set()


def get_status() -> dict:
    return {
        "running": bool(_thread and _thread.is_alive()),
        "watch_dir": settings.WATCH_DIR,
        "interval_seconds": settings.WATCH_INTERVAL_SECONDS,
        "last_scan_at_utc": _last_scan_at.isoformat() if _last_scan_at else None,
        "last_result": _last_result,
    }

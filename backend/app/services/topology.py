"""
Field topology service.

Parses the FIELD_LAYOUT setting and idempotently ensures the database has
exactly the configured set of sensors:

    "Zone A:4,Zone B:3,Zone C:3"  →  10 sensors named Sensor 1..10
                                       Sensors 1-4   in "Zone A"
                                       Sensors 5-7   in "Zone B"
                                       Sensors 8-10  in "Zone C"

Strategy:
- Pick the oldest existing sensors first so historical predictions stay
  associated with stable sensor IDs.
- Only rename / reassign zone — don't change ID.
- If more sensors are required than exist, create them.
- If fewer are required, deactivate the extras (preserve historical data).

Lat/lng is auto-assigned around small zone-specific clusters in Kedah.
"""
import logging
import random
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.sensor import Sensor

logger = logging.getLogger(__name__)

# Approximate centre of Kedah's rice belt
KEDAH_LAT = 6.1254
KEDAH_LNG = 100.3673

# Per-zone offset (in degrees) so zones cluster on the map but don't overlap
ZONE_OFFSETS = [
    ( 0.040, -0.030),   # Zone A — north-west
    (-0.025,  0.040),   # Zone B — south-east
    ( 0.000,  0.000),   # Zone C — centre
    (-0.045, -0.020),   # Zone D
    ( 0.030,  0.055),   # Zone E
    (-0.015, -0.050),   # Zone F
]


def parse_layout(layout: str) -> list[tuple[str, int]]:
    """'Zone A:4, Zone B:3' → [('Zone A', 4), ('Zone B', 3)]"""
    parsed = []
    for chunk in layout.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        name, _, count = chunk.rpartition(":")
        try:
            n = int(count.strip())
        except ValueError:
            raise ValueError(f"Invalid FIELD_LAYOUT entry '{chunk}' — expected 'Zone X:N'")
        if n < 1:
            continue
        parsed.append((name.strip(), n))
    return parsed


def _zone_descriptors(layout: list[tuple[str, int]]) -> Iterable[tuple[str, int]]:
    """Yield (zone_name, zone_idx) once per sensor required by the layout."""
    for zi, (zone_name, count) in enumerate(layout):
        for _ in range(count):
            yield zone_name, zi


def _coords_for_zone(zone_idx: int, jitter: float = 0.015) -> tuple[float, float]:
    dx, dy = ZONE_OFFSETS[zone_idx % len(ZONE_OFFSETS)]
    return (
        round(KEDAH_LAT + dx + random.uniform(-jitter, jitter), 6),
        round(KEDAH_LNG + dy + random.uniform(-jitter, jitter), 6),
    )


def ensure_field_layout(layout_str: str | None = None) -> dict:
    """Reconcile DB sensors with the configured FIELD_LAYOUT.

    Returns a small report dict with counts of renamed / created / deactivated.
    """
    layout = parse_layout(layout_str or settings.FIELD_LAYOUT)
    descriptors = list(_zone_descriptors(layout))
    total_required = len(descriptors)

    db: Session = SessionLocal()
    renamed = created = deactivated = 0
    try:
        existing = db.execute(
            select(Sensor).order_by(Sensor.created_at.asc(), Sensor.id.asc())
        ).scalars().all()

        for i, (zone_name, zone_idx) in enumerate(descriptors):
            target_name = f"Sensor {i + 1}"
            location  = f"{zone_name} · Kedah"

            if i < len(existing):
                s = existing[i]
                changed = False
                if s.name != target_name:           s.name = target_name; changed = True
                if s.field_zone != zone_name:       s.field_zone = zone_name; changed = True
                if s.location_name != location:     s.location_name = location; changed = True
                if not s.is_active:                 s.is_active = True; changed = True
                if s.latitude is None or s.longitude is None:
                    s.latitude, s.longitude = _coords_for_zone(zone_idx)
                    changed = True
                if changed:
                    renamed += 1
            else:
                lat, lng = _coords_for_zone(zone_idx)
                db.add(Sensor(
                    name=target_name,
                    field_zone=zone_name,
                    location_name=location,
                    latitude=lat,
                    longitude=lng,
                    is_active=True,
                ))
                created += 1

        # Deactivate any extras (preserve their historical predictions)
        for s in existing[total_required:]:
            if s.is_active:
                s.is_active = False
                deactivated += 1

        db.commit()
    finally:
        db.close()

    report = {
        "zones":       len(layout),
        "required":    total_required,
        "renamed":     renamed,
        "created":     created,
        "deactivated": deactivated,
    }
    logger.info(f"Field layout reconciled: {report}")
    return report

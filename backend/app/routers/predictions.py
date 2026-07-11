"""
Read-only endpoints for disease detections, yield predictions, and dashboard summary.

GET /api/v1/predictions/disease           list disease detections (filterable)
GET /api/v1/predictions/disease/{id}      single detection
GET /api/v1/predictions/yield             list yield predictions (filterable)
GET /api/v1/predictions/yield/{id}        single yield prediction
GET /api/v1/predictions/summary           dashboard aggregate stats
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.prediction import Alert, DiseaseDetection, YieldPrediction
from app.models.sensor import Sensor
from app.models.sensor_image import SensorImage
from app.schemas.prediction import (
    ClimateSnapshot,
    DashboardSummary,
    DiseaseDetectionResponse,
    Paginated,
    YieldPredictionResponse,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Disease detections
# ---------------------------------------------------------------------------

@router.get("/disease", response_model=Paginated)
def list_disease_detections(
    sensor_id: str | None = None,
    severity: str | None = Query(None, pattern="^(none|low|medium|high)$"),
    disease_label: str | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    sort: str = Query("predicted", pattern="^(predicted|recent)$"),
    db: Session = Depends(get_db),
):
    """`sort=predicted` (default) orders by predicted_at desc — used for time-series.
    `sort=recent` orders by the source image's ingestion time
    (sensor_images.created_at) so freshly arrived detections appear first
    regardless of their backdated capture date — used for the live feed."""
    filters = []
    if sensor_id:
        filters.append(DiseaseDetection.sensor_id == sensor_id)
    if severity:
        filters.append(DiseaseDetection.severity_level == severity)
    if disease_label:
        filters.append(DiseaseDetection.disease_label == disease_label)
    if date_from:
        filters.append(DiseaseDetection.predicted_at >= date_from)
    if date_to:
        filters.append(DiseaseDetection.predicted_at <= date_to)

    count_stmt = select(func.count()).select_from(DiseaseDetection)
    # Always select created_at alongside so we can populate `ingested_at` —
    # the dashboard needs it to show "X min ago" for freshly arrived rows.
    stmt = (
        select(DiseaseDetection, SensorImage.created_at)
        .join(SensorImage, SensorImage.id == DiseaseDetection.sensor_image_id, isouter=True)
    )
    if sort == "recent":
        stmt = stmt.order_by(SensorImage.created_at.desc())
    else:
        stmt = stmt.order_by(DiseaseDetection.predicted_at.desc())

    if filters:
        where = and_(*filters)
        count_stmt = count_stmt.where(where)
        stmt = stmt.where(where)
    total = db.execute(count_stmt).scalar_one()
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    rows = db.execute(stmt).all()
    items = []
    for detection, ingested_at in rows:
        item = DiseaseDetectionResponse.model_validate(detection).model_dump()
        item["ingested_at"] = ingested_at
        items.append(item)
    return Paginated(items=items, total=total, page=page, page_size=page_size)


@router.get("/disease/{detection_id}", response_model=DiseaseDetectionResponse)
def get_disease_detection(detection_id: str, db: Session = Depends(get_db)):
    row = db.get(DiseaseDetection, detection_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Detection not found")
    return row


# ---------------------------------------------------------------------------
# Yield predictions
# ---------------------------------------------------------------------------

@router.get("/yield", response_model=Paginated)
def list_yield_predictions(
    sensor_id: str | None = None,
    date_from: datetime | None = Query(None, alias="from"),
    date_to: datetime | None = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    filters = []
    if sensor_id:
        filters.append(YieldPrediction.sensor_id == sensor_id)
    if date_from:
        filters.append(YieldPrediction.predicted_at >= date_from)
    if date_to:
        filters.append(YieldPrediction.predicted_at <= date_to)

    count_stmt = select(func.count()).select_from(YieldPrediction)
    stmt = select(YieldPrediction).order_by(YieldPrediction.predicted_at.desc())
    if filters:
        where = and_(*filters)
        count_stmt = count_stmt.where(where)
        stmt = stmt.where(where)
    total = db.execute(count_stmt).scalar_one()
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    rows = db.execute(stmt).scalars().all()
    items = [YieldPredictionResponse.model_validate(r).model_dump() for r in rows]
    return Paginated(items=items, total=total, page=page, page_size=page_size)


@router.get("/yield/{yield_id}", response_model=YieldPredictionResponse)
def get_yield_prediction(yield_id: str, db: Session = Depends(get_db)):
    row = db.get(YieldPrediction, yield_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Yield prediction not found")
    return row


# ---------------------------------------------------------------------------
# Dashboard summary (aggregate stats across the system)
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0, tzinfo=None
    )

    sensors_total = db.execute(select(func.count()).select_from(Sensor)).scalar_one()
    sensors_active = db.execute(
        select(func.count()).select_from(Sensor).where(Sensor.is_active.is_(True))
    ).scalar_one()

    # NOTE: `captured_at` is intentionally backdated by the watcher to spread the
    # time-series charts. For "today" counters we use the row insertion time
    # (created_at), which is always now() — that's what the user actually wants
    # for live activity stats.
    images_today = db.execute(
        select(func.count()).select_from(SensorImage).where(SensorImage.created_at >= today_start)
    ).scalar_one()

    # detections "today" is gated by their source image's arrival time
    detections_today = db.execute(
        select(func.count())
        .select_from(DiseaseDetection)
        .join(SensorImage, SensorImage.id == DiseaseDetection.sensor_image_id)
        .where(SensorImage.created_at >= today_start)
        .where(DiseaseDetection.severity_level != "none")
    ).scalar_one()

    # Most common disease across all detections
    top = db.execute(
        select(
            DiseaseDetection.disease_label,
            DiseaseDetection.disease_label_ms,
            func.count().label("n"),
        )
        .where(DiseaseDetection.disease_label.is_not(None))
        .where(DiseaseDetection.severity_level != "none")
        .group_by(DiseaseDetection.disease_label, DiseaseDetection.disease_label_ms)
        .order_by(func.count().desc())
        .limit(1)
    ).first()
    most_common_disease = top[0] if top else None
    most_common_disease_ms = top[1] if top else None

    avg_yield = db.execute(
        select(func.avg(YieldPrediction.predicted_yield_kg_per_hectare))
    ).scalar()
    avg_yield = float(avg_yield) if avg_yield is not None else None

    critical_unread = db.execute(
        select(func.count())
        .select_from(Alert)
        .where(Alert.severity == "critical")
        .where(Alert.is_read.is_(False))
        .where(Alert.is_dismissed.is_(False))
    ).scalar_one()

    warning_unread = db.execute(
        select(func.count())
        .select_from(Alert)
        .where(Alert.severity == "warning")
        .where(Alert.is_read.is_(False))
        .where(Alert.is_dismissed.is_(False))
    ).scalar_one()

    return DashboardSummary(
        sensors_total=sensors_total,
        sensors_active=sensors_active,
        images_today=images_today,
        detections_today=detections_today,
        most_common_disease=most_common_disease,
        most_common_disease_ms=most_common_disease_ms,
        avg_yield_kg_per_hectare=round(avg_yield, 2) if avg_yield else None,
        critical_alerts_unread=critical_unread,
        warning_alerts_unread=warning_unread,
    )


# ---------------------------------------------------------------------------
# Climate snapshot (live weather averages for the ClimateIQ card)
# ---------------------------------------------------------------------------

def _aqi_band(v: float | None) -> str | None:
    """Map raw pollutant_value (0-300+) to standard AQI category labels."""
    if v is None:
        return None
    if v <= 50:  return "Good"
    if v <= 100: return "Moderate"
    if v <= 150: return "Unhealthy for Sensitive"
    if v <= 200: return "Unhealthy"
    return "Very Unhealthy"


def _uv_band(v: float | None) -> str | None:
    if v is None:
        return None
    if v < 3:    return "Low"
    if v < 6:    return "Moderate"
    if v < 8:    return "High"
    if v < 11:   return "Very High"
    return "Extreme"


@router.get("/climate", response_model=ClimateSnapshot)
def climate_snapshot(
    sample: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    Average weather readings across the N most-recently-ingested images.
    Sorted by `created_at` (ingestion time) so the snapshot reflects what
    sensors reported most recently, not the backdated capture date.
    """
    latest = db.execute(
        select(SensorImage)
        .order_by(SensorImage.created_at.desc())
        .limit(sample)
    ).scalars().all()

    if not latest:
        return ClimateSnapshot(
            sample_size=0, as_of=None,
            temperature=None, humidity=None,
            uv_index=None, uv_band=None,
            pollutant_value=None, aqi_band=None,
            sun_pct=None, wind_speed=None, precipitation_total=None,
        )

    def _avg(field: str) -> float | None:
        vals = [v for v in (getattr(img, field) for img in latest) if v is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    temp     = _avg("temperature")
    humidity = _avg("humidity")
    uv       = _avg("uv_index")
    pollutant = _avg("pollutant_value")
    solar    = _avg("solar_radiation")
    wind     = _avg("wind_speed")
    precip   = _avg("precipitation_total")

    # Solar radiation 0–1000 W/m² → 0–100% rough utilisation for the sun pill.
    sun_pct = round(min(100.0, (solar or 0) / 10.0), 1) if solar is not None else None

    return ClimateSnapshot(
        sample_size=len(latest),
        as_of=latest[0].created_at,
        temperature=temp,
        humidity=humidity,
        uv_index=uv,
        uv_band=_uv_band(uv),
        pollutant_value=pollutant,
        aqi_band=_aqi_band(pollutant),
        sun_pct=sun_pct,
        wind_speed=wind,
        precipitation_total=precip,
    )

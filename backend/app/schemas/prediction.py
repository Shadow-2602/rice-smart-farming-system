from datetime import datetime
from typing import Any

from pydantic import BaseModel


# ---------- Disease detection ----------

class DiseaseDetectionResponse(BaseModel):
    id: str
    sensor_image_id: str | None
    sensor_id: str | None
    disease_label: str | None
    disease_label_ms: str | None
    confidence_score: float | None
    bounding_box_json: list[Any] | dict | None
    num_detections: int
    severity_level: str | None
    annotated_file_path: str | None
    predicted_at: datetime                # = source image's captured_at (backdated for charts)
    ingested_at: datetime | None = None   # = source image's created_at (true arrival time)
    model_version: str

    model_config = {"from_attributes": True}


# ---------- Yield prediction ----------

class YieldPredictionResponse(BaseModel):
    id: str
    sensor_id: str | None
    sensor_image_id: str | None
    predicted_yield_kg_per_hectare: float | None
    confidence_interval_low: float | None
    confidence_interval_high: float | None
    input_features_json: dict | None
    predicted_at: datetime
    model_version: str

    model_config = {"from_attributes": True}


# ---------- Paginated wrapper ----------

class Paginated(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# ---------- Dashboard summary ----------

class DashboardSummary(BaseModel):
    sensors_total: int
    sensors_active: int
    images_today: int
    detections_today: int
    most_common_disease: str | None
    most_common_disease_ms: str | None
    avg_yield_kg_per_hectare: float | None
    critical_alerts_unread: int
    warning_alerts_unread: int


# ---------- Climate snapshot (latest weather aggregates) ----------

class ClimateSnapshot(BaseModel):
    sample_size: int                       # how many images contributed to the averages
    as_of: datetime | None                 # newest contributing image's created_at
    temperature: float | None              # °C
    humidity: float | None                 # %
    uv_index: float | None                 # 0–11 scale
    uv_band: str | None                    # "Low" | "Moderate" | "High" | "Very High" | "Extreme"
    pollutant_value: float | None          # raw AQI-style value
    aqi_band: str | None                   # "Good" | "Moderate" | "Unhealthy" | …
    sun_pct: float | None                  # solar_radiation normalised → 0–100
    wind_speed: float | None               # km/h
    precipitation_total: float | None      # mm

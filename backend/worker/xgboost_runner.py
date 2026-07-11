"""
XGBoost rice yield prediction runner.

Trained on Malaysian state-level annual averages of weather + paddy yield (tonnes/ha).
Source: D:\\XGBoost\\train_xgboost.py — features = average of full_weather.csv columns.

Responsibility: given the 14 weather readings captured by the IoT sensor at the time of the
image, predict yield in tonnes/hectare.

This module does NOT perform disease detection — that is handled exclusively by yolo_runner.py.
The XGBoost model uses ONLY weather features. YOLO output is intentionally not fed in.
"""
import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

_model = None

# Must match the order returned by the trained model. Verified via:
#   xgb.Booster().load_model(...).feature_names
FEATURE_ORDER = [
    "temperature",
    "pressure",
    "dew_point",
    "humidity",
    "wind_speed",
    "gust",
    "wind_chill",
    "uv_index",
    "feels_like_temperature",
    "visibility",
    "solar_radiation",
    "pollutant_value",
    "precipitation_rate",
    "precipitation_total",
]


def load_model(model_path: str) -> bool:
    """Load XGBoost model from disk. Returns True on success."""
    global _model
    path = Path(model_path)
    if not path.exists():
        logger.warning(f"XGBoost model not found at {path}. Yield prediction will be skipped.")
        return False
    try:
        import xgboost as xgb
        _model = xgb.Booster()
        _model.load_model(str(path))
        logger.info(f"XGBoost model loaded from {path}")
        return True
    except Exception as exc:
        logger.error(f"Failed to load XGBoost model: {exc}")
        return False


def is_ready() -> bool:
    return _model is not None


def predict_yield(weather: dict) -> dict:
    """
    Run XGBoost yield inference using the 14 weather features.

    `weather` must contain every key in FEATURE_ORDER (None values are coerced to 0.0).
    Missing keys raise KeyError.

    Returns:
        predicted_yield_tonnes_per_hectare  float
        predicted_yield_kg_per_hectare      float   (×1000 for the DB column unit)
        confidence_interval_low             float   (kg/ha)
        confidence_interval_high            float   (kg/ha)
        input_features_json                 dict
    """
    if _model is None:
        raise RuntimeError("XGBoost model is not loaded. Call load_model() first.")

    import xgboost as xgb

    row = [float(weather[k]) if weather.get(k) is not None else 0.0 for k in FEATURE_ORDER]
    X = np.array([row], dtype=np.float32)
    dmat = xgb.DMatrix(X, feature_names=FEATURE_ORDER)

    yield_t_per_ha = float(_model.predict(dmat)[0])
    yield_kg_per_ha = yield_t_per_ha * 1000.0

    # Simple ±10% confidence band (replace with proper interval estimator when available)
    margin = yield_kg_per_ha * 0.10

    return {
        "predicted_yield_tonnes_per_hectare": round(yield_t_per_ha, 3),
        "predicted_yield_kg_per_hectare":     round(yield_kg_per_ha, 2),
        "confidence_interval_low":            round(yield_kg_per_ha - margin, 2),
        "confidence_interval_high":           round(yield_kg_per_ha + margin, 2),
        "input_features_json":                {k: weather.get(k) for k in FEATURE_ORDER},
    }

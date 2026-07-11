"""
AI pipeline — polls sensor_images for unprocessed entries and runs:
  1. YOLO11s  → disease detection   (saved to disease_detections)
  2. XGBoost  → yield prediction    (saved to yield_predictions)

These two models are called independently. YOLO output is NOT fed into XGBoost.

Run as a standalone process:
    python worker/pipeline.py

Or import run_once() to process a single batch programmatically (used by the API trigger).
"""
import logging
import sys
import time
import uuid
from pathlib import Path

# Allow running as a script from the backend/ directory
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.prediction import Alert, DiseaseDetection, YieldPrediction
from app.models.sensor import Sensor
from app.models.sensor_image import SensorImage
from app.services.storage import save_annotated_image
from worker import xgboost_runner, yolo_runner

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

POLL_INTERVAL = 30       # seconds between polls
BATCH_SIZE = 50          # images processed per poll cycle
YOLO_MODEL_PATH = str(Path(__file__).resolve().parents[1].parent / "models" / "yolo11ver2.pt")
XGBOOST_MODEL_PATH = str(Path(__file__).resolve().parents[1].parent / "models" / "rice_yield_xgboost_model.json")


def initialise_models() -> tuple[bool, bool]:
    """Load both models once at startup. Returns (yolo_ok, xgb_ok)."""
    yolo_ok = yolo_runner.load_model(YOLO_MODEL_PATH)
    xgb_ok = xgboost_runner.load_model(XGBOOST_MODEL_PATH)
    return yolo_ok, xgb_ok


def run_once(db: Session) -> int:
    """
    Fetch up to BATCH_SIZE unprocessed images and run both models on each.
    Returns the number of images successfully processed.
    """
    pending = (
        db.execute(
            select(SensorImage)
            .where(SensorImage.is_processed == False)  # noqa: E712
            .limit(BATCH_SIZE)
        )
        .scalars()
        .all()
    )

    if not pending:
        return 0

    logger.info(f"Processing {len(pending)} pending image(s)...")
    processed = 0

    for image in pending:
        try:
            _process_single(image, db)
            processed += 1
        except Exception as exc:
            logger.error(f"Error processing image {image.id}: {exc}", exc_info=True)
            # Roll back any flushed-but-uncommitted state from this image so the
            # next image starts with a clean session (prevents orphaned detections).
            db.rollback()

    return processed


# ---------------------------------------------------------------------------
# Single-image processing
# ---------------------------------------------------------------------------

def _process_single(image: SensorImage, db: Session) -> None:
    sensor = db.get(Sensor, image.sensor_id) if image.sensor_id else None

    detection_id = _run_yolo(image, sensor, db)
    _run_xgboost(image, sensor, db)
    _maybe_create_alert(image, sensor, detection_id, db)

    image.is_processed = True
    db.commit()
    logger.info(f"Image {image.id} processed.")


def _run_yolo(image: SensorImage, sensor, db: Session) -> str | None:
    """Run YOLO11s disease detection. Returns the new DiseaseDetection id, or None."""
    if not yolo_runner.is_ready():
        logger.warning("YOLO model not loaded — skipping disease detection.")
        return None

    result = yolo_runner.run_detection(image.file_path)

    # Save annotated image to storage/annotated/
    sensor_folder = str(image.sensor_id or "unknown")
    annotated_key = f"{sensor_folder}/{image.id}_annotated.jpg"
    annotated_path = save_annotated_image(annotated_key, result["annotated_bytes"])

    detection = DiseaseDetection(
        id=str(uuid.uuid4()),
        sensor_image_id=image.id,
        sensor_id=image.sensor_id,
        disease_label=result["disease_label"],
        disease_label_ms=result["disease_label_ms"],
        confidence_score=result["confidence_score"],
        bounding_box_json=result["detections"],
        num_detections=result["num_detections"],
        severity_level=result["severity_level"],
        annotated_file_path=str(annotated_path.resolve()),
        # inherit the image's captured_at so the time-series charts reflect the
        # capture date, not the (clustered) processing date
        predicted_at=image.captured_at,
    )
    db.add(detection)
    db.flush()  # get the id without committing
    return detection.id


def _run_xgboost(image: SensorImage, sensor, db: Session) -> None:
    """Run XGBoost yield prediction. Uses only weather features captured by the IoT sensor.
    YOLO output is intentionally not used."""
    if not xgboost_runner.is_ready():
        logger.warning("XGBoost model not loaded — skipping yield prediction.")
        return

    weather = {k: getattr(image, k, None) for k in xgboost_runner.FEATURE_ORDER}
    if all(v is None for v in weather.values()):
        logger.warning(f"Image {image.id} has no weather data — skipping yield prediction.")
        return

    result = xgboost_runner.predict_yield(weather)

    prediction = YieldPrediction(
        id=str(uuid.uuid4()),
        sensor_id=image.sensor_id,
        sensor_image_id=image.id,
        predicted_yield_kg_per_hectare=result["predicted_yield_kg_per_hectare"],
        confidence_interval_low=result["confidence_interval_low"],
        confidence_interval_high=result["confidence_interval_high"],
        input_features_json=result["input_features_json"],
        # mirror image capture time so charts reflect capture date
        predicted_at=image.captured_at,
    )
    db.add(prediction)
    db.flush()


def _maybe_create_alert(image: SensorImage, sensor, detection_id: str | None, db: Session) -> None:
    """Create an alert when YOLO detects disease above the warning threshold."""
    if detection_id is None:
        return

    detection = db.get(DiseaseDetection, detection_id)
    if detection is None or detection.severity_level in ("none", None):
        return

    severity_map = {"low": "info", "medium": "warning", "high": "critical"}
    alert_severity = severity_map.get(detection.severity_level, "info")
    sensor_name = sensor.name if sensor else "Unknown Sensor"
    disease    = detection.disease_label    or "Unknown Disease"
    disease_ms = detection.disease_label_ms or disease

    alert = Alert(
        id=str(uuid.uuid4()),
        sensor_id=image.sensor_id,
        disease_detection_id=detection_id,
        alert_type="disease_detected",
        title=f"{disease} detected at {sensor_name}",
        title_ms=f"{disease_ms} dikesan di {sensor_name}",
        message=(
            f"Confidence: {detection.confidence_score:.0%} | "
            f"Severity: {detection.severity_level} | "
            f"Detections: {detection.num_detections}"
        ),
        message_ms=(
            f"Keyakinan: {detection.confidence_score:.0%} | "
            f"Tahap: {detection.severity_level} | "
            f"Pengesanan: {detection.num_detections}"
        ),
        severity=alert_severity,
    )
    db.add(alert)
    db.flush()


# ---------------------------------------------------------------------------
# Entry point — standalone polling loop
# ---------------------------------------------------------------------------

def main() -> None:
    logger.info("=== Rice AI Pipeline Worker starting ===")
    yolo_ok, xgb_ok = initialise_models()

    if not yolo_ok:
        logger.warning("YOLO model missing — place yolo11s_rice.pt in the models/ folder.")
    if not xgb_ok:
        logger.warning("XGBoost model missing — place xgboost_yield.json in the models/ folder.")
    if not yolo_ok and not xgb_ok:
        logger.error("No models loaded. Add model files to models/ and restart.")
        sys.exit(1)

    logger.info(f"Polling every {POLL_INTERVAL}s for new images...")

    while True:
        try:
            with SessionLocal() as db:
                count = run_once(db)
                if count:
                    logger.info(f"Processed {count} image(s).")
        except Exception as exc:
            logger.error(f"Pipeline error: {exc}", exc_info=True)
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()

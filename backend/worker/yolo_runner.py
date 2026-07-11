"""
YOLO11s rice disease detection runner.

Responsibility: given an image path, return disease detections and an annotated image.
This module does NOT perform yield prediction — that is handled exclusively by xgboost_runner.py.
"""
import io
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Loaded once when the worker starts; None until load_model() is called.
_model = None

# YOLO class name → (English display name, Malay display name).
# Keys must match the model's training class labels exactly (lowercase, underscores).
DISEASE_DISPLAY: dict[str, tuple[str, str]] = {
    "bacterial_leaf_blight": ("Bacterial Leaf Blight", "Hawar Daun Bakteria"),
    "leaf_blast":            ("Leaf Blast",            "Barah Daun"),
    "tungro":                ("Tungro",                "Tungro"),
    "healthy":               ("Healthy",               "Sihat"),
    "sheath_blight":         ("Sheath Blight",         "Hawar Sarung"),
    "brownspot":             ("Brown Spot",            "Bintik Perang"),
}

CONFIDENCE_THRESHOLD = 0.4


def load_model(model_path: str) -> bool:
    """Load YOLO11s model from disk. Returns True on success."""
    global _model
    path = Path(model_path)
    if not path.exists():
        logger.warning(f"YOLO model not found at {path}. Disease detection will be skipped.")
        return False
    try:
        from ultralytics import YOLO
        _model = YOLO(str(path))
        logger.info(f"YOLO11s model loaded from {path}")
        return True
    except Exception as exc:
        logger.error(f"Failed to load YOLO model: {exc}")
        return False


def is_ready() -> bool:
    return _model is not None


def run_detection(image_path: str) -> dict:
    """
    Run YOLO11s inference on a single image.

    Returns a dict with:
        detections      list of {label, label_ms, confidence, bbox}
        num_detections  int
        disease_label   str | None   — label with highest confidence
        disease_label_ms str | None
        confidence_score float | None
        severity_level  'none' | 'low' | 'medium' | 'high'
        annotated_bytes bytes        — JPEG-encoded annotated image
    """
    if _model is None:
        raise RuntimeError("YOLO model is not loaded. Call load_model() first.")

    results = _model.predict(source=image_path, conf=CONFIDENCE_THRESHOLD, verbose=False)

    detections = []
    for r in results:
        for box in r.boxes:
            raw_label = r.names[int(box.cls[0])]
            display_en, display_ms = DISEASE_DISPLAY.get(raw_label, (raw_label, raw_label))
            detections.append({
                "label": display_en,
                "label_ms": display_ms,
                "raw_class": raw_label,
                "confidence": round(float(box.conf[0]), 4),
                "bbox": [round(v, 2) for v in box.xyxy[0].tolist()],  # [x1, y1, x2, y2]
            })

    # Sort by confidence descending
    detections.sort(key=lambda d: d["confidence"], reverse=True)

    # Primary disease = highest-confidence non-healthy detection
    diseased = [d for d in detections if d["raw_class"] != "healthy"]
    top = diseased[0] if diseased else (detections[0] if detections else None)
    disease_label = top["label"] if top else None
    disease_label_ms = top["label_ms"] if top else None
    confidence_score = top["confidence"] if top else None
    is_healthy = bool(top and top["raw_class"] == "healthy")

    severity_level = "none" if is_healthy else _compute_severity(confidence_score, len(diseased))

    # Annotated image (YOLO draws bounding boxes)
    annotated_array = results[0].plot()
    annotated_bytes = _array_to_jpeg(annotated_array)

    return {
        "detections": detections,
        "num_detections": len(detections),
        "disease_label": disease_label,
        "disease_label_ms": disease_label_ms,
        "confidence_score": confidence_score,
        "severity_level": severity_level,
        "annotated_bytes": annotated_bytes,
    }


def _compute_severity(confidence: Optional[float], num_detections: int) -> str:
    if num_detections == 0 or confidence is None:
        return "none"
    if confidence >= 0.85:
        return "high"
    if confidence >= 0.6:
        return "medium"
    return "low"


def _array_to_jpeg(array) -> bytes:
    from PIL import Image
    img = Image.fromarray(array[..., ::-1])  # BGR → RGB
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()

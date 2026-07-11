"""
One-time script: spreads timestamps of existing demo data across the last
30 days so the dashboard charts have something to draw.

What it does:
  - Generates one sorted timestamp per sensor_image (in last 30 days)
  - sensor_images.captured_at      → the random timestamp
  - disease_detections.predicted_at → captured_at + 1-5 sec
  - yield_predictions.predicted_at  → captured_at + 1-5 sec

Idempotent: safe to re-run. Each run reshuffles the spread.

Usage (from the project root):
    .venv\\Scripts\\activate
    python backend/spread_demo_timestamps.py
"""
import os
import random
import sys
from datetime import datetime, timedelta

# Make `app` package importable when run from the project root
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from sqlalchemy import select
from app.database import SessionLocal
from app.models.prediction import DiseaseDetection, YieldPrediction
from app.models.sensor_image import SensorImage

DAYS = 30


def main() -> None:
    now = datetime.utcnow().replace(microsecond=0)
    db = SessionLocal()
    try:
        images = db.execute(
            select(SensorImage).order_by(SensorImage.id)
        ).scalars().all()
        n = len(images)
        if n == 0:
            print("No sensor_images rows. Nothing to do.")
            return

        print(f"Spreading {n:,} images across the last {DAYS} days...")

        # Generate n sorted random timestamps in [now - DAYS days, now]
        timestamps = sorted(
            now - timedelta(seconds=random.uniform(0, DAYS * 86_400))
            for _ in range(n)
        )

        # Update sensor_images.captured_at
        captured_at_by_image = {}
        for img, ts in zip(images, timestamps):
            img.captured_at = ts
            captured_at_by_image[img.id] = ts

        # Update disease_detections to mirror their image's new captured_at
        diseases = db.execute(select(DiseaseDetection)).scalars().all()
        d_updated = 0
        for d in diseases:
            base = captured_at_by_image.get(d.sensor_image_id)
            if base is not None:
                d.predicted_at = base + timedelta(seconds=random.uniform(1, 5))
                d_updated += 1

        # Update yield_predictions to mirror their image's new captured_at
        yields = db.execute(select(YieldPrediction)).scalars().all()
        y_updated = 0
        for y in yields:
            base = captured_at_by_image.get(y.sensor_image_id)
            if base is not None:
                y.predicted_at = base + timedelta(seconds=random.uniform(1, 5))
                y_updated += 1

        db.commit()
        print(f"  sensor_images.captured_at:        {n:,} rows")
        print(f"  disease_detections.predicted_at:  {d_updated:,} rows")
        print(f"  yield_predictions.predicted_at:   {y_updated:,} rows")
        print(f"Range: {timestamps[0].date()} -> {timestamps[-1].date()}")
        print("\nDone. Refresh the dashboard.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

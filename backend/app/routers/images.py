"""
Image-serving endpoints. Serves files directly from local storage.

GET /api/v1/images/{sensor_image_id}/raw         original image captured by sensor
GET /api/v1/images/{sensor_image_id}/annotated   YOLO-annotated image (bounding boxes drawn)
"""
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.prediction import DiseaseDetection
from app.models.sensor_image import SensorImage

router = APIRouter()


@router.get("/{sensor_image_id}/raw")
def get_raw_image(sensor_image_id: str, db: Session = Depends(get_db)):
    image = db.get(SensorImage, sensor_image_id)
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image record not found")

    path = Path(image.file_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image file missing on disk: {path}",
        )
    return FileResponse(path, media_type="image/jpeg")


@router.get("/{sensor_image_id}/annotated")
def get_annotated_image(sensor_image_id: str, db: Session = Depends(get_db)):
    detection = db.execute(
        select(DiseaseDetection)
        .where(DiseaseDetection.sensor_image_id == sensor_image_id)
        .order_by(DiseaseDetection.predicted_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if not detection or not detection.annotated_file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Annotated image not available — image may not have been processed yet",
        )

    path = Path(detection.annotated_file_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotated image file missing on disk: {path}",
        )
    return FileResponse(path, media_type="image/jpeg")

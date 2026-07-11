import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, Float, ForeignKey, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DiseaseDetection(Base):
    __tablename__ = "disease_detections"
    __table_args__ = (
        CheckConstraint(
            "severity_level IN ('none','low','medium','high')",
            name="ck_disease_severity",
        ),
        CheckConstraint(
            "confidence_score BETWEEN 0 AND 1",
            name="ck_disease_confidence",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sensor_image_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sensor_images.id", ondelete="CASCADE")
    )
    sensor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sensors.id", ondelete="SET NULL")
    )
    disease_label: Mapped[str | None] = mapped_column(String(100))
    disease_label_ms: Mapped[str | None] = mapped_column(String(100))
    confidence_score: Mapped[float | None] = mapped_column(Float)
    bounding_box_json: Mapped[dict | None] = mapped_column(JSON)
    num_detections: Mapped[int] = mapped_column(SmallInteger, default=0)
    severity_level: Mapped[str | None] = mapped_column(String(20))
    annotated_file_path: Mapped[str | None] = mapped_column(String(500))
    predicted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    model_version: Mapped[str] = mapped_column(String(50), default="yolo11s-v1")


class YieldPrediction(Base):
    __tablename__ = "yield_predictions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sensor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sensors.id", ondelete="SET NULL")
    )
    sensor_image_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sensor_images.id", ondelete="CASCADE")
    )
    predicted_yield_kg_per_hectare: Mapped[float | None] = mapped_column(Float)
    confidence_interval_low: Mapped[float | None] = mapped_column(Float)
    confidence_interval_high: Mapped[float | None] = mapped_column(Float)
    input_features_json: Mapped[dict | None] = mapped_column(JSON)
    predicted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    model_version: Mapped[str] = mapped_column(String(50), default="xgboost-v1")


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint(
            "severity IN ('info','warning','critical')",
            name="ck_alert_severity",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sensor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sensors.id", ondelete="CASCADE")
    )
    disease_detection_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("disease_detections.id", ondelete="SET NULL")
    )
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    title_ms: Mapped[str | None] = mapped_column(String(255))
    message: Mapped[str | None] = mapped_column(Text)
    message_ms: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

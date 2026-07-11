import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SensorImage(Base):
    __tablename__ = "sensor_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sensor_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("sensors.id", ondelete="SET NULL")
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    # Source path the watcher saw — used for de-duplication so the same file isn't ingested twice.
    original_path: Mapped[str | None] = mapped_column(String(500))
    captured_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Weather readings captured by the IoT sensor at the same time as the image.
    # These feed XGBoost yield prediction. None = sensor did not report that channel.
    temperature: Mapped[float | None] = mapped_column(Float)
    pressure: Mapped[float | None] = mapped_column(Float)
    dew_point: Mapped[float | None] = mapped_column(Float)
    humidity: Mapped[float | None] = mapped_column(Float)
    wind_speed: Mapped[float | None] = mapped_column(Float)
    gust: Mapped[float | None] = mapped_column(Float)
    wind_chill: Mapped[float | None] = mapped_column(Float)
    uv_index: Mapped[float | None] = mapped_column(Float)
    feels_like_temperature: Mapped[float | None] = mapped_column(Float)
    visibility: Mapped[float | None] = mapped_column(Float)
    solar_radiation: Mapped[float | None] = mapped_column(Float)
    pollutant_value: Mapped[float | None] = mapped_column(Float)
    precipitation_rate: Mapped[float | None] = mapped_column(Float)
    precipitation_total: Mapped[float | None] = mapped_column(Float)

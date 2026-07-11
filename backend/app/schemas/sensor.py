from datetime import datetime

from pydantic import BaseModel


class SensorCreate(BaseModel):
    name: str
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    field_zone: str | None = None


class SensorUpdate(BaseModel):
    name: str | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    field_zone: str | None = None
    is_active: bool | None = None


class SensorResponse(BaseModel):
    id: str
    name: str
    location_name: str | None
    latitude: float | None
    longitude: float | None
    field_zone: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

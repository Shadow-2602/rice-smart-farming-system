from datetime import datetime

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: str
    sensor_id: str | None
    disease_detection_id: str | None
    alert_type: str
    title: str
    title_ms: str | None
    message: str | None
    message_ms: str | None
    severity: str
    is_read: bool
    is_dismissed: bool
    created_at: datetime

    model_config = {"from_attributes": True}

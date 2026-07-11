"""
Alert management endpoints.

GET    /api/v1/alerts                  list alerts (filterable, paginated)
GET    /api/v1/alerts/{id}             single alert
PATCH  /api/v1/alerts/{id}/read        mark as read
PATCH  /api/v1/alerts/{id}/dismiss     mark as dismissed
DELETE /api/v1/alerts/{id}             delete alert
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.prediction import Alert
from app.schemas.alert import AlertResponse
from app.schemas.prediction import Paginated

router = APIRouter()


@router.get("", response_model=Paginated)
def list_alerts(
    sensor_id: str | None = None,
    severity: str | None = Query(None, pattern="^(info|warning|critical)$"),
    is_read: bool | None = None,
    is_dismissed: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    filters = []
    if sensor_id:
        filters.append(Alert.sensor_id == sensor_id)
    if severity:
        filters.append(Alert.severity == severity)
    if is_read is not None:
        filters.append(Alert.is_read.is_(is_read))
    if is_dismissed is not None:
        filters.append(Alert.is_dismissed.is_(is_dismissed))

    count_stmt = select(func.count()).select_from(Alert)
    stmt = select(Alert).order_by(Alert.created_at.desc())
    if filters:
        where = and_(*filters)
        count_stmt = count_stmt.where(where)
        stmt = stmt.where(where)
    total = db.execute(count_stmt).scalar_one()
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    rows = db.execute(stmt).scalars().all()
    items = [AlertResponse.model_validate(r).model_dump() for r in rows]
    return Paginated(items=items, total=total, page=page, page_size=page_size)


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


@router.patch("/read-all")
def mark_all_read(
    severity: str | None = Query(None, pattern="^(info|warning|critical)$"),
    sensor_id: str | None = None,
    db: Session = Depends(get_db),
):
    """Bulk-mark every unread, non-dismissed alert as read.
    Optional `severity` and `sensor_id` filters scope the bulk update."""
    stmt = update(Alert).where(Alert.is_read.is_(False)).where(Alert.is_dismissed.is_(False))
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    if sensor_id:
        stmt = stmt.where(Alert.sensor_id == sensor_id)
    result = db.execute(stmt.values(is_read=True))
    db.commit()
    return {"updated": result.rowcount}


@router.patch("/{alert_id}/read", response_model=AlertResponse)
def mark_alert_read(alert_id: str, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert


@router.patch("/{alert_id}/dismiss", response_model=AlertResponse)
def dismiss_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert.is_dismissed = True
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    db.delete(alert)
    db.commit()

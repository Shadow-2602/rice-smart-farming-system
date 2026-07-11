from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.sensor import Sensor
from app.schemas.sensor import SensorCreate, SensorResponse, SensorUpdate

router = APIRouter()


@router.get("", response_model=list[SensorResponse])
def list_sensors(db: Session = Depends(get_db)):
    return db.execute(select(Sensor).order_by(Sensor.created_at.desc())).scalars().all()


@router.get("/{sensor_id}", response_model=SensorResponse)
def get_sensor(sensor_id: str, db: Session = Depends(get_db)):
    sensor = db.get(Sensor, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    return sensor


@router.post("", response_model=SensorResponse, status_code=status.HTTP_201_CREATED)
def create_sensor(body: SensorCreate, db: Session = Depends(get_db)):
    sensor = Sensor(**body.model_dump())
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return sensor


@router.patch("/{sensor_id}", response_model=SensorResponse)
def update_sensor(sensor_id: str, body: SensorUpdate, db: Session = Depends(get_db)):
    sensor = db.get(Sensor, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(sensor, field, value)
    db.commit()
    db.refresh(sensor)
    return sensor


@router.delete("/{sensor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sensor(sensor_id: str, db: Session = Depends(get_db)):
    sensor = db.get(Sensor, sensor_id)
    if not sensor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sensor not found")
    db.delete(sensor)
    db.commit()

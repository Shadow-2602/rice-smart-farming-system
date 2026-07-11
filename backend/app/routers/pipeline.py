"""
Pipeline management endpoints.

POST /api/v1/pipeline/run   — manually trigger one processing batch (useful for testing)
GET  /api/v1/pipeline/status — check whether models are loaded
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter()


@router.post("/run")
def trigger_pipeline(db: Session = Depends(get_db)):
    """Process all currently pending sensor images immediately."""
    from worker.pipeline import run_once
    processed = run_once(db)
    return {"processed": processed, "message": f"Processed {processed} image(s)."}


@router.get("/status")
def pipeline_status():
    """Report whether each model is loaded and ready."""
    from worker import yolo_runner, xgboost_runner
    return {
        "yolo_ready":    yolo_runner.is_ready(),
        "xgboost_ready": xgboost_runner.is_ready(),
    }

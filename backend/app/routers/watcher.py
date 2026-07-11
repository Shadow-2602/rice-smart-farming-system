"""
Watcher control endpoints.

GET  /api/v1/watcher/status   current state, last scan, last result
POST /api/v1/watcher/scan     trigger one scan immediately (sync)
POST /api/v1/watcher/start    start the periodic background scanner
POST /api/v1/watcher/stop     stop the periodic background scanner
"""
from fastapi import APIRouter

from app.services import watcher

router = APIRouter()


@router.get("/status")
def status():
    return watcher.get_status()


@router.post("/scan")
def scan_now():
    return watcher.scan_once()


@router.post("/start")
def start():
    watcher.start()
    return watcher.get_status()


@router.post("/stop")
def stop():
    watcher.stop()
    return watcher.get_status()

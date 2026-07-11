import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import advisory, alerts, images, pipeline, predictions, sensors, watcher
from app.services import watcher as watcher_service
from app.services.storage import init_storage
from app.services.topology import ensure_field_layout

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_storage()

    # Reconcile sensor topology before any request can land.
    # Wrap in a clear error so the most common failure mode (MySQL not running)
    # surfaces as an actionable message instead of a raw OperationalError traceback.
    try:
        ensure_field_layout(settings.FIELD_LAYOUT)
    except Exception as exc:
        logger.critical(
            "\n"
            "══════════════════════════════════════════════════════════\n"
            "  STARTUP FAILED — cannot connect to MySQL.\n"
            "  Fix: start MySQL via XAMPP before launching the backend.\n"
            f"  Detail: {exc}\n"
            "══════════════════════════════════════════════════════════"
        )
        raise SystemExit(1) from exc

    from worker import xgboost_runner, yolo_runner
    from worker.pipeline import XGBOOST_MODEL_PATH, YOLO_MODEL_PATH
    yolo_runner.load_model(YOLO_MODEL_PATH)
    xgboost_runner.load_model(XGBOOST_MODEL_PATH)

    if settings.WATCH_AUTOSTART:
        watcher_service.start()
    else:
        logger.info("Watcher autostart disabled — POST /api/v1/watcher/start to launch manually")

    yield

    watcher_service.stop()


app = FastAPI(
    title="Rice Smart Farming API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensors.router,     prefix="/api/v1/sensors",     tags=["sensors"])
app.include_router(predictions.router, prefix="/api/v1/predictions", tags=["predictions"])
app.include_router(alerts.router,      prefix="/api/v1/alerts",      tags=["alerts"])
app.include_router(images.router,      prefix="/api/v1/images",      tags=["images"])
app.include_router(pipeline.router,    prefix="/api/v1/pipeline",    tags=["pipeline"])
app.include_router(watcher.router,     prefix="/api/v1/watcher",     tags=["watcher"])
app.include_router(advisory.router,    prefix="/api/v1/advisory",    tags=["advisory"])


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}

from pathlib import Path

from pydantic_settings import BaseSettings

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    DATABASE_URL: str
    STORAGE_DIR: str = str(PROJECT_ROOT / "storage")
    RAW_SUBDIR: str = "raw"
    ANNOTATED_SUBDIR: str = "annotated"

    # ---- Watcher ----
    # Folder the watcher polls for new images. Folder structure is ignored —
    # images are distributed randomly across sensors defined by FIELD_LAYOUT.
    WATCH_DIR: str = "D:/FYP2/test_images"
    WATCH_INTERVAL_SECONDS: int = 30
    WATCH_AUTOSTART: bool = True

    # ---- Field topology ----
    # Format: "Zone A:4,Zone B:3,Zone C:3" → 10 sensors total
    # On startup the system ensures sensors named Sensor 1..N exist with
    # field_zone assignments matching this layout.
    FIELD_LAYOUT: str = "Zone A:4,Zone B:3,Zone C:3"

    # ---- Ollama (advisory chat) ----
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    model_config = {"env_file": str(PROJECT_ROOT / ".env"), "extra": "ignore"}

    @property
    def raw_path(self) -> Path:
        return Path(self.STORAGE_DIR) / self.RAW_SUBDIR

    @property
    def annotated_path(self) -> Path:
        return Path(self.STORAGE_DIR) / self.ANNOTATED_SUBDIR


settings = Settings()

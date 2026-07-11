from pathlib import Path

from app.config import settings


def init_storage() -> None:
    settings.raw_path.mkdir(parents=True, exist_ok=True)
    settings.annotated_path.mkdir(parents=True, exist_ok=True)


def save_raw_image(relative_key: str, data: bytes) -> Path:
    target = settings.raw_path / relative_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target


def save_annotated_image(relative_key: str, data: bytes) -> Path:
    target = settings.annotated_path / relative_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target


def read_image(absolute_path: str) -> bytes:
    return Path(absolute_path).read_bytes()

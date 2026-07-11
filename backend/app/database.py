from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,   # test connections before handing them out (catches stale sockets)
    pool_size=10,         # connections kept open; covers FastAPI + watcher thread
    max_overflow=10,      # extra connections allowed under burst load
    pool_recycle=1800,    # recycle connections after 30min to avoid MySQL 8hr timeout
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

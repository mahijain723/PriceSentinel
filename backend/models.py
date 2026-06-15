"""
SQLAlchemy models for PriceSentinel.
"""

from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, DateTime, JSON
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./pricesentinel.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class WatchedPage(Base):
    __tablename__ = "watched_pages"

    id = Column(Integer, primary_key=True)
    url = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, default="")
    selector = Column(String, default="")
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    poll_interval_hours = Column(Integer, default=24)


class PageSnapshot(Base):
    __tablename__ = "page_snapshots"

    id = Column(Integer, primary_key=True)
    page_id = Column(Integer, nullable=False, index=True)
    html = Column(Text, default="")
    fetched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DiffResult(Base):
    __tablename__ = "diff_results"

    id = Column(Integer, primary_key=True)
    page_id = Column(Integer, nullable=False, index=True)
    snapshot_id = Column(Integer, nullable=False)
    prev_snapshot_id = Column(Integer, nullable=True)
    diff_json = Column(JSON, default=list)  # list of {type, text} segments
    summary = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id = Column(Integer, primary_key=True)
    page_id = Column(Integer, nullable=True)  # null = global config
    email = Column(String, default="")
    slack_webhook = Column(String, default="")
    telegram_token = Column(String, default="")
    telegram_chat_id = Column(String, default="")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

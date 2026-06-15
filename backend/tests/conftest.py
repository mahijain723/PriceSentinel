"""Shared pytest fixtures: temporary SQLite, TestClient, mock fetcher."""

import os
import tempfile
from unittest.mock import AsyncMock
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from main import app


@pytest.fixture(scope="session")
def _tmp_db() -> Generator[str, None, None]:
    """Session-scoped temp DB path. One per run."""
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    yield path
    try:
        os.unlink(path)
    except OSError:
        pass


@pytest.fixture
def db(_tmp_db: str) -> Generator[Session, None, None]:
    """Fresh DB per test. Patches every module that has a SessionLocal copy."""
    import models
    import services.poll
    import services.scheduler
    import routers.pages

    engine = create_engine(f"sqlite:///{_tmp_db}?check_same_thread=false", echo=False)
    models.Base.metadata.create_all(bind=engine)

    new_sessionmaker = sessionmaker(bind=engine)

    # Patch all modules that imported SessionLocal at module level
    models.SessionLocal = new_sessionmaker
    services.poll.SessionLocal = new_sessionmaker
    services.scheduler.SessionLocal = new_sessionmaker
    routers.pages.SessionLocal = new_sessionmaker

    session = models.SessionLocal()

    # Clear all tables between tests for isolation
    for table in reversed(models.Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()

    yield session
    session.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    """FastAPI TestClient with fresh per-test DB."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_fetcher() -> AsyncMock:
    """Mock services.fetcher.fetch_page to return controlled HTML."""
    import services.poll as poll_module
    mock = AsyncMock(return_value="<html>fetched page</html>")
    poll_module.fetch_page = mock
    return mock

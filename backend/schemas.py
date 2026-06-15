"""
Pydantic schemas for request/response validation.
"""

from datetime import datetime
from pydantic import BaseModel


class PageCreate(BaseModel):
    url: str
    title: str = ""
    selector: str = ""


class PageResponse(BaseModel):
    id: int
    url: str
    title: str
    selector: str
    added_at: datetime
    poll_interval_hours: int


class DiffSegment(BaseModel):
    type: str  # "added", "removed", "unchanged"
    text: str


class ChangeResponse(BaseModel):
    id: int
    page_id: int
    summary: str
    diff: list[DiffSegment]
    created_at: datetime


class AlertConfigCreate(BaseModel):
    page_id: int | None = None
    email: str = ""
    slack_webhook: str = ""
    telegram_token: str = ""
    telegram_chat_id: str = ""

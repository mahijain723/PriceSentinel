"""Routers for change detection results."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from models import get_db, DiffResult, WatchedPage
from schemas import ChangeResponse

router = APIRouter(prefix="/changes", tags=["changes"])


@router.get("", response_model=list[ChangeResponse])
async def get_changes(
    url: str = Query(...),
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
):
    page = db.query(WatchedPage).filter(WatchedPage.url == url).first()
    if not page:
        return []
    diffs = (
        db.query(DiffResult)
        .filter(DiffResult.page_id == page.id)
        .order_by(DiffResult.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ChangeResponse(
            id=d.id,
            page_id=d.page_id,
            summary=d.summary,
            diff=d.diff_json,
            created_at=d.created_at,
        )
        for d in diffs
    ]


@router.get("/unread-count")
async def unread_counts(db: Session = Depends(get_db)):
    """Return count of changes per watched page."""
    pages = db.query(WatchedPage).all()
    result = {}
    for p in pages:
        count = (
            db.query(DiffResult)
            .filter(DiffResult.page_id == p.id)
            .count()
        )
        if count > 0:
            result[p.url] = count
    return result

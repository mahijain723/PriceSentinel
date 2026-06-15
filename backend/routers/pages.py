"""Routers for watched page CRUD."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import get_db, WatchedPage, init_db
from schemas import PageCreate, PageResponse

router = APIRouter(prefix="/pages", tags=["pages"])

init_db()  # ensure tables exist


@router.get("", response_model=list[PageResponse])
async def list_pages(db: Session = Depends(get_db)):
    return db.query(WatchedPage).all()


@router.post("", response_model=PageResponse)
async def add_page(body: PageCreate, db: Session = Depends(get_db)):
    existing = db.query(WatchedPage).filter(WatchedPage.url == body.url).first()
    if existing:
        raise HTTPException(400, "Page already watched")
    page = WatchedPage(url=body.url, title=body.title, selector=body.selector)
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


@router.delete("")
async def remove_page(url: str, db: Session = Depends(get_db)):
    page = db.query(WatchedPage).filter(WatchedPage.url == url).first()
    if not page:
        raise HTTPException(404, "Page not found")
    db.delete(page)
    db.commit()
    return {"ok": True}


@router.post("/poll")
async def trigger_poll(url: str, db: Session = Depends(get_db)):
    """Trigger an immediate poll for a watched page."""
    page = db.query(WatchedPage).filter(WatchedPage.url == url).first()
    if not page:
        raise HTTPException(404, "Page not found")
    from services.poll import poll_page
    await poll_page(page.id)
    return {"ok": True, "page_id": page.id}

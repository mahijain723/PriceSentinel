"""
Poll worker — the complete poll cycle for one page:
fetch → diff → store → notify
"""

from models import WatchedPage, PageSnapshot, DiffResult, AlertConfig, SessionLocal
from services.fetcher import fetch_page
from services.differ import diff_text, has_meaningful_change
from services.notifier import notify_all


async def poll_page(page_id: int):
    """Run one poll cycle for a watched page."""
    db = SessionLocal()
    try:
        page = db.query(WatchedPage).filter(WatchedPage.id == page_id).first()
        if not page:
            print(f"[poll] Page {page_id} not found")
            return

        html = await fetch_page(page.url)
        if html is None:
            print(f"[poll] Fetch failed for {page.url}")
            return

        # Get latest snapshot for comparison
        prev = (
            db.query(PageSnapshot)
            .filter(PageSnapshot.page_id == page_id)
            .order_by(PageSnapshot.id.desc())
            .first()
        )

        if prev and prev.html:
            diff = diff_text(prev.html, html, selector=page.selector or None)
            if has_meaningful_change(diff):
                snapshot = PageSnapshot(page_id=page_id, html=html)
                db.add(snapshot)
                db.commit()
                db.refresh(snapshot)

                diff_rec = DiffResult(
                    page_id=page_id,
                    snapshot_id=snapshot.id,
                    prev_snapshot_id=prev.id,
                    diff_json=diff,
                    summary=f"Change detected on {page.title or page.url}",
                )
                db.add(diff_rec)
                db.commit()

                # Send notifications
                alerts = db.query(AlertConfig).filter(
                    (AlertConfig.page_id == page_id) | (AlertConfig.page_id.is_(None))
                ).all()
                for alert in alerts:
                    notify_all(
                        email=alert.email,
                        slack_url=alert.slack_webhook,
                        tg_token=alert.telegram_token,
                        tg_chat=alert.telegram_chat_id,
                        subject=f"PriceSentinel: Change on {page.title or page.url}",
                        body=diff_rec.summary,
                    )
                print(f"[poll] Change detected and notified for {page.url}")
            else:
                print(f"[poll] No meaningful change for {page.url}")
        else:
            # First fetch — just store the snapshot
            snapshot = PageSnapshot(page_id=page_id, html=html)
            db.add(snapshot)
            db.commit()
            print(f"[poll] Initial snapshot stored for {page.url}")

    except Exception as e:
        print(f"[poll] Error polling page {page_id}: {e}")
    finally:
        db.close()

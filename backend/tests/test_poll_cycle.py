"""Full poll cycle integration tests.

The poll orchestrator (poll_page) is the most critical function
in the backend — a silent failure means missed price changes.
"""

from unittest.mock import patch, AsyncMock
import pytest
from models import WatchedPage, PageSnapshot, DiffResult, SessionLocal
from services.poll import poll_page


async def _seed_page(db, url="https://example.com/pricing", title="Example", selector=None):
    """Helper: create a watched page and a baseline snapshot."""
    page = WatchedPage(url=url, title=title, selector=selector or "")
    db.add(page)
    db.commit()
    db.refresh(page)

    # Baseline snapshot
    snap = PageSnapshot(page_id=page.id, html="<html><body>Base content</body></html>")
    db.add(snap)
    db.commit()
    return page


@pytest.mark.asyncio
async def test_poll_happy_path(db):
    """Fetch returns new HTML → diff detected → snapshot + diff stored."""
    page = await _seed_page(db)
    with patch("services.poll.fetch_page", new_callable=AsyncMock) as mock:
        mock.return_value = "<html><body>Updated content</body></html>"

        await poll_page(page.id)

        snapshots = db.query(PageSnapshot).filter(PageSnapshot.page_id == page.id).all()
        assert len(snapshots) == 2, "New snapshot should be stored"

        diffs = db.query(DiffResult).filter(DiffResult.page_id == page.id).all()
        assert len(diffs) == 1
        assert diffs[0].diff_json is not None


@pytest.mark.asyncio
async def test_poll_no_change(db):
    """Fetch returns same HTML → no new snapshot created."""
    page = await _seed_page(db)
    with patch("services.poll.fetch_page", new_callable=AsyncMock) as mock:
        mock.return_value = "<html><body>Base content</body></html>"

        await poll_page(page.id)

        snapshots = db.query(PageSnapshot).filter(PageSnapshot.page_id == page.id).all()
        assert len(snapshots) == 1, "No new snapshot for unchanged content"

        diffs = db.query(DiffResult).filter(DiffResult.page_id == page.id).all()
        assert len(diffs) == 0, "No diff for unchanged content"


@pytest.mark.asyncio
async def test_poll_first_fetch(db):
    """No baseline snapshot → store initial snapshot silently."""
    page = WatchedPage(url="https://example.com/new", title="New Page", selector="")
    db.add(page)
    db.commit()
    db.refresh(page)

    with patch("services.poll.fetch_page", new_callable=AsyncMock) as mock:
        mock.return_value = "<html><body>First fetch</body></html>"

        await poll_page(page.id)

        snapshots = db.query(PageSnapshot).filter(PageSnapshot.page_id == page.id).all()
        assert len(snapshots) == 1

        diffs = db.query(DiffResult).filter(DiffResult.page_id == page.id).all()
        assert len(diffs) == 0, "No diff on first fetch"


@pytest.mark.asyncio
async def test_poll_fetch_fails(db):
    """Fetch returns None → no crash, existing data preserved."""
    page = await _seed_page(db)
    with patch("services.poll.fetch_page", new_callable=AsyncMock) as mock:
        mock.return_value = None

        await poll_page(page.id)

        snapshots = db.query(PageSnapshot).filter(PageSnapshot.page_id == page.id).all()
        assert len(snapshots) == 1, "No new snapshot after fetch failure"

        diffs = db.query(DiffResult).filter(DiffResult.page_id == page.id).all()
        assert len(diffs) == 0


@pytest.mark.asyncio
async def test_poll_page_not_found(db):
    """Poll for a nonexistent page_id → no crash."""
    with patch("services.poll.fetch_page", new_callable=AsyncMock) as mock:
        await poll_page(999)  # no such page
        mock.assert_not_called()


@pytest.mark.asyncio
async def test_poll_selector_change_detected(db):
    """Selector is set → change inside the selected element is caught."""
    base = """<html><body>
      <div class="pricing"><span class="price">$29</span></div>
      <footer>Same footer</footer>
    </body></html>"""
    updated = """<html><body>
      <div class="pricing"><span class="price">$49</span></div>
      <footer>Same footer</footer>
    </body></html>"""

    page = await _seed_page(db, url="https://example.com/selector", selector=".price")

    # Overwrite baseline with content matching the selector target
    baseline = db.query(PageSnapshot).filter(PageSnapshot.page_id == page.id).first()
    baseline.html = base
    db.commit()

    with patch("services.poll.fetch_page", new_callable=AsyncMock) as mock:
        mock.return_value = updated
        await poll_page(page.id)

        diffs = db.query(DiffResult).filter(DiffResult.page_id == page.id).all()
        assert len(diffs) == 1, "Change inside selector should be detected"


@pytest.mark.asyncio
async def test_poll_selector_change_outside(db):
    """Selector is set → change outside selected element is ignored."""
    base = """<html><body>
      <div class="pricing"><span class="price">$29</span></div>
      <footer>Old footer</footer>
    </body></html>"""
    updated = """<html><body>
      <div class="pricing"><span class="price">$29</span></div>
      <footer>Updated footer</footer>
    </body></html>"""

    page = await _seed_page(db, url="https://example.com/selector-ignore", selector=".price")

    baseline = db.query(PageSnapshot).filter(PageSnapshot.page_id == page.id).first()
    baseline.html = base
    db.commit()

    with patch("services.poll.fetch_page", new_callable=AsyncMock) as mock:
        mock.return_value = updated
        await poll_page(page.id)

        diffs = db.query(DiffResult).filter(DiffResult.page_id == page.id).all()
        assert len(diffs) == 0, "Change outside selector should be ignored"

"""
APScheduler-based poll scheduler.
Runs in-process with the FastAPI app. No Redis needed for MVP.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        print("[scheduler] Started")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[scheduler] Stopped")


def schedule_poll(page_id: int, hours: int = 24):
    """Schedule a recurring poll for a watched page."""
    from services.poll import poll_page
    scheduler.add_job(
        poll_page,
        "interval",
        args=[page_id],
        hours=hours,
        id=f"poll_{page_id}",
        replace_existing=True,
        misfire_grace_time=300,
    )
    print(f"[scheduler] Scheduled poll for page {page_id} every {hours}h")


def remove_poll(page_id: int):
    job_id = f"poll_{page_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        print(f"[scheduler] Removed poll for page {page_id}")


async def run_poll_once(page_id: int):
    """Run a single poll cycle immediately."""
    from services.poll import poll_page
    await poll_page(page_id)

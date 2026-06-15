"""
Page fetcher using httpx.
Lightweight HTTP client — no browser download needed for MVP.
"""
import httpx
from httpx import HTTPError


async def fetch_page(url: str) -> str | None:
    """Fetch a page and return its HTML text, or None on failure."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        try:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.text
        except HTTPError as e:
            print(f"[fetcher] Failed to fetch {url}: {e}")
            return None

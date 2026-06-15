"""
PriceSentinel — Backend API

FastAPI server that polls watched pages, diffs them, and dispatches notifications.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import pages, changes, alerts
from services.scheduler import start_scheduler, stop_scheduler, restore_polls


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    # Resume polling for all watched pages after restart
    restore_polls()
    yield
    stop_scheduler()


app = FastAPI(title="PriceSentinel", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pages.router)
app.include_router(changes.router)
app.include_router(alerts.router)


@app.get("/health")
async def health():
    return {"status": "ok"}

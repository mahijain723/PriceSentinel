"""
Routers for alert/notification config.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import get_db, AlertConfig
from schemas import AlertConfigCreate

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def get_alerts(db: Session = Depends(get_db)):
    configs = db.query(AlertConfig).all()
    return configs


@router.post("")
async def set_alerts(body: AlertConfigCreate, db: Session = Depends(get_db)):
    config = AlertConfig(**body.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config

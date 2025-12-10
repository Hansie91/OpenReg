"""Destinations API stub"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.auth import get_current_user
import models

router = APIRouter()

@router.get("")
async def list_destinations(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List SFTP/FTP destinations - TODO: Implement full CRUD + connection test"""
    return []

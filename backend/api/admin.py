"""Admin API stub"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.auth import get_current_user
import models

router = APIRouter()

@router.get("/users")
async def list_users(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List users - TODO: Implement user management"""
    return []

@router.get("/audit")
async def list_audit_logs(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List audit logs - TODO: Implement with pagination and filtering"""
    return []

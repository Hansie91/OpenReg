"""Stub API routers for remaining endpoints"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from services.auth import get_current_user
import models

# Each module exports a router

# Mappings/Cross-Reference
mappings_router = APIRouter()

@mappings_router.get("")
async def list_mappings(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List mapping sets - TODO: Implement full CRUD"""
    return []

router = mappings_router

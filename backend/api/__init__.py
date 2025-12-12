"""API package initialization"""

from fastapi import APIRouter

# Import all routers
from . import auth, reports, connectors, mappings, validations, schedules, destinations, runs, admin, exceptions, queries, logs, submissions

__all__ = [
    "auth",
    "reports",
    "connectors",
    "mappings",
    "validations",
    "schedules",
    "destinations",
    "runs",
    "admin",
    "exceptions",
    "queries",
    "logs",
    "submissions"
]

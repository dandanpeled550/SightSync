import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.logging_config import setup_logging
from app.routers import health, weather, daily_log, crew, incidents, materials, tasks, onboarding

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="SightSync API", lifespan=lifespan)

_cors_origins = list(settings.cors_origins)
if settings.frontend_url and settings.frontend_url not in _cors_origins:
    _cors_origins.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(weather.router)
app.include_router(daily_log.router)
app.include_router(crew.router)
app.include_router(incidents.router)
app.include_router(materials.router)
app.include_router(tasks.router)
app.include_router(onboarding.router)

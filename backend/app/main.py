from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, weather, daily_log, crew, incidents, materials, tasks, onboarding


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="SightSync API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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

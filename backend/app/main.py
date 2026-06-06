import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings
from app.logging_config import setup_logging
from app.routers import health, weather, daily_log, crew, incidents, materials, tasks, onboarding

setup_logging()
logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = int(request.headers.get("content-length", 0))
        logger.info("→ %s %s (%d bytes)", request.method, request.url.path, content_length)

        if logger.isEnabledFor(logging.DEBUG):
            req_ct = request.headers.get("content-type", "")
            if "application/json" in req_ct or req_ct.startswith("text/"):
                body = await request.body()
                logger.debug("  request body: %s", body.decode("utf-8", errors="replace")[:2000])

        start = time.perf_counter()
        response = await call_next(request)
        elapsed = int((time.perf_counter() - start) * 1000)

        logger.info("← %d in %dms", response.status_code, elapsed)

        if logger.isEnabledFor(logging.DEBUG):
            resp_ct = response.headers.get("content-type", "")
            if "application/json" in resp_ct:
                chunks = []
                async for chunk in response.body_iterator:
                    chunks.append(chunk)
                body = b"".join(chunks)
                logger.debug("  response body: %s", body.decode("utf-8", errors="replace")[:2000])
                return Response(
                    content=body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )

        return response


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
app.add_middleware(RequestLoggingMiddleware)

app.include_router(health.router)
app.include_router(weather.router)
app.include_router(daily_log.router)
app.include_router(crew.router)
app.include_router(incidents.router)
app.include_router(materials.router)
app.include_router(tasks.router)
app.include_router(onboarding.router)

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/weather", tags=["weather"])

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


class DailyForecast(BaseModel):
    date: str
    max_temp: float
    min_temp: float
    weather_code: int
    precipitation: float


class WeatherResponse(BaseModel):
    city: str
    country: str
    latitude: float
    longitude: float
    forecast: list[DailyForecast]


@router.get("", response_model=WeatherResponse)
async def get_weather(city: str = Query(..., min_length=1, max_length=100)) -> WeatherResponse:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo_resp = await client.get(
                GEOCODING_URL,
                params={"name": city, "count": 1, "language": "en", "format": "json"},
            )
            geo_resp.raise_for_status()
            results = geo_resp.json().get("results")

            if not results:
                raise HTTPException(status_code=404, detail=f"City '{city}' not found")

            place = results[0]
            lat = place["latitude"]
            lon = place["longitude"]

            forecast_resp = await client.get(
                FORECAST_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "daily": "temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum",
                    "timezone": "auto",
                    "forecast_days": 7,
                },
            )
            forecast_resp.raise_for_status()
            daily = forecast_resp.json()["daily"]

            return WeatherResponse(
                city=place["name"],
                country=place.get("country_code", ""),
                latitude=lat,
                longitude=lon,
                forecast=[
                    DailyForecast(
                        date=daily["time"][i],
                        max_temp=daily["temperature_2m_max"][i],
                        min_temp=daily["temperature_2m_min"][i],
                        weather_code=daily["weathercode"][i],
                        precipitation=daily["precipitation_sum"][i] or 0.0,
                    )
                    for i in range(7)
                ],
            )
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Weather service timed out")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {e.response.status_code}")

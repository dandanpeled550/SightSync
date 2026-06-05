import httpx

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def wmo_to_conditions(code: int) -> str:
    if code == 0:
        return "Clear"
    if code <= 3:
        return "Partly Cloudy"
    if code <= 48:
        return "Foggy"
    if code <= 67:
        return "Rain"
    if code <= 77:
        return "Snow"
    if code <= 82:
        return "Showers"
    return "Thunderstorm"


async def fetch_weather_for_location(lat: float, lon: float) -> dict:
    """Fetch today's weather from Open-Meteo. Returns a dict of weather fields or raises on failure."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            FORECAST_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max",
                "timezone": "auto",
                "forecast_days": 1,
            },
        )
        resp.raise_for_status()
        daily = resp.json()["daily"]
        code = daily["weathercode"][0]
        return {
            "weather_temp_max": daily["temperature_2m_max"][0],
            "weather_temp_min": daily["temperature_2m_min"][0],
            "weather_code": code,
            "weather_conditions": wmo_to_conditions(code),
            "weather_precipitation": daily["precipitation_sum"][0] or 0.0,
            "weather_wind_speed": daily["windspeed_10m_max"][0] or 0.0,
        }

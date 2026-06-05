from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    frontend_url: str = "http://localhost:5173"
    secret_key: str = "dev-secret-change-me"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

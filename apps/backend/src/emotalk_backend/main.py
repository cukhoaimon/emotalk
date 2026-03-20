from fastapi import FastAPI

from emotalk_backend.api.router import api_router
from emotalk_backend.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.include_router(api_router)


@app.get("/", summary="Service metadata")
def root() -> dict[str, str]:
    return {"name": settings.app_name, "environment": settings.app_env}

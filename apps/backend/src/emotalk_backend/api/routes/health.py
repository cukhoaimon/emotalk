from fastapi import APIRouter

router = APIRouter()


@router.get("", summary="Health check")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}

# Backend (Python / FastAPI)

Production-oriented Python backend scaffold for an AI-heavy application.

## Stack

- FastAPI + Uvicorn
- Pydantic Settings for environment configuration
- Ruff (lint/format), Pytest, Mypy
- Docker image for deployment
- `uv` for dependency and virtual environment management

## Structure

- `src/emotalk_backend/` application package
- `src/emotalk_backend/api/routes/health.py` health endpoint
- `tests/` backend tests

## Quick Start

1. Install `uv` if not installed:
   - https://docs.astral.sh/uv/getting-started/installation/
2. Install dependencies:
   - `make install`
3. Run service in dev mode:
   - `make dev`

Service URL: `http://localhost:8000`
OpenAPI docs: `http://localhost:8000/docs`

## Environment

Copy `.env.example` to `.env` and adjust values.

## Team Conventions

- Keep API routes under `api/routes`.
- Keep settings and infrastructure concerns in `config.py`.
- Keep AI orchestration modules isolated (for example under `src/emotalk_backend/ai/`) to avoid coupling with HTTP layers.

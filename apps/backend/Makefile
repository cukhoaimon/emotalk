PYTHON ?= python3

.PHONY: dev install lint test typecheck run

install:
	uv sync --all-groups

dev:
	uv run uvicorn emotalk_backend.main:app --reload --host 0.0.0.0 --port 8000

run:
	uv run uvicorn emotalk_backend.main:app --host 0.0.0.0 --port 8000

lint:
	uv run ruff check src tests
	uv run ruff format --check src tests

test:
	uv run pytest -q

typecheck:
	uv run mypy src


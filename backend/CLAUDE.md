# Backend — Agent Guidelines

## Run tests
```bash
cd backend && .venv/bin/python -m pytest tests/ -v
```

## Create a migration
```bash
cd backend && .venv/bin/alembic revision --autogenerate -m "description"
cd backend && .venv/bin/alembic upgrade head
```

## New router checklist
1. Create `backend/app/routers/{name}.py`
2. Register in `backend/app/main.py`
3. Create `backend/tests/test_{name}.py` with 10+ tests using `seeded_client`

## Cascade service contract
```
preview_cascade() — returns results, NEVER writes to DB
apply_cascade()   — writes new dates to DB, returns same shape
Both live in backend/app/services/cascade.py
```

## AI service rules
- Mock `anthropic.Anthropic()` in ALL unit tests via `unittest.mock.patch`
- If `ANTHROPIC_API_KEY` is absent, endpoints must return graceful degraded responses
- Use `settings.anthropic_model` for the model ID — never hardcode it

## end_date computation
Always compute in the router: `end_date = start_date + timedelta(days=duration_days)`
Do not use DB-level triggers or computed columns.

## Fixtures in conftest.py
- `client` — empty DB
- `seeded_client` — project_id=1 + daily log; access via `c.project_id`, `c.log_id`
- `seeded_client_with_tasks` — above + 3 tasks + 2 dependencies (added in Sprint 2)

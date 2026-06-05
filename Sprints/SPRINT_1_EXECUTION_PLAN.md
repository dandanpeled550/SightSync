# Sprint 1 — Execution Plan

> Living document. Update as features are completed.
> Brief: `Sprints/simple_claude_code_brief.md`

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + TypeScript, port 5173 |
| Backend | FastAPI + SQLAlchemy + Alembic + Python 3.9 |
| DB (local) | SQLite (`backend/sightsync.db`) |
| DB (prod) | PostgreSQL on Render |
| Weather API | Open-Meteo (free, no API key) |

---

## How to Run Locally

```bash
# Backend (from backend/)
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev   # must start on :5173 — kill stale node processes if it bumps to :5174
```

First-time setup (already done — skip if `sightsync.db` exists):
```bash
cd backend
.venv/bin/alembic upgrade head
.venv/bin/python seed.py
```

Run tests:
```bash
cd backend
.venv/bin/python -m pytest tests/ -v
```

---

## Feature Status

| # | Feature | Status | Tests |
|---|---|---|---|
| 0 | Data Models + Migration | ✅ Done | — |
| 1 | Weather Auto-Fetch on Daily Log | ✅ Done | — |
| 2 | Crew Management + Daily Attendance | ✅ Done | 32 passing |
| 3 | Safety Incidents | ✅ Done | 13 passing |
| 4 | Materials Used | ✅ Done | 17 passing |
| CORS | Config-driven origins + CORS tests | ✅ Done | 5 passing |
| 5 | UI Views (Dashboard + Entry Form) | ⬜ Next | — |

**Total tests: 67 passing** (`test_crew.py` × 32, `test_incidents.py` × 13, `test_materials.py` × 17, `test_cors.py` × 5)

---

## What Was Built

### Feature 0 — Data Models + Migration ✅

All 6 SQLAlchemy models in `backend/app/models.py`:

| Model | Key Fields |
|---|---|
| `Project` | id, name, location_city, latitude, longitude |
| `DailyLog` | id, project_id, date (unique per project), weather_temp_max/min, weather_code, weather_conditions, weather_precipitation, weather_wind_speed, weather_error |
| `CrewMember` | id, project_id, name, id_number, profession, reason |
| `CrewAttendance` | id, daily_log_id, crew_member_id, status (present/absent/partial), note |
| `SafetyIncident` | id, daily_log_id, incident_type, description, people_involved, corrective_action, photo_url |
| `MaterialEntry` | id, daily_log_id, material_name, quantity (float), unit, notes, photo_url |

Migrations applied (in order):
- `883289a5f109_initial_models.py`
- `4af695a56d2a_crew_member_details.py`

Seed data (loaded): Project "Downtown Office Build" (Tel Aviv, lat 32.0853 / lon 34.7818) + 5 crew members.

---

### Feature 1 — Weather Auto-Fetch ✅

- `backend/app/services/weather.py` — `fetch_weather_for_location(lat, lon)` via Open-Meteo; returns temp_max/min, weather_code, conditions label, precipitation, wind_speed
- `backend/app/routers/daily_log.py`:
  - `POST /daily-logs/today` — find-or-create today's log; fetches weather on creation only (idempotent)
  - `GET /daily-logs/{date}` — returns stored log, 404 if none
- `frontend/src/api/daily_log.ts` — `fetchTodayLog()`, `fetchLogByDate(date)`
- `frontend/src/components/WeatherBlock.tsx` — displays conditions, high/low, precipitation, wind

Hardcoded: `HARDCODED_PROJECT_ID = 1` in `daily_log.py` (no auth this sprint).

---

### Feature 2 — Crew Management + Attendance ✅

**Backend** (`backend/app/routers/crew.py`):

| Endpoint | Purpose |
|---|---|
| `GET /projects/1/crew` | List all crew members (name, id_number, profession, reason) |
| `POST /projects/1/crew` | Add worker |
| `PUT /crew/{id}` | Edit worker (full replace — omitted optional fields become null) |
| `DELETE /crew/{id}` | Remove worker |
| `GET /daily-logs/{log_id}/attendance` | All crew + status for the day (default: absent) |
| `PUT /daily-logs/{log_id}/attendance/{member_id}` | Upsert attendance (status + note) |

**Frontend**:
- `frontend/src/api/crew.ts`
- `frontend/src/pages/CrewManagement.tsx` — table with inline add/edit/delete
- `frontend/src/components/CrewAttendanceBlock.tsx` — status toggles, auto-saves on click, `readOnly` prop

**Tests**: `backend/tests/test_crew.py` — 32 tests, all passing.

Known issue: `PUT /crew/{id}` uses full-replace semantics. Should be `PATCH` for partial updates.

---

### Feature 3 — Safety Incidents ✅

**Backend** (`backend/app/routers/incidents.py`):

| Endpoint | Purpose |
|---|---|
| `GET /daily-logs/{log_id}/incidents` | List incidents (404 if log not found) |
| `POST /daily-logs/{log_id}/incidents` | Add incident (incident_type, description, people_involved?, corrective_action?) |
| `DELETE /daily-logs/{log_id}/incidents/{incident_id}` | Remove incident |

**Frontend**:
- `frontend/src/api/incidents.ts`
- `frontend/src/components/SafetyBlock.tsx` — incident cards with `readOnly` prop; edit mode has add-form + delete per card

**Tests**: `backend/tests/test_incidents.py` — 13 tests, all passing.

---

### Feature 4 — Materials Used ✅

**Backend** (`backend/app/routers/materials.py`):

| Endpoint | Purpose |
|---|---|
| `GET /daily-logs/{log_id}/materials` | List materials (404 if log not found) |
| `POST /daily-logs/{log_id}/materials` | Add entry (material_name, quantity, unit, notes?) |
| `DELETE /daily-logs/{log_id}/materials/{material_id}` | Remove entry |

**Frontend**:
- `frontend/src/api/materials.ts`
- `frontend/src/components/MaterialsBlock.tsx` — table view with `readOnly` prop; edit mode has inline add-row form + delete per row

**Tests**: `backend/tests/test_materials.py` — 17 tests, all passing.

---

### CORS Fix ✅

**Problem**: Vite bumps port from `:5173` to `:5174` when the port is taken. The CORS `allow_origins` list was hardcoded and didn't include `:5174`, silently breaking all browser POST/PUT calls. Tests missed it because `TestClient` never sends `Origin` headers.

**Fix**:
- `backend/app/config.py` — added `cors_origins: list[str]` field (defaults include both :5173 and :5174)
- `backend/app/main.py` — `allow_origins=settings.cors_origins` (no more hardcoded list)
- `backend/.env` — `CORS_ORIGINS=[...]` added
- `backend/tests/conftest.py` — `CORS_ORIGINS` added to env defaults
- `backend/tests/test_cors.py` — 5 CORS tests including `test_second_dev_port_returns_200` which directly catches the original bug

---

## Feature 5 — UI Views ⬜ (Next)

`SafetyBlock` and `MaterialsBlock` are built but not yet wired into the app. The current `App.tsx` only shows "Today's Log" (weather + attendance) and "Crew". This feature adds proper views and wires in all four data domains.

### Nav: `Today's Log` | `Log Entry` | `Crew`

### View A — Today's Log (read-only)

**File:** `frontend/src/pages/DailyLogView.tsx`

- On mount: `POST /daily-logs/today`
- Sections: `WeatherBlock`, `CrewAttendanceBlock` (readOnly), `SafetyBlock` (readOnly), `MaterialsBlock` (readOnly)
- Prev/next date arrows + date label → `GET /daily-logs/{date}` on navigate
- Empty state: each block shows "None" / defaults without crashing

### View B — Log Entry (edit)

**File:** `frontend/src/pages/LogEntryForm.tsx`

- Date selector (default today)
- Weather: stored values + "Re-fetch" button
- `CrewAttendanceBlock` (edit mode — auto-saves on toggle)
- `SafetyBlock` (edit mode — inline add + delete)
- `MaterialsBlock` (edit mode — inline add + delete)

### App.tsx update

Replace inline `log` view content with `DailyLogView`. Add `Log Entry` nav tab pointing to `LogEntryForm`. Keep `Crew` tab as-is.

---

## Known Issues / Tech Debt

| Item | Priority |
|---|---|
| `PUT /crew/{id}` should be `PATCH` (full-replace nulls optional fields) | Low |
| `requirements.txt` pins `psycopg2-binary==2.9.10` but venv has `2.9.12` — update before Render deploy | Before deploy |

---

## Deployment Notes

- Local `.env` uses `DATABASE_URL=sqlite:///./sightsync.db` — **do not commit**
- For Render: set `DATABASE_URL` to the PostgreSQL URL from Render dashboard
- `render.yaml` and `backend/Procfile` already configured for deployment

---

## Out of Scope This Sprint

- Auth / login
- AI summaries and pattern flagging
- PDF export
- Photo uploads (field exists in model, upload UI not built)
- Visual polish / responsive design
- Cascade alerts and schedule dependency logic

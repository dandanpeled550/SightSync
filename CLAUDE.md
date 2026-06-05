# SightSync — CLAUDE.md

Shared context for all Claude agents and sessions working on this project.

---

## What Is SightSync?

SightSync (branded **"simple."**) is a **predictive construction daily log platform** built for foremen and field supervisors. Unlike legacy tools (Raken, Procore) that only document what already happened, SightSync auto-injects field data and calculates real-time impact on future project schedules — so foremen manage by exception, not by manual entry.

**Design mandate:** Mobile-first, high-contrast UI optimized for outdoor visibility on a construction site.

**Users:**
- **Primary:** Foremen / field supervisors
- **Secondary:** Project managers, subcontractors, partners (future: notifications)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript (port 5173) |
| Backend | FastAPI + SQLAlchemy + Alembic + Python 3.9 |
| Database (local) | SQLite — `backend/sightsync.db` |
| Database (prod) | PostgreSQL on Render (managed) |
| Weather | Open-Meteo API — free, no API key needed |
| Deployment | Render.com — `render.yaml` Blueprint at repo root |
| HTTP client (FE) | Axios via `frontend/src/api/client.ts` |
| CSS approach | Inline `React.CSSProperties` objects — no external CSS files |

---

## Project Structure

```
SightSync/
├── CLAUDE.md                          ← this file
├── render.yaml                        ← Render Blueprint (FE + BE + DB)
├── Product Requirement Document.docx  ← full product vision
├── Sprints/
│   ├── simple_claude_code_brief.md    ← Sprint 1 detailed requirements
│   ├── SPRINT_1_EXECUTION_PLAN.md     ← living execution plan + feature status
│   └── Sprint 1.pdf
├── backend/
│   ├── app/
│   │   ├── main.py         ← FastAPI app, CORS, router registration
│   │   ├── models.py       ← all 6 SQLAlchemy ORM models
│   │   ├── database.py     ← engine, SessionLocal, get_db()
│   │   ├── config.py       ← Pydantic BaseSettings (reads .env)
│   │   ├── routers/
│   │   │   ├── daily_log.py   ← POST /daily-logs/today, GET /daily-logs/{date}
│   │   │   ├── crew.py        ← crew CRUD + daily attendance upsert
│   │   │   ├── incidents.py   ← safety incident CRUD
│   │   │   ├── materials.py   ← materials used CRUD
│   │   │   └── weather.py     ← 7-day city forecast (POC/standalone)
│   │   └── services/
│   │       └── weather.py     ← fetch_weather_for_location(), wmo_to_conditions()
│   ├── alembic/            ← migration history
│   ├── tests/
│   │   ├── conftest.py     ← in-memory SQLite fixtures, TestClient setup
│   │   └── test_crew.py    ← 40+ functional tests for crew + attendance
│   ├── seed.py             ← idempotent seed: Project id=1 + 5 crew members
│   ├── Procfile            ← Render process definition
│   ├── railway.toml        ← (unused — Render is the target)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx             ← root component, tab nav, today's log fetch
    │   ├── api/
    │   │   ├── client.ts       ← Axios instance (VITE_API_URL)
    │   │   ├── crew.ts         ← crew CRUD + attendance API calls
    │   │   ├── daily_log.ts    ← fetchTodayLog(), fetchLogByDate()
    │   │   ├── incidents.ts    ← safety incidents API calls
    │   │   ├── materials.ts    ← materials API calls
    │   │   └── weather.ts      ← city forecast API calls (POC)
    │   ├── components/
    │   │   ├── WeatherBlock.tsx          ← displays weather for a daily log
    │   │   ├── CrewAttendanceBlock.tsx   ← attendance toggle per crew member
    │   │   ├── SafetyBlock.tsx           ← incident cards + add/delete
    │   │   ├── MaterialsBlock.tsx        ← materials table + add/delete
    │   │   └── WeatherPOC.tsx            ← 7-day forecast POC (unused in app)
    │   └── pages/
    │       └── CrewManagement.tsx        ← crew registry CRUD page
    └── package.json
```

---

## How to Run Locally

### First-time setup (already done — skip if DB exists)
```bash
cd backend
.venv/bin/alembic upgrade head
.venv/bin/python seed.py
```

### Daily dev — run both in separate terminals
```bash
# Terminal 1 — backend
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev   # starts on :5173 (or :5174 if port taken)
```

### Run tests
```bash
cd backend
.venv/bin/python -m pytest tests/ -v
```

### API docs (auto-generated)
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Data Models (`backend/app/models.py`)

| Model | Key Fields | Notes |
|---|---|---|
| **Project** | id, name, location_city, latitude, longitude | Only one project exists (id=1, "Downtown Office Build", Tel Aviv) |
| **DailyLog** | id, project_id, date, weather_temp_max/min, weather_code, weather_conditions, weather_precipitation, weather_wind_speed, weather_error | date is UNIQUE per project; weather fetched on log creation |
| **CrewMember** | id, project_id, name, id_number, profession, reason | name is required |
| **CrewAttendance** | id, daily_log_id, crew_member_id, status, note | UNIQUE(log, member); status = present/absent/partial |
| **SafetyIncident** | id, daily_log_id, incident_type, description, people_involved, corrective_action, photo_url | description required; photo_url is a stub |
| **MaterialEntry** | id, daily_log_id, material_name, quantity, unit, notes, photo_url | quantity required (float); photo_url is a stub |

All relationships use cascading deletes from Project downward.

---

## API Surface

### Base URL
- Local: `http://localhost:8000`
- Production: configured via `VITE_API_URL` on Render

### Endpoints

| Router | Endpoint | Method | Description |
|---|---|---|---|
| health | `/health` | GET | Returns `{"status": "ok"}` |
| daily_log | `/daily-logs/today` | POST | Get or create today's log; auto-fetches weather |
| daily_log | `/daily-logs/{date}` | GET | Fetch log by ISO date (YYYY-MM-DD); 404 if missing |
| crew | `/projects/{project_id}/crew` | GET | List all crew for a project |
| crew | `/projects/{project_id}/crew` | POST | Add crew member (name required) |
| crew | `/crew/{member_id}` | PUT | Update crew member fields |
| crew | `/crew/{member_id}` | DELETE | Remove crew member (204) |
| crew | `/daily-logs/{log_id}/attendance` | GET | List all crew with attendance status (defaults absent) |
| crew | `/daily-logs/{log_id}/attendance/{member_id}` | PUT | Upsert attendance (status + optional note) |
| incidents | `/daily-logs/{log_id}/incidents` | GET | List incidents |
| incidents | `/daily-logs/{log_id}/incidents` | POST | Create incident (201) |
| incidents | `/daily-logs/{log_id}/incidents/{id}` | DELETE | Remove incident (204) |
| materials | `/daily-logs/{log_id}/materials` | GET | List materials |
| materials | `/daily-logs/{log_id}/materials` | POST | Create material entry (201) |
| materials | `/daily-logs/{log_id}/materials/{id}` | DELETE | Remove material (204) |
| weather | `/weather?city={name}` | GET | 7-day city forecast (standalone POC) |

---

## Frontend Architecture Patterns

- **Inline CSS only** — use `React.CSSProperties` objects, no external `.css` files or CSS modules.
- **API layer** — all HTTP calls live in `frontend/src/api/`. Never call Axios directly from a component.
- **Block components** — each data domain (crew, safety, materials, weather) has its own self-contained block component that fetches its own data given a `logId` prop. Blocks support a `readOnly` prop.
- **State management** — local `useState`/`useEffect` only. No Redux or context. Keep state co-located to the component that owns it.
- **Optimistic updates** — blocks update local state immediately, then roll back on API error.
- **TypeScript interfaces** — define request/response shapes in the `api/*.ts` files. Use them throughout.

---

## Backend Architecture Patterns

- **Router-per-domain** — one file per data domain in `backend/app/routers/`. Register all routers in `main.py`.
- **Services for external calls** — anything calling an external API (e.g. Open-Meteo) lives in `backend/app/services/`, not in routers.
- **Dependency injection** — always use `db: Session = Depends(get_db)` in route signatures.
- **Upsert pattern** — `POST /daily-logs/today` and attendance use upsert (update if exists, create if not). Prefer this over separate create/update endpoints when applicable.
- **Resilient error storage** — weather fetch errors are stored in `DailyLog.weather_error` and never cause the request to fail. Follow this pattern for any optional external data.
- **Migrations** — every model change requires a new Alembic migration: `cd backend && .venv/bin/alembic revision --autogenerate -m "description"` then `upgrade head`.
- **`end_date` computation** — always compute in the router: `end_date = start_date + timedelta(days=duration_days)`. Do not use DB-level triggers or computed columns.

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | Backend `.env` | `sqlite:///./sightsync.db` locally; `postgresql://...` on Render |
| `FRONTEND_URL` | Backend `.env` | Used for CORS; defaults to `http://localhost:5173` |
| `SECRET_KEY` | Backend `.env` | Defaults to `dev-secret-change-me` (change for prod) |
| `VITE_API_URL` | Frontend `.env` | Backend base URL; defaults to `http://localhost:8000` |
| `ANTHROPIC_API_KEY` | Backend `.env` / Render env | Required for Sprint 4+ AI features; leave empty for local/CI to use mock paths |

Never commit `.env` files. On Render, `DATABASE_URL` and `FRONTEND_URL` are injected automatically via the Blueprint.

---

## Seed Data

Seeded by `backend/seed.py` (idempotent — safe to re-run):

- **Project id=1:** "Downtown Office Build" — Tel Aviv (lat 32.0853, lon 34.7818)
- **Crew members:** Avi Cohen, Miri Levi, Yossi Mizrahi, Dana Shapiro, Ron Peretz

`project_id=1` is currently hardcoded in both backend (`daily_log.py`) and frontend (`CrewManagement.tsx`). This is intentional for Sprint 1. Do not add multi-project logic until explicitly scoped.

---

## Sprint 1 Status — All Complete

| # | Feature | Status |
|---|---|---|
| 0 | Data Models + Alembic Migrations | ✅ Done |
| 1 | Weather Auto-Fetch (backend service + daily log integration) | ✅ Done |
| 2 | Crew Management + Daily Attendance | ✅ Done |
| 3 | Safety Incident Documentation | ✅ Done |
| 4 | Materials Used Logging | ✅ Done |
| 5 | UI Views — Dashboard + Entry Form | ✅ Done |

67 backend tests passing. Frontend: DailyLogView (dashboard + entry form), all four blocks integrated.

---

## Sprint 2–6 Scope (Backend-Only Until Mockups Arrive)

**Note: Frontend work is deferred pending UI mockups from the user. All sprints below are backend-only until mockups arrive.**

| Sprint | Name | Goal |
|---|---|---|
| S0 | Agent Setup & Infrastructure | CLAUDE.md files, CI, git cleanup |
| S2 | Task Data Layer | Task, TaskDependency, TaskLogEntry models + CRUD |
| S3 | Cascade Delay Engine | BFS cascade preview/apply service |
| S4 | Excel Upload + AI Task Extraction | openpyxl + Claude extraction + confirm flow |
| S5 | Log Submission + AI Summary + PDF | submit flag, AI narrative, reportlab PDF |
| S6 | Today View Backend + Task Marking | task-today filter + not_done validation |

Full plan: `Sprints/FULL_PRODUCT_EXECUTION_PLAN.md`

---

## Important Gotchas

1. **`project_id=1` is hardcoded** — intentional for Sprint 1. Don't refactor to dynamic until the brief says to.
2. **SQLite locally, PostgreSQL on Render** — `DATABASE_URL` in `.env` controls this. Never commit `.env`.
3. **`psycopg2-binary` version mismatch** — `requirements.txt` pins `2.9.10` but the venv has `2.9.12`. Update `requirements.txt` before the next Render deploy.
4. **`POST /daily-logs/today`** is the correct way to get today's log — it upserts and returns the log with `id`. Use this `id` to drive all block data fetches.
5. **Weather fetch on log creation** — weather is fetched automatically when `POST /daily-logs/today` runs. If it fails, the log is still created and `weather_error` is populated.
6. **Attendance defaults to "absent"** — if no `CrewAttendance` record exists for a member on a given log, the GET attendance endpoint returns `"absent"` by default.
7. **In-memory SQLite for tests** — `conftest.py` uses `StaticPool` to share a single connection across threads in `:memory:` mode. Do not change this; it is required for SQLite in-memory test DBs.

---

## Out of Scope (Sprint 1)

Do not implement these until explicitly added to the brief:
- Authentication / login (single hardcoded user)
- AI summaries, pattern insights, cascade alerts
- PDF export
- Photo uploads (model field exists; UI is a stub)
- Multi-project support
- Visual polish, branding, responsive design beyond functional

---

## Agent-Specific Notes

### All agents
- Always read this file at the start of a session for current state.
- The single source of truth for sprint status is `Sprints/SPRINT_1_EXECUTION_PLAN.md`. Check it before planning new work.
- Do not introduce new dependencies without confirming with the user.
- Prefer editing existing files over creating new ones.

### Code-writing agents
- Follow the inline CSS pattern — no external stylesheets.
- All new backend models go in `backend/app/models.py` followed by an Alembic migration.
- All new API routes go in a router file under `backend/app/routers/` and must be registered in `main.py`.
- All new frontend API calls go in `frontend/src/api/` — never call Axios directly from components.
- Run `cd backend && .venv/bin/python -m pytest tests/ -v` after any backend change.

### Explore / research agents
- The brief lives at `Sprints/simple_claude_code_brief.md`.
- The execution plan lives at `Sprints/SPRINT_1_EXECUTION_PLAN.md`.
- Backend models: `backend/app/models.py`. Routers: `backend/app/routers/`. Services: `backend/app/services/`.
- Frontend components: `frontend/src/components/`. Pages: `frontend/src/pages/`. API layer: `frontend/src/api/`.

### Plan agents
- Sprint 1 is fully complete. The next sprint is Sprint 2 (Task Data Layer).
- Do not re-plan Sprint 1 features. See `Sprints/FULL_PRODUCT_EXECUTION_PLAN.md` for Sprint 2+ scope.
- Frontend sprints are deferred — do not plan frontend work until the user provides UI mockups.

### Review / security agents
- Check for hardcoded `project_id=1` — it is intentional for Sprint 1, not a bug.
- `weather_error` being non-null is expected behavior, not a defect.
- There is no auth layer by design for Sprint 1.

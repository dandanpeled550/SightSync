# "simple." — Full Product Execution Plan

## Context

Sprint 1 of SightSync ("simple.") is fully complete — weather, crew attendance, safety incidents, materials, and UI. All 67 backend tests pass. The product now transitions to building the full PRD vision: a predictive construction management platform where a foreman uploads a project schedule (Excel), marks tasks daily, and the system cascades delays automatically.

**Four governing constraints for this plan:**
1. **Frontend phases are gated on backend sprints** — Phase 1 (shell + design system) runs in parallel with backend Sprint 2. Phases 2–5 each require their corresponding backend sprint to be live on Render first. Source of truth for all UI: `Sprints/site_diary_app_clickable_demo.html`.
2. **Render deployment after every sprint** — each sprint ends with a successful deploy to Render and a production smoke test.
3. **Agent setup sprint first** — before any feature work, a dedicated Sprint 0 configures all CLAUDE.md files, CI, and the agent execution framework.
4. **Two dedicated operational agents** — `sprint-review` and `render-verify` are created in Sprint 0 as Claude Code slash commands and used at the end of every sprint.

---

## Sprint 0 — Agent Setup & Infrastructure

**Goal:** Build the scaffolding that every subsequent agent session will rely on. Nothing here adds product features; everything here makes all future sprints run correctly and consistently.

### What "building the agents" means

Each sprint will be executed by one or more Claude Code agent sessions. For those agents to work coherently — following the same patterns, understanding the architecture, not conflicting with each other — they need:
1. **CLAUDE.md guidance files** in the right places (root, backend/, frontend/)
2. **Two dedicated operational agents** as Claude Code slash commands (see below)
3. **CI that enforces correctness** before anything merges to main
4. **A clean git state** on main with all Sprint 1 work committed
5. **Render deploy verified** so we know the baseline is healthy before adding anything

---

## Parallel Execution Model

Each sprint defines work streams. Parallel streams run as **separate Claude Code CLI terminals** opened simultaneously. Sequential streams run in the same terminal one after the other.

### The one hard rule
**Each parallel agent must own a distinct set of files. No file can be written by two agents at the same time.**

Before starting parallel agents in a sprint, explicitly assign file ownership. If two agents both need to touch the same file (e.g., `backend/app/main.py` for router registration), that file belongs to Agent 1 only — Agent 2 notes what needs to be added and Agent 1 handles it.

### How to open a parallel agent

```bash
# Terminal 1 — already running
claude  # Agent 1: backend models + endpoints

# Terminal 2 — open new terminal window, cd to project root
claude  # Agent 2: test infrastructure (different files entirely)
```

Each new terminal starts a fresh Claude Code session. The agent reads `CLAUDE.md` on startup and knows the project context. Give each terminal a clear task prompt referencing which "Agent N / Stream N" it is from the execution plan.

### When NOT to open a new terminal
- Agent 2 is blocked waiting for Agent 1's migration to run — open Terminal 2 only when the gate condition is met
- The work stream is a single command (`pytest`, `npm run build`) — run it inline in the current terminal
- `/sprint-review` and `/render-verify` — always run in the current terminal after all parallel agents have finished and merged

---

## Operational Agents

Two slash commands live in `.claude/commands/` at the project root. They are created in Sprint 0 and used at the end of every sprint. Any Claude Code agent in this project can invoke them with `/sprint-review` and `/render-verify`.

### `/sprint-review`

**File:** `.claude/commands/sprint-review.md`

**Purpose:** Runs all end-of-sprint checks, generates the structured review report, and explicitly waits for user approval before proceeding.

**File content:**
```markdown
Run the following checks for the current sprint and produce a structured sprint review report. Do NOT proceed to the next sprint until the user explicitly approves.

## Steps to execute

1. **Run backend tests**
   ```
   cd backend && .venv/bin/python -m pytest tests/ -v --cov=app --cov-report=term-missing
   ```
   Capture: total tests, passed, failed, coverage %.

2. **Run frontend type check**
   ```
   cd frontend && npm run build
   ```
   Capture: success or list of TypeScript errors.

3. **Run frontend tests**
   ```
   cd frontend && npm test
   ```
   Capture: total tests, passed, failed.

4. **Check git status**
   Confirm the sprint branch has been merged to main and there are no uncommitted changes.

5. **Call /render-verify**
   Invoke the render-verify agent to check production health.

## Output format

Produce this exact report structure:

---
## Sprint {N} Review — {Sprint Name}

### What was built
- [every file created or modified, one bullet each]
- [new endpoints: METHOD /path — description]
- [new models or migrations applied]

### Test results
| Check | Result |
|-------|--------|
| Backend tests | {N} passed / {N} failed |
| Backend coverage | {N}% |
| Frontend build | ✅ clean / ❌ errors |
| Frontend tests | {N} passed / {N} failed |

### Render deployment
[Output from /render-verify]

### Known issues or deferred items
- [anything intentionally left out or found but not fixed]

---
**Waiting for your approval to start Sprint {N+1}.**
Tell me "go ahead", "proceed", or describe any changes you want first.
```

---

### `/render-verify`

**File:** `.claude/commands/render-verify.md`

**Purpose:** Hits the production Render backend, verifies the health endpoint, and smoke-tests the key endpoint(s) for the most recently completed sprint. Returns a structured result. Can be called standalone or from `/sprint-review`.

**File content:**
```markdown
Verify the production Render deployment is healthy. Execute the following checks and report the results.

## Steps to execute

1. **Read the Render backend URL**
   Check render.yaml or backend/.env for the production URL. If not found, ask the user to provide it.

2. **Health check**
   ```
   curl -s -o /dev/null -w "%{http_code}" https://<render-url>/health
   ```
   Expected: 200. If not 200, report the status code and stop — do not continue to further checks.

3. **Today's log check**
   ```
   curl -s -X POST https://<render-url>/daily-logs/today
   ```
   Expected: JSON with an `id` field. This confirms the DB is connected and the migration ran.

4. **Sprint key endpoint check**
   Look at the most recently completed sprint in FULL_PRODUCT_EXECUTION_PLAN.md and identify its "key endpoint". Hit that endpoint and verify it returns a non-500 response.

5. **Check Render build logs (optional)**
   If the user has the Render dashboard open, ask them to confirm that `alembic upgrade head` appears in the build log without errors.

## Output format

```
### Render Verification
- Health endpoint: ✅ 200 / ❌ {status}
- DB connection (today's log): ✅ returned log id={N} / ❌ {error}
- Sprint key endpoint ({METHOD} {path}): ✅ {status} / ❌ {status} — {detail}
- Migration log: ✅ confirmed clean / ⚠️ not verified
```

If any check fails, state clearly: "Render verification FAILED — do not approve this sprint until resolved."
```

---

### Work streams (all sequential — this sprint is not parallelized)

**Step 1: Clean up git state**

Commit the two unstaged Sprint 1 files and the PRD document:
```bash
git add frontend/src/App.tsx frontend/src/pages/DailyLogView.tsx Sprints/simple_PRD.md Sprints/FULL_PRODUCT_EXECUTION_PLAN.md
git commit -m "fix(fe): Sprint 1 polish — logKey remount + arrowDisabled style"
```
Add to `.gitignore` if not already present: `backend/sightsync.db`, `backend/railway.toml`, `frontend/tsconfig.tsbuildinfo`.

**Step 2: Create operational agent command files**

Create the directory and two command files:
- `.claude/commands/sprint-review.md` — content defined in the "Operational Agents" section above
- `.claude/commands/render-verify.md` — content defined in the "Operational Agents" section above

These become available as `/sprint-review` and `/render-verify` slash commands in any Claude Code session within this project.

**Step 4: Create CLAUDE.md files**

Files to create/modify:

`CLAUDE.md` (root, already exists) — update the following sections:
- Sprint 1 Status: mark all features ✅ Done (Feature 5 is complete, the doc is stale)
- Add "Sprint 2–6 Scope" section summarizing the PRD features to build
- Add `ANTHROPIC_API_KEY` to the Environment Variables table
- Add note: "Frontend work is deferred pending UI mockups. Backend-only until mockups arrive."
- Add note on end_date computation: computed in router, not DB

`backend/CLAUDE.md` — NEW file:
```markdown
# Backend — Agent Guidelines

## Run tests
cd backend && .venv/bin/python -m pytest tests/ -v

## Create a migration
cd backend && .venv/bin/alembic revision --autogenerate -m "description"
cd backend && .venv/bin/alembic upgrade head

## New router checklist
1. Create backend/app/routers/{name}.py
2. Register in backend/app/main.py
3. Create backend/tests/test_{name}.py with 10+ tests using seeded_client

## Cascade service contract
preview_cascade() — returns results, NEVER writes to DB
apply_cascade()   — writes new dates to DB, returns same shape
Both live in backend/app/services/cascade.py

## AI service rules
- Mock anthropic.Anthropic() in ALL unit tests with unittest.mock.patch
- If ANTHROPIC_API_KEY is absent, endpoints return graceful degraded responses
- Use settings.anthropic_model for the model ID — never hardcode it

## end_date computation
Always compute in the router: end_date = start_date + timedelta(days=duration_days)
Do not use DB-level triggers or computed columns.

## Fixtures in conftest.py
- client: empty DB
- seeded_client: project_id=1 + daily log; access via c.project_id, c.log_id
- seeded_client_with_tasks: above + 3 tasks + 2 dependencies (added in Sprint 2)
```

`frontend/CLAUDE.md` — NEW file (minimal for now, expanded when mockups arrive):
```markdown
# Frontend — Agent Guidelines

## Run dev
cd frontend && npm run dev   # port 5173

## Run tests
cd frontend && npm test

## Key patterns
- All styling: React.CSSProperties objects only. No .css files, no Tailwind.
- All HTTP calls: frontend/src/api/ only. Never call axios directly from a component.
- State: useState/useEffect only. No Redux, React Query, or context.
- TypeScript: all response shapes defined in frontend/src/api/*.ts. Never use `any`.
- PROJECT_ID = 1 is intentional — hardcoded in all pages.

## Note
Frontend sprint work is deferred pending UI mockups from the user.
Do not add new pages or components until explicitly told to.
```

**Step 5: Set up GitHub Actions CI**

Create `.github/workflows/backend.yml`:
```yaml
name: Backend CI
on:
  push:
    branches: ['**']
    paths: ['backend/**', '.github/workflows/backend.yml']
  pull_request:
    paths: ['backend/**']

jobs:
  backend-tests:
    name: backend-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r backend/requirements.txt
      - name: Run pytest with coverage
        run: |
          cd backend
          python -m pytest tests/ -v \
            --cov=app \
            --cov-report=term-missing \
            --cov-fail-under=70
        env:
          DATABASE_URL: sqlite:///:memory:
          FRONTEND_URL: http://localhost:5173
          CORS_ORIGINS: '["http://localhost:5173"]'
          ANTHROPIC_API_KEY: ''
```

Create `.github/workflows/frontend.yml`:
```yaml
name: Frontend CI
on:
  push:
    branches: ['**']
    paths: ['frontend/**', '.github/workflows/frontend.yml']
  pull_request:
    paths: ['frontend/**']

jobs:
  frontend-typecheck:
    name: frontend-typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
```

**Step 6: Configure Vitest (frontend test infrastructure)**

Even though no frontend features are being built yet, the test runner must be configured in Sprint 0 so it's available when mockups arrive.

Files to modify:
- `frontend/package.json` — add to devDependencies: `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`; add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`
- `frontend/vite.config.ts` — add `test` block:
  ```ts
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: { provider: 'v8', thresholds: { lines: 60 } },
  }
  ```
- `frontend/src/test/setup.ts` — NEW: `import '@testing-library/jest-dom'`

**Step 7: Render deploy verification**

Push main to GitHub → Render auto-deploys → verify:
```bash
curl https://<render-backend-url>/health
# Expected: {"status": "ok"}
```

Check the Render dashboard that `alembic upgrade head` ran in the build logs.

### Sprint 0 done when
- All Sprint 1 changes committed and on main
- `backend/CLAUDE.md` and `frontend/CLAUDE.md` exist
- `.github/workflows/` has both CI files
- `npm test` runs without error locally
- Render production `/health` returns `{"status": "ok"}`

---

## Render Deployment Protocol (applies to every sprint)

After each sprint branch merges to `main`:

1. **Monitor the Render deploy** — Render auto-deploys on push to main. Watch the deploy log in the Render dashboard.
2. **Verify migration ran** — Look for `alembic upgrade head` output in the Render build log. If it's missing or errored, the deploy succeeded but DB may be inconsistent.
3. **Smoke test production** — Run these checks:
   ```bash
   # Health check
   curl https://<render-backend-url>/health

   # Today's log (creates if not exists)
   curl -X POST https://<render-backend-url>/daily-logs/today

   # New endpoints from the sprint just deployed
   # (specific commands listed in each sprint's completion criteria below)
   ```
4. **If deploy fails:** revert by pushing the previous commit to main (`git revert HEAD --no-edit && git push`). Fix on the sprint branch and re-merge. Never debug directly on main.

---

## Sprint Review Protocol (applies to every sprint)

After all completion criteria are met and Render is verified, the agent **must stop and deliver a sprint review** before any work on the next sprint begins.

### Required sprint review format

```
## Sprint {N} Review — {Sprint Name}

### What was built
- [bullet list of every file created or modified]
- [new endpoints added with their HTTP method + path]
- [new models or migrations applied]

### Test results
- Total tests: {N} ({N} new this sprint, {N} carried from previous sprints)
- All tests passing: YES / NO
- Coverage: {N}%
- CI status: green / failing (link to run)

### Render deployment
- Deploy triggered: YES / NO
- Build log: clean / errors (describe)
- Smoke test results:
  - /health → {response}
  - {sprint key endpoint} → {response}

### Known issues or deferred items
- [anything that was intentionally left out or found but not fixed]

### Waiting for approval to start Sprint {N+1}
```

The agent does not proceed to the next sprint until the user explicitly approves. "Looks good", "proceed", "go ahead", or equivalent counts as approval. If the user has change requests, fix them on the current sprint branch before re-requesting approval.

---

## Sprint 2 — Task Data Layer

**Goal:** Introduce Task, TaskDependency, TaskLogEntry models. This is a backend-only sprint. All later sprints depend on this.

### Agent execution

```
Terminal 1: Agent 1 (backend models + endpoints)  ← start immediately
Terminal 2: Agent 2 (seed.py + production verify) ← open ONLY after Agent 1 merges and Render deploys
Terminal 3: (Sprint 0 only) Agent 3 for test infra ← can open in parallel with Terminal 1
```

**File ownership:**
- Terminal 1 owns: `backend/app/models.py`, `backend/app/main.py`, `backend/app/routers/tasks.py`, `backend/app/routers/daily_log.py`, `backend/tests/test_tasks.py`, `backend/tests/conftest.py`, `backend/alembic/`
- Terminal 2 owns: `backend/seed.py` only

**Agent 1: Models + Migration + CRUD endpoints** `[Terminal 1]`

Files to create/modify:
- `backend/app/models.py` — add `Task`, `TaskDependency`, `TaskLogEntry`; add `submitted` (Boolean, default False) and `ai_summary` (Text, nullable) to `DailyLog`
- `backend/alembic/versions/XXXX_task_models.py` — autogenerate migration
- `backend/app/routers/tasks.py` — NEW file with full CRUD
- `backend/app/main.py` — register `tasks.router`
- `backend/app/routers/daily_log.py` — add `submitted` + `ai_summary` to `DailyLogOut`
- `backend/tests/test_tasks.py` — NEW, 20+ tests
- `backend/tests/conftest.py` — add `seeded_client_with_tasks` fixture

New models:
```python
class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(300), nullable=False)
    description = Column(Text)
    level_tag = Column(String(100), nullable=False)   # "Level 4", "Roof"
    trade_tag = Column(String(100))                    # "Electrical", "Plumbing"
    start_date = Column(Date, nullable=False)
    duration_days = Column(Integer, nullable=False, default=1)
    end_date = Column(Date, nullable=False)            # router computes: start_date + timedelta(days=duration_days)
    status = Column(String(20), nullable=False, default="pending")  # pending/in_progress/done/delayed
    source = Column(String(20), nullable=False, default="manual")   # manual/ai-extracted
    notes = Column(Text)

class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (UniqueConstraint("task_id", "depends_on_task_id", name="uq_task_dep"),)
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    depends_on_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    lag_days = Column(Integer, nullable=False, default=0)

class TaskLogEntry(Base):
    __tablename__ = "task_log_entries"
    __table_args__ = (UniqueConstraint("daily_log_id", "task_id", name="uq_log_task"),)
    id = Column(Integer, primary_key=True)
    daily_log_id = Column(Integer, ForeignKey("daily_logs.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    action = Column(String(20), nullable=False)   # "done" or "not_done"
    new_date = Column(Date)                        # required when action == "not_done"
    reason = Column(String(200))
```

New endpoints:
```
GET    /projects/{project_id}/tasks              → list all tasks
POST   /projects/{project_id}/tasks              → create one task
POST   /projects/{project_id}/tasks/bulk         → create many (for AI extraction later)
PUT    /tasks/{task_id}                          → update task
DELETE /tasks/{task_id}                          → delete task
GET    /projects/{project_id}/tasks/today        → start_date <= today AND status != 'done'
POST   /projects/{project_id}/task-dependencies  → add dependency edge
DELETE /task-dependencies/{dep_id}               → remove dependency edge
POST   /daily-logs/{log_id}/task-entries         → mark a task done/not_done
GET    /daily-logs/{log_id}/task-entries         → list all entries for a log
```

Agent 1 completion gate: `alembic upgrade head` clean, all 67 existing tests still pass, `test_tasks.py` 20+ tests pass.

**Agent 2: Extend seed.py + verify production** `[Terminal 2 — open after Agent 1 gate]`

Wait for Agent 1's PR to merge to main and Render to deploy successfully.

Files to modify:
- `backend/seed.py` — add 8 sample tasks with 5 dependencies for project id=1 (idempotent)

After seed extended, verify on production:
```bash
curl -X POST https://<render-backend-url>/daily-logs/today
curl https://<render-backend-url>/projects/1/tasks
curl https://<render-backend-url>/projects/1/tasks/today
```

### Sprint 2 done when
- 87+ backend tests pass (67 existing + 20 new)
- CI green on GitHub
- Render deploy successful — migration log shows new tables created
- `/projects/1/tasks` returns 200 with task list on production
- `seed.py` runs idempotently

---

## Sprint 3 — Cascade Delay Engine

**Goal:** The cascade engine is the technical core of the product. Backend-only sprint.

### Agent execution

Two agents, Stream B is independent and can run in parallel with Stream A from day one.

```
Terminal 1: Agent 1 (cascade engine)        ← start immediately
Terminal 2: Agent 2 (dependency polish)     ← open immediately in parallel
```

**File ownership:**
- Terminal 1 owns: `backend/app/services/cascade.py`, `backend/app/routers/tasks.py` (cascade endpoints), `backend/tests/test_cascade.py`, `backend/CLAUDE.md`
- Terminal 2 owns: `backend/tests/test_tasks.py` (adds 5 more tests only), `backend/seed.py`

**Agent 1: Cascade engine + endpoints** `[Terminal 1]`

Files to create/modify:
- `backend/app/services/cascade.py` — NEW
- `backend/app/routers/tasks.py` — add cascade preview + apply endpoints
- `backend/tests/test_cascade.py` — NEW, 15+ tests (write tests FIRST — TDD)
- `backend/CLAUDE.md` — update cascade contract section

`cascade.py` — uses Kahn's BFS topological sort (NOT recursive DFS):

```python
from dataclasses import dataclass
from datetime import date
from sqlalchemy.orm import Session
from app.models import Task, TaskDependency

@dataclass
class CascadeResult:
    task_id: int
    task_name: str
    old_start_date: date
    new_start_date: date
    old_end_date: date
    new_end_date: date
    days_shifted: int

def preview_cascade(db, task_id, new_start_date, project_id) -> list[CascadeResult]:
    """Returns affected tasks. Never writes to DB. Raises ValueError on cycle."""

def apply_cascade(db, task_id, new_start_date, project_id) -> list[CascadeResult]:
    """Writes new dates, returns same shape as preview."""
```

Why BFS not DFS: a diamond dependency (C depends on both A and B) causes DFS to shift C twice. BFS with a visited-set processes each task exactly once, taking the correct max-shift from all predecessors.

New endpoints:
```
POST /tasks/{task_id}/cascade-preview  → body: {new_date: "YYYY-MM-DD"}  → list[CascadeResult]
POST /tasks/{task_id}/cascade-apply    → body: {new_date: "YYYY-MM-DD"}  → list[CascadeResult] (DB written)
```

`test_cascade.py` required cases:
- Linear chain (A→B→C): shift A 3 days, C shifts 3
- Diamond (A→C and B→C): shift A, C takes max of A's push and B's zero
- lag_days: B starts 2 days after A ends
- Single task with no successors: returns empty list
- Cycle (A→B→A): raises ValueError
- apply vs preview: preview leaves DB unchanged; apply changes dates in DB
- Multi-day duration: end_date = start_date + duration_days after shift

**Agent 2: Dependency management polish** `[Terminal 2 — parallel]`

- Verify POST/DELETE for task dependencies work correctly
- Add 5 more tests to `test_tasks.py` for dependency edge cases (duplicate dep, self-dependency)

### Sprint 3 done when
- 102+ tests pass
- Cycle detection raises ValueError correctly
- Diamond dependency test passes (not double-shifted)
- Render deploy successful — no migration needed (no new models this sprint)
- `/tasks/{id}/cascade-preview` returns correct shifted dates on production

---

## Sprint 4 — Excel Upload + AI Task Extraction

**Goal:** Onboarding flow — upload `.xlsx`, extract tasks via Claude, confirm. Backend-only.

### New dependencies (add to `requirements.txt`)
```
anthropic>=0.49.0
openpyxl>=3.1.5
python-multipart>=0.0.20
psycopg2-binary==2.9.12   # fix existing version mismatch
```

### Agent execution

Two sequential agents — Agent 2 cannot start until Agent 1's API shape is stable and merged.

```
Terminal 1: Agent 1 (backend extraction + upload endpoint)  ← start immediately
Terminal 2: Agent 2 (integration verify + Render)           ← open after Agent 1 merges
```

**File ownership:**
- Terminal 1 owns: `backend/app/config.py`, `backend/app/services/ai_extraction.py`, `backend/app/routers/onboarding.py`, `backend/app/main.py`, `backend/tests/test_onboarding.py`, `backend/requirements.txt`
- Terminal 2 owns: nothing (read-only verification only)

**Agent 1: AI extraction service + upload endpoint** `[Terminal 1]`

Files to create/modify:
- `backend/app/config.py` — add `anthropic_api_key: str = ""` and `anthropic_model: str = "claude-sonnet-4-6"` to `Settings`
- `backend/app/services/ai_extraction.py` — NEW
- `backend/app/routers/onboarding.py` — NEW
- `backend/app/main.py` — register `onboarding.router`
- `backend/tests/test_onboarding.py` — NEW, 8+ tests (all mock Claude client)

`ai_extraction.py` design:
1. Accept raw bytes + filename; load with `openpyxl.load_workbook(BytesIO(raw_bytes))`
2. Extract all cell values as flat text, truncate at 6000 chars
3. Call Claude via `anthropic.Anthropic(api_key=settings.anthropic_api_key)` with structured prompt requesting JSON output
4. Parse JSON → validate against Pydantic `ExtractionResult` schema
5. On any failure: return `ExtractionResult(tasks=[], dependencies=[], confidence=0.0, error=str(e))`

Upload endpoint:
```
POST /projects/{project_id}/upload-schedule
  multipart/form-data; file: UploadFile (.xlsx)
  Returns: ExtractionResult {
    tasks: list[TaskCreate],
    dependencies: list[DependencyCreate],
    raw_preview: str,
    confidence: float,
    error: str | None
  }
```

Confirm endpoint:
```
POST /projects/{project_id}/confirm-schedule
  Body: { tasks: list[TaskCreate], dependencies: list[DependencyCreate] }
  Returns: { tasks_created: int, dependencies_created: int }
```

**In unit tests:** mock `anthropic.Anthropic` — never call real API. CI has no API key.

**Agent 2: Integration verification + Render deploy** `[Terminal 2 — open after Agent 1 merges]`

After Agent 1 merges and Render deploys:
- Add `ANTHROPIC_API_KEY` to Render environment variables (via Render dashboard, not committed to code)
- Verify upload endpoint accepts a real `.xlsx` file on production
- Verify confirm endpoint creates tasks in production DB

### Sprint 4 done when
- Upload endpoint returns structured `ExtractionResult` for a test fixture xlsx
- `test_onboarding.py` 8+ tests all pass (mocked)
- CI green (no real API calls)
- `ANTHROPIC_API_KEY` set in Render environment
- Render deploy successful, upload endpoint returns 200 on production

---

## Sprint 5 — Log Submission + AI Summary + PDF Export

**Goal:** Complete the daily log lifecycle — submit → AI narrative → PDF. Backend-only.

### New dependencies
```
reportlab>=4.2.0
```

### Agent execution

Three sequential steps, one agent handles all in a single terminal.

```
Terminal 1: Agent 1 (submit → AI summary → PDF) ← one terminal, three sequential steps
```

**File ownership:** Terminal 1 owns all new files in this sprint.

**Agent 1: Submission + AI summary + PDF** `[Terminal 1]`

Files to create/modify:
- `backend/app/routers/daily_log.py` — add submit endpoint; extend `DailyLogOut` with `submitted` + `ai_summary`
- `backend/app/services/ai_summary.py` — NEW
- `backend/app/services/pdf_generator.py` — NEW using `reportlab.platypus`
- `backend/tests/test_submission.py` — NEW, 10+ tests

Step A — submit endpoint:
```
POST /daily-logs/{log_id}/submit
  Returns: DailyLogOut (submitted=True, ai_summary=null initially)
```
Sets `submitted=True`. Triggers AI summary via FastAPI `BackgroundTasks` (non-blocking, no Celery).

Step B — `ai_summary.py`: loads log + all related data (attendance, task entries, incidents, materials), builds structured prompt, calls Claude, writes result to `DailyLog.ai_summary`. On failure: writes `"[Summary generation failed]"` — never leaves `ai_summary` null indefinitely.

Step C — PDF endpoint:
```
GET /daily-logs/{log_id}/export-pdf
  Returns: StreamingResponse (application/pdf)
  Content-Disposition: attachment; filename="log-{date}.pdf"
```
PDF sections: project header, date, weather table, crew attendance, tasks done/not done, materials, safety incidents, AI summary if present.

Test cases for `test_submission.py`:
- Submit sets `submitted=True`
- Re-submit is idempotent (returns same log)
- PDF endpoint returns status 200 + content-type `application/pdf`
- PDF for non-existent log returns 404
- AI summary stored after background task runs (mock Claude)

### Sprint 5 done when
- Submit endpoint sets flag in DB
- PDF endpoint returns valid PDF content-type
- AI summary stored and retrievable on production
- Render deploy successful
- Production smoke: `curl -X POST .../daily-logs/1/submit` returns `submitted: true`

---

## Sprint 6 — Today View Backend + Task Marking

**Goal:** The core daily endpoint — tasks for today, task marking done/not done, full log through cascade. Backend-only. Frontend wired in a later sprint once mockups are provided.

### Agent execution

Single agent — this sprint is primarily validation and endpoint polish.

```
Terminal 1: Agent 1 (today endpoint + task marking validation) ← single terminal
```

**Agent 1: Today view endpoint + task marking validation** `[Terminal 1]`

Files to modify:
- `backend/app/routers/tasks.py` — verify `GET /projects/{id}/tasks/today` returns all fields needed by the frontend (id, name, level_tag, trade_tag, start_date, end_date, status, duration_days)
- `backend/app/routers/tasks.py` — verify `POST /daily-logs/{log_id}/task-entries` handles the full "not_done" flow correctly (requires new_date when action=not_done; optionally triggers cascade-apply)
- `backend/tests/test_tasks.py` — add 5+ tests for the today-filter (past tasks not returned, tasks due today returned, completed tasks excluded)

No new models needed this sprint.

### Sprint 6 done when
- Today endpoint correctly filters tasks
- Task entry "not_done" validates that new_date is required
- All tests pass (110+ total)
- Render deploy successful
- `/projects/1/tasks/today` returns correct task list on production (after seeding tasks with today's date)

---

## Frontend Phases

**Source of truth:** `Sprints/site_diary_app_clickable_demo.html` — a fully clickable prototype with all 10 screens, exact colors, spacing, and navigation flow. Every agent working on frontend MUST open and interact with this file before writing a single line of component code.

Frontend work is phased by backend readiness. **Phase 1 is unblocked** and runs in parallel with backend Sprint 2. Phases 2–5 each gate on a specific backend sprint completing first.

---

### Design System (extracted from mockup — source of truth)

**Colors** — transcribed exactly from the mockup's CSS variables:
```ts
// frontend/src/constants/theme.ts
export const colors = {
  blue:        '#2563eb',
  blueDark:    '#1d4ed8',
  blueSoft:    '#edf5ff',
  blueDeep:    '#174ea6',   // active text
  green:       '#139a4b',
  greenSoft:   '#eaf8ef',
  red:         '#ef4444',
  redSoft:     '#fff1f1',
  orange:      '#f59e0b',
  orangeSoft:  '#fff7e6',
  text:        '#111827',
  muted:       '#667085',
  mutedLight:  '#98a2b3',
  surface:     '#ffffff',
  surface2:    '#f7faff',
  line:        '#e8edf5',
}
```

**Spacing & shape:**
```ts
export const radius = {
  phone:  '38px',   // phone shell outer
  card:   '22px',   // standard card
  task:   '20px',   // task row card
  btn:    '17px',   // action buttons
  icon:   '14px',   // small icon buttons
  pill:   '999px',  // status pills
}

export const shadow = {
  phone: '0 24px 70px rgba(15,23,42,.10)',
  card:  '0 12px 35px rgba(15,23,42,.06)',
}
```

**Layout shell** — 390px wide, centered, white background. The app renders inside a constrained shell on desktop too:
```ts
export const shell: React.CSSProperties = {
  maxWidth:   '390px',
  minHeight:  '100vh',
  margin:     '0 auto',
  background: '#fff',
  position:   'relative',
  overflow:   'hidden',
}
```

**Bottom nav** — fixed to bottom of the shell (NOT viewport — `position: absolute` inside the `shell` container, otherwise it breaks on desktop):
```ts
export const bottomNav: React.CSSProperties = {
  position:        'absolute',
  bottom:          0,
  left:            0,
  right:           0,
  display:         'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  padding:         '10px 14px 12px',
  borderTop:       '1px solid #e8edf5',
  background:      'rgba(255,255,255,0.95)',
  backdropFilter:  'blur(8px)',
}
```

All page content must have `paddingBottom: '72px'` to avoid overlap with the bottom nav.

**FAB button** — `position: absolute, bottom: 72px, left: 50%, transform: translateX(-50%)` inside the shell. Same reasoning as bottom nav — absolute inside shell, not fixed to viewport.

All components import from `frontend/src/constants/theme.ts`. No hex color literals in component files.

---

### Screen & Route Map (frozen — never rename routes)

| Route | Screen ID | Screen Name | Bottom Nav Tab |
|-------|-----------|-------------|----------------|
| `/` | `today` | Daily Log Dashboard | 🏠 Home |
| `/task/:taskId` | `task` | Task Detail | — (modal-like) |
| `/plans` | `plan` | Plans & Deliveries | — |
| `/site` | `filters` | Site Tree | ☷ Site |
| `/alerts` | `alerts` | Alerts / Lookahead | 🔔 Alerts |
| `/report` | `report` | Daily Report Draft | ▣ Reports |
| `/summary` | `summary` | AI Summary Preview | — |
| `/export` | `export` | Export Report | — |
| `/onboard` | `upload` | Upload | — |
| `/onboard/review` | `review` | Review Structure | — |

### Navigation flow (from mockup interactions)

```
upload  → review     (Upload files button / any upload row tap)
review  → /          (✓ Looks good → home)
/       → /task/:id  (× mark on task card, or FAB +)
/       → /report    (✓ mark on task card)
/task   → /          (Save button)
/report → /summary   (Generate report button)
/summary→ /export    (Use in report button)
/export → /          (Done button)

Bottom nav always visible on: /, /site, /alerts, /report
Bottom nav hidden on: /task, /summary, /export, /onboard, /onboard/review
```

---

### Frontend Phase 1 — Shell & Design System
**Backend dependency:** none — fully unblocked  
**Runs in parallel with:** Backend Sprint 2  
**Terminal:** Terminal 2 (open simultaneously with Terminal 1 for Sprint 2 backend)

**File ownership:**
- `frontend/src/constants/theme.ts` — NEW: all tokens above
- `frontend/src/router.tsx` — NEW: all 10 route definitions using `react-router-dom`
- `frontend/src/App.tsx` — replace current tab nav with `<RouterProvider>` + shell wrapper
- `frontend/src/components/BottomNav.tsx` — NEW: 4-tab bottom nav, hides on screens listed above
- `frontend/src/components/ScreenShell.tsx` — NEW: the 390px container + top bar + content area + bottom nav slot
- `frontend/package.json` — add `react-router-dom@^6` (only new dependency this phase)
- `frontend/src/pages/Today.tsx` etc. — stub all 10 screen files (just `<h1>Screen name</h1>` + back button where applicable)

**`ScreenShell` component** wraps every screen. Props: `title`, `subtitle`, `showBack`, `showBottomNav`, `actions` (top-right slot). Renders the top bar, scrollable content area, and bottom nav consistently. All 10 screens use it — no screen duplicates the chrome.

**Bottom nav items** (from mockup exactly):
- 🏠 Home → `/`
- 🔔 Alerts → `/alerts`
- ▣ Reports → `/report`
- ☷ Site → `/site`

Uses `useLocation()` to highlight the active tab. Active color: `colors.blue`. Inactive: `colors.muted`.

**Phase 1 done when:** `npm run build` clean, all 10 routes render stub content, bottom nav highlights correct tab, layout is 390px on desktop and full-width on mobile (375px), shell clipping works (no horizontal scroll).

---

### Frontend Phase 2 — Core Daily Workflow
**Backend dependency:** Sprint 2 complete — `GET /projects/1/tasks/today` and `POST /daily-logs/{id}/task-entries` live on Render  
**Terminal:** Single terminal (screens are sequential, share state)

**Screen 4 — Daily Log Dashboard (`/`)**

Replace existing WeatherBlock/CrewAttendanceBlock layout entirely.

Layout (from mockup):
- Top bar: hamburger menu | "Tower B⌄" + date | weather chip (☁️ temp)
- Section header: "Today's progress"
- Task list: each task is a 4-column card:
  ```
  [icon 42px] [name + time] [✓ mark 44px] [× mark 44px]
  ```
  - ✓ tap → calls `POST .../task-entries {action: "done"}` → navigates to `/report`
  - × tap → navigates to `/task/:taskId`
- FAB `+` button above bottom nav → navigates to `/task/new`

API: `GET /projects/1/tasks/today` + `POST /daily-logs/today` (to get `logId`)

Task icon background colors by `trade_tag`: Electrical → orangeSoft, Delivery → blueSoft, Construction → greenSoft, Safety → blueSoft, default → orangeSoft.

**Screen 5 — Task Detail (`/task/:taskId`)**

Top bar: back → `/` | task name | `⋮`

Layout:
- Two buttons row: `✓ Done` (green) | `× Not done` (red)
- "Why not completed?" section — radio list (exactly 5 from mockup):
  - Delayed (Subcontractor staffing)
  - Missing materials
  - Blocked by prior task
  - Weather
  - Other
- Notes textarea (min-height 48px)
- Photos row: 3 stub photo thumbnails (68×56px rounded) + add photo `+` button (stub only)
- Save button → `POST .../task-entries {action, new_date, reason}` → back to `/`

**Screen 3 — Plans & Deliveries (`/plans`)**

3 tabs: Weekly | Monthly | Schedule (Weekly is the default, Monthly + Schedule are stubs)

Weekly tab: vertical timeline, each event is a 3-column card:
```
[date block 54×52px] [name + level] [pill badge]
```
Date block shows day-of-week + number. Pill variants: no pill (plain), `orange` (Today/Delivery), `green` (trade name), `blue` (Inspect).

API: `GET /projects/1/tasks` filtered by current week.

**Screen 6 — Site Tree (`/site`)**

2-column layout:
- Left: tower graphic (CSS only — `repeating-linear-gradient` with 3 vertical dividers, height 310px)
- Right: level list — each row shows a colored dot + level name; active level highlighted in `blueSoft`

Dot colors by task status: `green` = all done, `orange` = in progress, `red` = delayed, `muted` = not started.

"Apply filters" button → navigates to `/` with selected `level_tag` as URL param (`/?level=Level+4`).

API: `GET /projects/1/tasks` → derive level status from task statuses.

**Phase 2 done when:** Full ✓ Done → `/report` and × Not Done → `/task` → Save → `/` flows work end-to-end with real API data. Site Tree renders levels with correct dot colors.

---

### Frontend Phase 3 — Alerts & Report Draft
**Backend dependency:** Sprint 3 complete — cascade engine live on Render

**Screen 7 — Alerts / Lookahead (`/alerts`)**

2 tabs: Upcoming | Past

Each alert card: 3 columns: `[icon 42px] [title + date] [›]`

Upcoming alerts = tasks whose `start_date` is tomorrow or within 7 days AND `status != done`. Pull from `GET /projects/1/tasks` filtered client-side.

Cascade-impacted tasks (tasks with `status = delayed`) appear as warning alerts with ⚠️ icon.

**Screen 8 — Daily Report Draft (`/report`)**

Top bar: back | "Daily Report" + date | `Draft` pill (orange)

6 stat cards in a 2-column grid (from mockup exactly):
```
☁️  Weather    👷  Crew
✅  Completed  ❌  Not done
📦  Deliveries 📷  Photos
```

Weather + date from `DailyLog`. Crew count from attendance records. Completed/Not done from `TaskLogEntry`. Deliveries = materials count. Photos = stub `0` for now.

"Generate report" button → `POST /daily-logs/{id}/submit` → navigates to `/summary`

**Phase 3 done when:** Screen 8 shows accurate counts from real data; "Generate report" triggers submission and navigates to Screen 9.

---

### Frontend Phase 4 — AI & Export
**Backend dependency:** Sprint 5 complete — AI summary + PDF export live on Render

**Screen 9 — AI Summary Preview (`/summary`)**

Top bar: back → `/report` | "AI Summary" + "Ready to review" | `Edit` link (text button, blue)

Content: white card with narrative text, `line-height: 1.6`, `font-size: 15px`, gray background (`#f8fbff`).

If `ai_summary` is null after submit: show spinner + "Generating summary…". Poll `GET /daily-logs/{date}` every 3s, max 10 attempts. After 10 failures: show "Summary generation failed — tap to retry."

`Edit` tap: makes the card a `<textarea>` with the same styling. Save on blur calls a `PATCH /daily-logs/{id}/summary` endpoint (or stores locally if that endpoint doesn't exist yet).

"Use in report" button → `/export`

**Screen 10 — Export Report (`/export`)**

Top bar: back → `/summary` | "Daily Report" + date | `BUILDWELL` brand text

Content (from mockup exactly):
- KPI bar: 3-column grid → Weather | Crew | Photos
- 2-column layout:
  - Left: "Work completed" progress bar + "Work not completed" progress bar (widths derived from task counts)
  - Right: 2×2 photo gallery (stubs, last cell shows `+N` overlay if >4 photos)

"Download PDF" button → `GET /daily-logs/{id}/export-pdf` → browser downloads file

"Done" button → `/`

**Phase 4 done when:** Full submit → poll → summary → export → PDF download chain works end-to-end.

---

### Frontend Phase 5 — Onboarding
**Backend dependency:** Sprint 4 complete — Excel upload + AI extraction live on Render

**Screen 1 — Upload (`/onboard`)**

Hero section: cloud emoji illustration + "Build your site diary" headline + subtext

3 upload rows (tap targets, 48px min height each):
- 📁 Files & folders — "Plans, Excel, PDFs" — functional (opens file picker, `accept=".xlsx"`)
- 🖼️ Photos — "From your device" — stub (shows toast "Coming soon")
- 🔎 Scan documents — "Drawings, receipts" — stub (shows toast "Coming soon")

"Skip" link (top right) → `/`

"Upload files" button → triggers file picker → on file select → calls `POST /projects/1/upload-schedule` with the xlsx file → loading state → navigates to `/onboard/review` with extraction results in state

**Screen 2 — Review Structure (`/onboard/review`)**

Back → `/onboard`

Content: collapsible tree card showing extracted structure:
```
📁 Tower B
  📁 ● Level 4  (blue dot)
  📁 ● Level 3  (green dot)
  📁 ● Level 2  (orange dot)
  📁 ● Level 1  (red dot)
📁 Level 5
📁 Roof
```

Second card: flat list of document types (Plans, Deliveries, Site diary/logs)

"✓ Looks good" button → calls `POST /projects/1/confirm-schedule` with the extracted task list → on success → navigates to `/`

**Phase 5 done when:** Full upload → extract → review tree → confirm → tasks appear in Screen 3 (Plans) flow works end-to-end.

---

### Frontend CLAUDE.md additions (apply after Phase 1 completes)

```markdown
## Design tokens
Import ALL colors, radius, shadow, shell constants from frontend/src/constants/theme.ts.
No hex color literals in component files. No inline color values.

## Routing
All routes defined in frontend/src/router.tsx only. Routes are frozen — do not rename.
Navigation uses react-router-dom useNavigate() hook. No window.location assignments.

## Shell pattern
Every screen wraps content in <ScreenShell>. Never duplicate top bar or bottom nav chrome.
Screens that hide bottom nav: /task, /summary, /export, /onboard, /onboard/review.

## FAB and bottom nav positioning
Both use position: absolute inside the shell container (NOT position: fixed).
This keeps them anchored to the 390px shell on desktop.

## Padding rule
All screen content areas: paddingBottom: '72px' to clear the bottom nav.

## Mockup reference
Always open Sprints/site_diary_app_clickable_demo.html before building any screen.
The mockup is the source of truth for layout, spacing, and interaction flow.
```

---

## Version Control Guidelines

### Branch strategy
```
main                         ← protected; production-ready; Render deploys from here
  sprint-0/setup             ← CLAUDE.md + CI + git cleanup
  sprint-2/task-data-layer   ← models + migration + CRUD
  sprint-3/cascade-engine    ← cascade service + endpoints
  sprint-4/onboarding        ← Excel upload + AI extraction
  sprint-5/submission-pdf    ← submit + AI summary + PDF
  sprint-6/today-view-be     ← today endpoint + task marking validation
```

One branch per sprint. Work streams within a sprint merge to the sprint branch via sub-PRs, then the sprint branch merges to main.

### Commit message format (Conventional Commits)
```
type(scope): short description

Types: feat | fix | test | chore | docs | refactor
Scope: be | fe | models | cascade | ai | pdf | ci | seed

Examples:
feat(models): add Task, TaskDependency, TaskLogEntry with Alembic migration
feat(cascade): add preview_cascade and apply_cascade services
test(cascade): diamond dependency and cycle detection edge cases
chore(deps): add anthropic, openpyxl, python-multipart to requirements.txt
ci: add GitHub Actions backend and frontend workflows
```

### PR rules
- PRs target sprint branch (not main)
- CI must be green before merge
- Sprint branch → main requires passing CI + 1 review
- Squash and merge; delete sprint branch after merge
- No force pushes ever

### Main branch protection (set in GitHub repo settings)
- Required status checks: `backend-tests`, `frontend-typecheck`
- No direct pushes
- Linear history (squash merges only)

---

## Test Strategy

### Backend file map

| Sprint | File | Min tests | Focus |
|--------|------|-----------|-------|
| S0 | — | — | No new tests; verify 67 existing pass |
| S2 | `tests/test_tasks.py` | 20 | CRUD, bulk create, today-filter, task-entry |
| S3 | `tests/test_cascade.py` | 15 | linear/diamond/cycle/lag/empty/apply-vs-preview |
| S4 | `tests/test_onboarding.py` | 8 | upload, reject non-xlsx, mocked AI, confirm |
| S5 | `tests/test_submission.py` | 10 | submit, idempotent, PDF content-type, AI stored |
| S6 | add to `test_tasks.py` | +5 | today-filter edge cases, not_done requires new_date |

Coverage target: **70% minimum** (enforced in CI with `--cov-fail-under=70`).

**What NOT to test:** Alembic migrations, exact PDF byte content, exact AI narrative text, trivial DB reads with no logic.

### Frontend (when mockup sprints begin)

Files go in `frontend/src/__tests__/`. All API calls mocked via `vi.mock`. Test behavior, not CSS. Coverage target: **60% minimum**.

---

## Sprint Completion Criteria

Each sprint is done when ALL of the following are true:

| Check | Sprint 0 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 | Sprint 6 |
|-------|----------|----------|----------|----------|----------|----------|
| All existing tests pass | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| New tests pass | n/a | 20+ | 15+ | 8+ | 10+ | 5+ |
| CI green on GitHub | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Render deploy successful | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/health` returns ok on prod | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sprint's key endpoint verified on prod | health | tasks list | cascade-preview | upload | submit | tasks/today |

---

## Critical Files — Read Before Each Sprint

| Sprint | Files to read before starting |
|--------|-------------------------------|
| S0 | `CLAUDE.md`, `backend/app/main.py`, `render.yaml` |
| S2 | `backend/app/models.py`, `backend/tests/conftest.py`, `backend/app/main.py` |
| S3 | `backend/app/services/cascade.py` (new), `backend/tests/test_tasks.py` |
| S4 | `backend/app/config.py`, `backend/requirements.txt` |
| S5 | `backend/app/routers/daily_log.py`, `backend/app/services/ai_extraction.py` |
| S6 | `backend/app/routers/tasks.py`, `backend/tests/test_tasks.py` |

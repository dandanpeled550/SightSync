# "simple." — Full Product Execution Plan

## Context

Sprint 1 of SightSync ("simple.") is fully complete — weather, crew attendance, safety incidents, materials, and UI. All 67 backend tests pass. The product now transitions to building the full PRD vision: a predictive construction management platform where a foreman uploads a project schedule (Excel), marks tasks daily, and the system cascades delays automatically.

**Governing constraints:**
1. **Each sprint owns both backend and frontend work** — BE and FE streams run in parallel where possible using git worktrees. The frontend stream for a given sprint is gated on the backend being live on Render first (except Sprint 2's shell work, which is fully independent).
2. **"Execute sprint X" spawns parallel agents automatically** — `/sprint-execute N` reads this plan, identifies parallel streams, and launches isolated worktree agents via the Claude Code `Agent` tool. No manual terminal management required.
3. **Render deployment after every sprint** — each sprint ends with a successful deploy to Render and a production smoke test before the user approves moving to the next sprint.
4. **Agent setup sprint first** — Sprint 0 configures all CLAUDE.md files, CI, slash commands, and verifies Render before any feature work begins.
5. **UI source of truth:** `Sprints/site_diary_app_clickable_demo.html` — every FE agent opens this before writing any screen.

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

### How `/sprint-execute N` works

When you type `/sprint-execute 2` (or any sprint number), the command agent:
1. Reads the sprint's section from this plan file
2. Identifies which streams are **parallel** (no shared files, can run simultaneously) vs **sequential** (one must finish before the other starts)
3. For parallel streams: spawns each as a sub-agent with `isolation: "worktree"` — each agent gets its own isolated git checkout, so there are zero file conflicts
4. For sequential streams: runs them one after the other in the same session
5. When all streams complete: merges worktrees, runs tests, creates the sprint PR, triggers Render deploy
6. Calls `/sprint-review` automatically when deploy is confirmed

You do not open any terminals manually. Everything runs from a single Claude Code session.

### The one hard rule (still applies inside worktrees)
**Each parallel stream must own a distinct set of files.** The file ownership list in each sprint section is the enforcement mechanism. If a file is shared (e.g., `backend/app/main.py`), it belongs to the BE stream only — the FE stream never touches it.

### When a stream is sequential (not parallelized)
- FE screens in Sprints 3–6: wait for BE stream to merge and Render to deploy first
- Any stream that reads output produced by another stream in the same sprint
- `/sprint-review` and `/render-verify`: always run after all streams complete

---

## Operational Agents

Four slash commands live in `.claude/commands/` at the project root. All four are created in Sprint 0.

| Command | When to use |
|---------|-------------|
| `/sprint-execute N` | Execute an entire sprint — spawns parallel worktree agents, merges, deploys |
| `/fe-screen <id>` | Build one frontend screen following the mockup spec |
| `/sprint-review` | Run all checks + produce the structured review report + wait for approval |
| `/render-verify` | Verify production Render deployment health |

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

### `/sprint-execute`

**File:** `.claude/commands/sprint-execute.md`

**Purpose:** Executes an entire sprint by spawning parallel worktree agents, merging results, and triggering deployment. This is the primary command used to run each sprint.

**File content:**
```markdown
You are the sprint executor. The user will provide a sprint number (e.g. "2").

## Steps

1. **Read the sprint plan**
   Read the sprint's section from `Sprints/FULL_PRODUCT_EXECUTION_PLAN.md`.
   Identify: (a) which streams are parallel, (b) which are sequential, (c) file ownership per stream.

2. **Spawn parallel streams**
   For each parallel stream, use the Agent tool with `isolation: "worktree"`.
   Pass the agent a self-contained prompt that includes:
   - The stream's exact file ownership list
   - The complete list of files to create/modify with their full specs
   - The completion gate (what must be true before the agent reports done)
   - "Read CLAUDE.md, backend/CLAUDE.md (or frontend/CLAUDE.md) before starting."
   Launch all parallel streams in a single message (multiple Agent tool calls).

3. **Run sequential streams**
   After parallel streams merge, run sequential streams one at a time.
   For FE streams: wait for Render deploy confirmation first.

4. **Merge and test**
   After all streams complete:
   - Run `cd backend && .venv/bin/python -m pytest tests/ -v`
   - Run `cd frontend && npm run build`
   - Commit any merge fixes on the sprint branch

5. **Create sprint PR**
   Use `gh pr create` with the sprint name as title and a summary of all changes.

6. **Deploy and verify**
   After PR merges to main: call /render-verify.

7. **Sprint review**
   Call /sprint-review to produce the structured report and wait for user approval.
```

---

### `/fe-screen`

**File:** `.claude/commands/fe-screen.md`

**Purpose:** Builds one complete frontend screen. Designed to be called by `/sprint-execute` for each FE screen, or manually for a single screen rebuild.

**File content:**
```markdown
You are the frontend screen builder for the "simple." app. The user will provide a screen ID.

Valid screen IDs: today, task, plans, site, alerts, report, summary, export, upload, review

## Before writing any code

1. Open and read `Sprints/site_diary_app_clickable_demo.html` — find the `<div data-screen="{id}">` section for the requested screen. This is the visual spec.
2. Read `frontend/CLAUDE.md` — follow every rule in it.
3. Read `frontend/src/constants/theme.ts` — use these tokens, no inline hex values.
4. Read `frontend/src/components/ScreenShell.tsx` — wrap the screen in it.
5. Read the screen's spec from `Sprints/FULL_PRODUCT_EXECUTION_PLAN.md` (find the screen in the sprint section).

## Rules

- Import all colors from `theme.ts`. No hex literals in the screen file.
- Wrap the screen in `<ScreenShell>`. Do not add a top bar or bottom nav directly.
- Use `useNavigate()` from react-router-dom for all navigation. No `window.location`.
- All API calls go through `frontend/src/api/` — never axios directly.
- Show a loading state while fetching, an error state on failure, empty state when data is empty.
- Photo features are stubs — render the UI element but wire no functionality.

## Output

Create or overwrite the screen file at `frontend/src/pages/{ScreenName}.tsx`.
Run `npm run build` to verify TypeScript compiles.
Report: "Screen {id} built. TypeScript: clean. Navigation: {list of routes this screen links to}."
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

**Step 4: Update root CLAUDE.md and create backend/CLAUDE.md + frontend/CLAUDE.md**

### 4a — Root `CLAUDE.md`: three exact string replacements

**Replacement 1** — stale Sprint 2–6 scope header and note:

Find this exact text:
```
## Sprint 2–6 Scope (Backend-Only Until Mockups Arrive)

**Note: Frontend work is deferred pending UI mockups from the user. All sprints below are backend-only until mockups arrive.**
```
Replace with:
```
## Sprint 2–6 Scope

**Frontend phases are gated on backend sprints. Phase 1 (shell + design system) runs in parallel with backend Sprint 2. See `Sprints/FULL_PRODUCT_EXECUTION_PLAN.md` for the full plan. UI source of truth: `Sprints/site_diary_app_clickable_demo.html`.**
```

**Replacement 2** — stale Plan agents note:

Find this exact text:
```
- Frontend sprints are deferred — do not plan frontend work until the user provides UI mockups.
```
Replace with:
```
- Frontend Phase 1 (shell + design system) runs in parallel with backend Sprint 2. Phases 2–5 are gated on their respective backend sprints. See `Sprints/FULL_PRODUCT_EXECUTION_PLAN.md` for full frontend phase plan.
```

**Replacement 3** — stale Out of Scope section:

Find this exact text:
```
## Out of Scope (Sprint 1)

Do not implement these until explicitly added to the brief:
- Authentication / login (single hardcoded user)
- AI summaries, pattern insights, cascade alerts
- PDF export
- Photo uploads (model field exists; UI is a stub)
- Multi-project support
- Visual polish, branding, responsive design beyond functional
```
Replace with:
```
## Out of Scope (all sprints)

Do not implement these until explicitly added to the brief:
- Authentication / login (single hardcoded user)
- Photo uploads (model field exists; UI is a stub)
- Multi-project support

The following are NOW IN SCOPE in Sprints 3–5:
- AI summaries → Sprint 5
- Cascade alerts → Sprint 3
- PDF export → Sprint 5
- Mobile-first UI polish → Frontend Phase 1 (parallel with Sprint 2)
```

**Also add** to the Environment Variables table — append this row:
```
| `ANTHROPIC_API_KEY` | Backend `.env` | Claude API key for AI extraction + summary. Optional locally — endpoints degrade gracefully if absent. Required on Render. |
```

---

### 4b — Create `backend/CLAUDE.md` (new file)

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
- If ANTHROPIC_API_KEY is absent, endpoints return graceful degraded responses (not 500)
- Use settings.anthropic_model for the model ID — never hardcode it

## end_date computation
Always compute in the router: end_date = start_date + timedelta(days=duration_days)
Do not use DB-level triggers or computed columns (SQLite/Postgres portability).

## Fixtures in conftest.py
- client: empty DB, no seed data
- seeded_client: project_id=1 + daily log; access via c.project_id, c.log_id
- seeded_client_with_tasks: above + 3 tasks + 2 dependencies (added in Sprint 2)
```

---

### 4c — Create `frontend/CLAUDE.md` (new file)

```markdown
# Frontend — Agent Guidelines

## Run dev
cd frontend && npm run dev   # port 5173

## Run tests
cd frontend && npm test

## UI source of truth
Always open Sprints/site_diary_app_clickable_demo.html before building any screen.
It is the clickable prototype with exact colors, spacing, and navigation flow.

## Design tokens
Import ALL colors, radius, shadow, shell constants from frontend/src/constants/theme.ts.
No hex color literals in component files.

## Routing
All routes defined in frontend/src/router.tsx only. Routes are frozen — do not rename.
Navigation uses react-router-dom useNavigate() hook. No window.location assignments.

## Shell pattern
Every screen wraps content in <ScreenShell>. Never duplicate top bar or bottom nav chrome.
Screens that hide bottom nav: /task, /summary, /export, /onboard, /onboard/review.

## FAB and bottom nav positioning
Both use position: absolute inside the shell container — NOT position: fixed.
This keeps them anchored to the 390px shell on desktop.

## Padding rule
All screen content areas: paddingBottom: '72px' to clear the bottom nav.

## Key patterns
- All styling: React.CSSProperties objects only. No .css files, no Tailwind.
- All HTTP calls: frontend/src/api/ only. Never call axios directly from a component.
- State: useState/useEffect only. No Redux, React Query, or context.
- TypeScript: all response shapes defined in frontend/src/api/*.ts. Never use `any`.
- PROJECT_ID = 1 is intentional — hardcoded in all pages.

## Frontend phases
- Phase 1 (shell + design system): runs in parallel with backend Sprint 2 — UNBLOCKED
- Phase 2 (core workflow screens): requires Sprint 2 live on Render
- Phase 3 (alerts + report): requires Sprint 3 live on Render
- Phase 4 (AI + export): requires Sprint 5 live on Render
- Phase 5 (onboarding): requires Sprint 4 live on Render
Full detail: Sprints/FULL_PRODUCT_EXECUTION_PLAN.md
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

## Sprint Map Overview

| Sprint | Backend stream | Frontend stream | FE parallel? |
|--------|---------------|-----------------|--------------|
| 2 | Task models + CRUD | Shell + design system + 10 stub routes | ✅ Yes — fully independent |
| 3 | Cascade engine | Screens: today, task, plans, site | ❌ After BE deploys |
| 4 | Excel + AI extraction | Screens: upload, review (onboarding) | ❌ After BE deploys |
| 5 | Submit + AI summary + PDF | Screens: summary, export | ❌ After BE deploys |
| 6 | Today view polish | Screens: alerts, report | ❌ After BE deploys |

---

## Sprint 2 — Task Foundation + App Shell

**Streams:** BE and FE run in **parallel** from day one — zero shared files.

```
/sprint-execute 2 spawns:
  Worktree A: sprint-2-be  (backend models + endpoints)
  Worktree B: sprint-2-fe  (frontend shell + routing)
  → both run simultaneously
  → merge when both gates pass
  → seed.py + Render verify run after merge
```

### Stream A: Backend `[worktree: sprint-2-be]`

**File ownership:** `backend/app/models.py`, `backend/app/main.py`, `backend/app/routers/tasks.py`, `backend/app/routers/daily_log.py`, `backend/tests/test_tasks.py`, `backend/tests/conftest.py`, `backend/alembic/`, `backend/seed.py`

Files to create/modify:
- `backend/app/models.py` — add `Task`, `TaskDependency`, `TaskLogEntry`; add `submitted` (Boolean, default False) and `ai_summary` (Text, nullable) to `DailyLog`
- `backend/alembic/versions/XXXX_task_models.py` — autogenerate migration
- `backend/app/routers/tasks.py` — NEW: full CRUD + today filter + task-entry endpoints
- `backend/app/main.py` — register `tasks.router`
- `backend/app/routers/daily_log.py` — add `submitted` + `ai_summary` to `DailyLogOut`
- `backend/tests/test_tasks.py` — NEW, 20+ tests
- `backend/tests/conftest.py` — add `seeded_client_with_tasks` fixture (3 tasks + 2 deps)
- `backend/seed.py` — extend with 8 sample tasks + 5 dependencies for project id=1

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
    end_date = Column(Date, nullable=False)            # router: start_date + timedelta(days=duration_days)
    status = Column(String(20), nullable=False, default="pending")
    source = Column(String(20), nullable=False, default="manual")
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

New endpoints in `tasks.py`:
```
GET    /projects/{project_id}/tasks              → list all tasks
POST   /projects/{project_id}/tasks              → create one task
POST   /projects/{project_id}/tasks/bulk         → create many (AI extraction later)
PUT    /tasks/{task_id}                          → update task
DELETE /tasks/{task_id}                          → delete task
GET    /projects/{project_id}/tasks/today        → start_date <= today AND status != 'done'
POST   /projects/{project_id}/task-dependencies  → add dependency edge
DELETE /task-dependencies/{dep_id}               → remove dependency edge
POST   /daily-logs/{log_id}/task-entries         → mark task done/not_done
GET    /daily-logs/{log_id}/task-entries         → list all entries for a log
```

**Stream A gate:** `alembic upgrade head` clean, all 67 existing tests still pass, `test_tasks.py` 20+ tests pass.

---

### Stream B: Frontend `[worktree: sprint-2-fe]`

**File ownership:** everything under `frontend/src/` and `frontend/package.json`, `frontend/vite.config.ts`  
**Parallel with:** Stream A — zero backend dependency for this stream

Files to create/modify:
- `frontend/package.json` — add `react-router-dom@^6`
- `frontend/vite.config.ts` — add `test` block for Vitest
- `frontend/src/constants/theme.ts` — NEW: all design tokens (see Design System section)
- `frontend/src/router.tsx` — NEW: all 10 routes
- `frontend/src/App.tsx` — replace tab nav with `<RouterProvider>`
- `frontend/src/components/ScreenShell.tsx` — NEW: shared top bar + content area + bottom nav slot
- `frontend/src/components/BottomNav.tsx` — NEW: 4-tab nav (🏠 Home / 🔔 Alerts / ▣ Reports / ☷ Site)
- `frontend/src/pages/Today.tsx` — stub: `<ScreenShell title="Tower B" subtitle="Today">…</ScreenShell>`
- `frontend/src/pages/Task.tsx` — stub
- `frontend/src/pages/Plans.tsx` — stub
- `frontend/src/pages/Site.tsx` — stub
- `frontend/src/pages/Alerts.tsx` — stub
- `frontend/src/pages/Report.tsx` — stub
- `frontend/src/pages/Summary.tsx` — stub
- `frontend/src/pages/Export.tsx` — stub
- `frontend/src/pages/Upload.tsx` — stub
- `frontend/src/pages/Review.tsx` — stub

Route table (frozen):
```
/                → Today.tsx      (bottom nav: Home)
/task/:taskId    → Task.tsx
/plans           → Plans.tsx
/site            → Site.tsx       (bottom nav: Site)
/alerts          → Alerts.tsx     (bottom nav: Alerts)
/report          → Report.tsx     (bottom nav: Reports)
/summary         → Summary.tsx
/export          → Export.tsx
/onboard         → Upload.tsx
/onboard/review  → Review.tsx
```

Bottom nav hides on: `/task`, `/summary`, `/export`, `/onboard`, `/onboard/review`

**Stream B gate:** `npm run build` clean, all 10 routes navigate correctly, bottom nav highlights active tab.

---

### Sprint 2 done when
- 87+ backend tests pass (67 + 20 new)
- `npm run build` clean, all 10 routes render
- CI green on both workflows
- Render deploy successful — migration log shows new tables
- `/projects/1/tasks` returns 200 on production
- App shell loads at 390px with functional bottom nav

---

## Sprint 3 — Cascade Engine + Daily Workflow UI

**Streams:** BE and dependency polish run in **parallel**. FE starts after BE deploys to Render.

```
/sprint-execute 3 spawns:
  Worktree A: sprint-3-be-cascade    (cascade service + endpoints)
  Worktree B: sprint-3-be-deps       (dependency polish, parallel with A)
  → merge A+B → deploy to Render
  → then: Worktree C: sprint-3-fe    (screens: today, task, plans, site)
```

### Stream A: Cascade Engine `[worktree: sprint-3-be-cascade]`

**File ownership:** `backend/app/services/cascade.py`, `backend/app/routers/tasks.py` (cascade endpoints only), `backend/tests/test_cascade.py`

Files to create/modify:
- `backend/app/services/cascade.py` — NEW (write tests first — TDD)
- `backend/app/routers/tasks.py` — add cascade preview + apply endpoints
- `backend/tests/test_cascade.py` — NEW, 15+ tests

`cascade.py` — Kahn's BFS (NOT recursive DFS):
```python
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
    """Never writes to DB. Raises ValueError on cycle detected."""

def apply_cascade(db, task_id, new_start_date, project_id) -> list[CascadeResult]:
    """Writes new dates, returns same shape as preview."""
```

Why BFS: diamond dependency (C depends on A and B) — DFS shifts C twice, BFS with visited-set shifts it once (max of all predecessors).

New endpoints:
```
POST /tasks/{task_id}/cascade-preview  → {new_date} → list[CascadeResult]
POST /tasks/{task_id}/cascade-apply    → {new_date} → list[CascadeResult], DB written
```

Required test cases: linear chain, diamond, lag_days, no successors, cycle detection, apply vs preview, multi-day duration.

### Stream B: Dependency polish `[worktree: sprint-3-be-deps]` — parallel with A

**File ownership:** `backend/tests/test_tasks.py` (5 new tests only)

- Add 5 edge-case tests: duplicate dependency rejected (UniqueConstraint), self-dependency rejected, cascade on task with no dependencies returns empty list.

### Stream C: Frontend Daily Workflow `[worktree: sprint-3-fe]` — starts after A+B deploy

**Gate:** `POST /tasks/{id}/cascade-preview` returns 200 on Render production.

Build these screens using `/fe-screen` for each:
- `/fe-screen today` — Screen 4: task cards with ✓/× buttons, FAB, wire to `GET /projects/1/tasks/today`
- `/fe-screen task` — Screen 5: reason codes, notes, photo stubs, wire to `POST .../task-entries`
- `/fe-screen plans` — Screen 3: weekly timeline, wire to `GET /projects/1/tasks`
- `/fe-screen site` — Screen 6: tower graphic + level list, wire to `GET /projects/1/tasks`

New API file:
- `frontend/src/api/tasks.ts` — `Task`, `TaskLogEntry`, `CascadeResult` interfaces + all fetch functions

**Navigation wired in this stream:**
- Today: ✓ mark → `/report`; × mark → `/task/:id`; FAB → `/task/new`
- Task: Save → back to `/`
- Plans: event row tap → `/task/:id`
- Site: "Apply filters" → `/?level=Level+4`

### Sprint 3 done when
- 102+ backend tests pass
- Cycle detection raises correctly; diamond dependency not double-shifted
- Render deploy successful
- Screens today, task, plans, site fully functional with real API data
- Full ✓ Done and × Not Done flows work end-to-end in browser

---

## Sprint 4 — Excel/AI Extraction + Onboarding UI

**New backend dependencies:**
```
anthropic>=0.49.0
openpyxl>=3.1.5
python-multipart>=0.0.20
psycopg2-binary==2.9.12
```

**Streams:** BE runs first. FE starts after BE deploys.

```
/sprint-execute 4 spawns:
  Worktree A: sprint-4-be   (ai_extraction + onboarding router + tests)
  → deploy to Render → set ANTHROPIC_API_KEY in Render dashboard
  → then: Worktree B: sprint-4-fe   (screens: upload, review)
```

### Stream A: Backend Onboarding `[worktree: sprint-4-be]`

**File ownership:** `backend/app/config.py`, `backend/app/services/ai_extraction.py`, `backend/app/routers/onboarding.py`, `backend/app/main.py`, `backend/tests/test_onboarding.py`, `backend/requirements.txt`

Files to create/modify:
- `backend/app/config.py` — add `anthropic_api_key: str = ""`, `anthropic_model: str = "claude-sonnet-4-6"`
- `backend/app/services/ai_extraction.py` — NEW
- `backend/app/routers/onboarding.py` — NEW
- `backend/app/main.py` — register `onboarding.router`
- `backend/tests/test_onboarding.py` — NEW, 8+ tests (all mock Claude client)
- `backend/requirements.txt` — add new deps above

`ai_extraction.py`: read xlsx bytes → openpyxl → flat text (≤6000 chars) → Claude JSON prompt → parse ExtractionResult. On any failure: return `confidence: 0.0, error: str(e)`.

Endpoints:
```
POST /projects/{project_id}/upload-schedule   → multipart .xlsx → ExtractionResult
POST /projects/{project_id}/confirm-schedule  → {tasks, dependencies} → {tasks_created, deps_created}
```

**Stream A gate:** upload endpoint returns structured tasks for a test fixture xlsx. All 8+ tests pass with mocked Claude.

### Stream B: Frontend Onboarding `[worktree: sprint-4-fe]` — starts after A deploys

**Gate:** `POST /projects/1/upload-schedule` returns 200 on Render.

Build using `/fe-screen`:
- `/fe-screen upload` — Screen 1: hero + 3 upload rows (Files functional, Photos/Scan stub)
- `/fe-screen review` — Screen 2: collapsible tree of extracted tasks + confirm

New API calls to add to `frontend/src/api/tasks.ts`:
- `uploadSchedule(file: File): Promise<ExtractionResult>`
- `confirmSchedule(tasks, deps): Promise<{tasks_created, dependencies_created}>`

### Sprint 4 done when
- Upload + confirm endpoints tested and live on Render
- `ANTHROPIC_API_KEY` set in Render environment
- Screens upload + review fully functional: full upload → extract → review → confirm → tasks in `/plans`

---

## Sprint 5 — Submission + AI Summary + PDF + Export UI

**New backend dependency:** `reportlab>=4.2.0`

**Streams:** BE runs first (3 sequential steps). FE starts after BE deploys.

```
/sprint-execute 5 spawns:
  Worktree A: sprint-5-be   (submit + ai_summary + pdf — sequential steps within)
  → deploy to Render
  → then: Worktree B: sprint-5-fe   (screens: summary, export)
```

### Stream A: Backend Submission `[worktree: sprint-5-be]`

**File ownership:** `backend/app/routers/daily_log.py`, `backend/app/services/ai_summary.py`, `backend/app/services/pdf_generator.py`, `backend/tests/test_submission.py`, `backend/requirements.txt`

Step 1 — Submit endpoint:
```
POST /daily-logs/{log_id}/submit → DailyLogOut (submitted=True, ai_summary=null)
```
Sets `submitted=True`. Triggers `ai_summary.py` via FastAPI `BackgroundTasks`.

Step 2 — `ai_summary.py`: loads all log data → structured Claude prompt → writes to `DailyLog.ai_summary`. On failure: writes `"[Summary generation failed]"`, never leaves null.

Step 3 — PDF endpoint:
```
GET /daily-logs/{log_id}/export-pdf → StreamingResponse(application/pdf)
```
Sections: project header, weather, crew attendance, tasks done/not done, materials, safety, AI summary.

Tests (10+): submit sets flag, idempotent re-submit, PDF returns `application/pdf` content-type, PDF for missing log returns 404, AI summary stored after mocked background task.

### Stream B: Frontend AI+Export `[worktree: sprint-5-fe]` — starts after A deploys

**Gate:** `POST /daily-logs/1/submit` returns `submitted: true` on Render.

Build using `/fe-screen`:
- `/fe-screen summary` — Screen 9: AI summary text block, polls every 3s while null (max 10 attempts), Edit affordance
- `/fe-screen export` — Screen 10: KPI bar, progress bars, photo gallery stubs, PDF download button

New API calls to add to `frontend/src/api/daily_log.ts`:
- `submitLog(logId)`, `exportPdf(logId)`, extend `DailyLog` interface with `submitted`, `ai_summary`

### Sprint 5 done when
- Submit sets flag; AI summary stored and displayed after polling
- PDF downloads with `application/pdf` content-type
- Full submit → Screen 9 → Screen 10 → PDF download flow works in browser

---

## Sprint 6 — Today View Polish + Alerts/Report UI

**Streams:** BE validation runs first (lightweight). FE starts after.

```
/sprint-execute 6 spawns:
  Worktree A: sprint-6-be   (today endpoint polish + task marking validation)
  → deploy to Render
  → then: Worktree B: sprint-6-fe   (screens: alerts, report)
```

### Stream A: Backend Polish `[worktree: sprint-6-be]`

**File ownership:** `backend/app/routers/tasks.py`, `backend/tests/test_tasks.py`

- Verify `GET /projects/{id}/tasks/today` returns: `id`, `name`, `level_tag`, `trade_tag`, `start_date`, `end_date`, `status`, `duration_days`
- Verify `POST .../task-entries` with `action=not_done` requires `new_date` (422 if missing)
- Add 5 tests: past tasks excluded, future tasks excluded, completed tasks excluded, not_done without new_date returns 422, done entries mark task status

### Stream B: Frontend Alerts+Report `[worktree: sprint-6-fe]` — starts after A deploys

Build using `/fe-screen`:
- `/fe-screen alerts` — Screen 7: Upcoming/Past tabs, alert cards for tasks starting soon + delayed tasks
- `/fe-screen report` — Screen 8: 6 stat cards wired to real data (weather, crew count, tasks done, tasks not done, materials count, photos stub)

Screen 8 wires to: `DailyLog` (weather), attendance endpoint (crew count), `TaskLogEntry` (done/not done counts), materials endpoint (count).

"Generate report" button on Screen 8 → `POST /daily-logs/{id}/submit` → navigate to `/summary`.

### Sprint 6 done when
- 115+ total tests pass
- Today endpoint returns correct fields; not_done without new_date returns 422
- Screens alerts + report render real data
- "Generate report" → submit → AI summary → export flow is complete end-to-end
- Render deploy successful — full app is feature-complete

---

## Design System (extracted from mockup — source of truth)

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

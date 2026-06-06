# "simple." — Full Product Execution Plan

## Sprint Status

| Sprint | Name | Status |
|--------|------|--------|
| 0 | Agent Setup & Infrastructure | ✅ Done |
| 1 | Daily Log MVP (weather, crew, safety, materials, UI) | ✅ Done |
| 2 | Task Foundation + App Shell | ✅ Done |
| 3 | Cascade Engine + Daily Workflow UI | ✅ Done |
| 4 | Excel/AI Extraction + Onboarding UI | ✅ Done |
| 5 | User Module + Multi-Project | ✅ Done |
| 6 | AI Dependency Inference (extend onboarding) | ✅ Done |
| 7 | Submission + AI Summary + PDF | ✅ Done (backend) / 🟡 FE stubs remain |
| 8 | Today View Polish + Alerts/Report UI | 🟡 Next — backend done, FE stubs only |

**Next action:** Execute Sprint 8 FE — build real Alerts screen (upcoming/past tabs, cascade-aware cards) and Report screen (6 stat cards wired to live data, "Generate report" → submit flow).

---

## Full Product Execution Plan (reference)

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

5. **Wait for user to confirm Render deploy**
   Stop here. Tell the user:

   > "Local checks are complete. Before I run production checks, please confirm in the Render dashboard that the deploy has finished (no build errors, `alembic upgrade head` ran). Tell me **'render is up'** or equivalent to proceed."

   Do NOT call /render-verify until the user explicitly confirms.

6. **Call /render-verify**
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

6. **Push main**
   ```bash
   git push origin main
   ```

7. **Wait for user to confirm Render deploy**
   Stop here. Tell the user:

   > "Sprint N is pushed to GitHub. Render will auto-deploy in ~3 minutes. Please check the Render dashboard and confirm the deploy completed successfully (no build errors, `alembic upgrade head` ran). Tell me **'render is up'** or equivalent when ready — I will not run production checks until you confirm."

   Do NOT proceed until the user explicitly confirms.

8. **Verify Render deployment**
   After the user confirms deploy is complete, call /render-verify to confirm production is healthy.

9. **Sprint review**
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
6. **Invoke `/frontend-design`** with the screen's context (screen name, purpose, user — foremen on construction sites, existing design system constraints). Use the aesthetic direction it provides as guidance. Implement within SightSync constraints: theme.ts tokens only, inline React.CSSProperties, ScreenShell wrapper.

## Rules

- Import all colors from `theme.ts`. No hex literals in the screen file.
- Wrap the screen in `<ScreenShell>`. Do not add a top bar or bottom nav directly.
- Use `useNavigate()` from react-router-dom for all navigation. No `window.location`.
- All API calls go through `frontend/src/api/` — never axios directly.
- Show a loading state while fetching, an error state on failure, empty state when data is empty.
- Photo features are stubs — render the UI element but wire no functionality.
- `/frontend-design` output takes priority on visual decisions (spacing, hierarchy, component feel) — SightSync rules take priority on code structure (no CSS files, use theme.ts tokens, use ScreenShell).

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

## Design skill
When building any screen, invoke `/frontend-design` before writing code to get aesthetic direction.
Apply its guidance within SightSync constraints: theme.ts tokens only, inline CSSProperties, ScreenShell wrapper.
`/frontend-design` wins on visual decisions; SightSync rules win on code structure.

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
3. **User confirms deploy** — The agent must stop and ask the user to confirm that the deploy completed successfully before running any production checks. Only proceed after explicit confirmation.
4. **Smoke test production** — Run these checks:
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

| Sprint | Backend stream | Frontend stream | Status |
|--------|---------------|-----------------|--------|
| 2 | Task models + CRUD | Shell + design system + 10 stub routes | ✅ Done |
| 3 | Cascade engine | Screens: today, task, plans, site | ✅ Done |
| 4 | Excel + AI task extraction (no deps) | Screens: upload, review | ✅ Done |
| 5 | User model + JWT auth + multi-project | Login, register, project selector screens | ✅ Done |
| 6 | AI dependency inference (Pass 2) | Review screen — workflow grouping + reviewable deps | ✅ Done |
| 7 | Submit + AI summary + PDF | Screens: summary (stub), export (stub) | ✅ BE Done / 🟡 FE stubs |
| 8 | Today view polish (done) | Screens: alerts, report — real content needed | 🟡 Next |

---

## Sprint 2 — Task Foundation + App Shell ✅ DONE

**What was built:**
- `backend/app/models.py` — `Task`, `TaskDependency`, `TaskLogEntry` models; `submitted` + `ai_summary` on `DailyLog`
- `backend/alembic/versions/516fb84185f5_add_task_models_and_daily_log_submission.py` — migration
- `backend/app/routers/tasks.py` — 326L, 12 endpoints (CRUD, bulk, today-filter, dependencies, task-entries, cascade preview/apply)
- `backend/tests/test_tasks.py` — 45 tests
- `backend/tests/conftest.py` — `seeded_client_with_tasks` fixture
- `backend/seed.py` — 8 tasks + 5 dependency edges for project id=1
- `frontend/src/constants/theme.ts` — all design tokens
- `frontend/src/router.tsx` — 11 frozen routes
- `frontend/src/components/ScreenShell.tsx`, `BottomNav.tsx`
- `frontend/src/pages/` — 10 stub pages (all routes rendered)

---

## Sprint 3 — Cascade Engine + Daily Workflow UI ✅ DONE

**What was built:**
- `backend/app/services/cascade.py` — 212L, Kahn's BFS cascade engine; `preview_cascade()` (read-only) + `apply_cascade()` (writes DB)
- `backend/tests/test_cascade.py` — 15 tests (linear chain, diamond, lag_days, cycle detection, apply vs preview)
- `backend/app/routers/tasks.py` — added `POST /tasks/{id}/cascade-preview` + `POST /tasks/{id}/cascade-apply`
- `backend/tests/test_tasks.py` — 5 additional dependency edge-case tests (45 total)
- `frontend/src/pages/Today.tsx` — 265L, task cards with ✓/× buttons, wired to live API
- `frontend/src/pages/Task.tsx` — 379L, task detail + reason codes + cascade preview
- `frontend/src/pages/Plans.tsx` — 227L, weekly timeline wired to live API
- `frontend/src/pages/Site.tsx` — 287L, tower + level list wired to live API
- `frontend/src/api/tasks.ts` — 83L, Task/TaskLogEntry/CascadeResult interfaces + all fetch functions

**Stubs remaining (built in Sprint 6):** `Alerts.tsx` (12L placeholder — text says "coming in Sprint 3", update to "coming soon")

---

## Sprint 4 — Excel/AI Extraction + Onboarding UI ✅ DONE

**Scope note:** AI extracts **tasks only** from the uploaded schedule. Dependency extraction is out of scope — dependencies remain seeded manually or via API. `confirm-schedule` does a **clean slate replace** (deletes all existing tasks before inserting).

### What is already built (on main)

**Backend ✅**
- `backend/app/services/ai_extraction.py` — xlsx → openpyxl → flat text → Claude JSON → `ExtractionResult` (tasks only: name, level_tag, trade_tag, start_date, duration_days). Returns `confidence: 0.0, error: str(e)` on any failure.
- `backend/app/routers/onboarding.py` — 128L, two endpoints:
  - `POST /projects/{project_id}/upload-schedule` → multipart `.xlsx` → `ExtractionResult`
  - `POST /projects/{project_id}/confirm-schedule` → `{tasks}` → `{tasks_created: int}` (clean slate)
- `backend/app/config.py` — `anthropic_api_key`, `anthropic_model: "claude-sonnet-4-6"`
- `backend/tests/test_onboarding.py` — ~12 tests, all mocking Claude client
- `backend/requirements.txt` — includes `anthropic`, `openpyxl`, `python-multipart`

**Frontend ✅**
- `frontend/src/pages/Upload.tsx` — 169L, file picker for `.xlsx` (Photos/Scan stubs)
- `frontend/src/pages/Review.tsx` — 250L, flat list of extracted tasks + confirm button
- `frontend/src/api/tasks.ts` — includes `uploadSchedule(file)` (uses `fetch`, not axios — FormData boundary), `confirmSchedule(tasks)`

### What remains

**MID-CHECKPOINT — User must dry-test locally before deploy**

> 1. Set `ANTHROPIC_API_KEY` in `backend/.env`
> 2. Start local backend: `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`
> 3. Open Swagger at http://localhost:8000/docs → `POST /projects/1/upload-schedule`
> 4. Upload a real `.xlsx` schedule file and verify the extracted tasks look correct
>
> Tell the agent **'extraction looks good'** to proceed, or describe issues to fix first.

**After user approves:**
- Push to GitHub → Render auto-deploys
- Set `ANTHROPIC_API_KEY` in Render dashboard environment variables
- Run `/render-verify` to confirm production is healthy

### Sprint 4 done when
- User dry-tests extraction locally and approves
- Code pushed and deployed to Render
- `ANTHROPIC_API_KEY` set in Render environment
- Full flow verified: upload `.xlsx` → extracted tasks shown → confirm → tasks appear in `/plans`

---

## Sprint 6 — AI Dependency Inference ✅ DONE

**What was built:**
- `backend/app/services/ai_extraction.py` — extended with `infer_workflows_and_dependencies()` (Pass 2), `Workflow`, `InferredDependency` dataclasses, `ExtractionResult` extended with `workflows` + `dependencies` fields
- `backend/app/services/prompts/task_extraction.md` — extracted inline prompt to file
- `backend/app/services/prompts/dependency_inference.md` — new Pass 2 prompt (senior PM persona, workflow-scoped logic)
- `backend/app/routers/onboarding.py` — upload response includes `workflows` + `dependencies`; confirm-schedule accepts deps, inserts via `create_task_dependency()`
- `backend/tests/test_onboarding.py` — 22 total tests (10 new Pass 2 tests added)
- `frontend/src/pages/Review.tsx` — tasks grouped by workflow, deps shown with reasoning + confidence badge, removable before confirm
- `frontend/src/api/tasks.ts` — extended `Workflow`, `InferredDependency`, `ExtractionResult` types; updated `confirmSchedule(tasks, dependencies)` signature

---

### Core Principle: Workflow-Scoped Dependencies

A construction project runs **multiple parallel workflow chains** — one per trade — simultaneously. A delay in one workflow only cascades within that workflow.

```
Workflow A (Structural):  [Frame L1] → [Frame L2] → [Frame L3]
Workflow B (Electrical):  [Rough-in L1] → [Rough-in L2] → [Rough-in L3] → [Panel]
Workflow C (Plumbing):    [Stack] → [Rough Plumbing L1] → [Rough Plumbing L2]
```

- Intra-workflow: same trade, next floor — always sequential
- Cross-workflow handoff: real physical constraint (e.g. framing close → MEP rough-in on that floor)
- No artificial shape constraints — Claude acts as a senior PM

---

### Stream A: Backend `[worktree: sprint-4b-be]`

**File ownership:** `backend/app/services/ai_extraction.py`, `backend/app/services/prompts/task_extraction.md` (NEW), `backend/app/services/prompts/dependency_inference.md` (NEW), `backend/app/routers/onboarding.py`, `backend/tests/test_onboarding.py`, `backend/requirements.txt`

#### New / updated types in `ai_extraction.py`

```python
@dataclass
class ExtractedTask:          # add workflow_id field (NOT persisted to DB)
    name: str
    level_tag: str
    trade_tag: str | None
    start_date: str
    duration_days: int
    excel_row_index: int
    workflow_id: str           # assigned by Pass 2

@dataclass
class Workflow:               # NEW
    id: str                   # "wf_0", "wf_1", ...
    name: str                 # e.g. "Electrical", "Structural"
    task_indices: list[int]   # ordered task indices within this workflow

@dataclass
class InferredDependency:     # NEW
    task_index: int
    depends_on_index: int
    lag_days: int
    confidence: float          # omit if < 0.4
    reasoning: str
    type: str                  # "intra_workflow" | "cross_workflow_handoff"

@dataclass
class ExtractionResult:       # extend: add workflows + dependencies
    tasks: list[ExtractedTask]
    workflows: list[Workflow]             # NEW
    dependencies: list[InferredDependency]  # NEW
    confidence: float
    error: str | None
    raw_text_length: int = 0
```

#### New functions in `ai_extraction.py`

```python
def _load_prompt(name: str) -> str:
    # loads backend/app/services/prompts/{name}.md relative to this file

def infer_workflows_and_dependencies(
    tasks: list[ExtractedTask],
) -> tuple[list[Workflow], list[InferredDependency]]:
    # Pass 2: inject tasks JSON into dependency_inference.md → call Claude
    # Filter deps where confidence < 0.4
    # On any failure: return ([], []) — never raise
```

Update `extract_tasks_from_xlsx()` to call `infer_workflows_and_dependencies()` after Pass 1 and return the extended `ExtractionResult`. If Pass 2 fails → return tasks with `workflows=[], dependencies=[], error` set.

#### Prompt files

**`backend/app/services/prompts/task_extraction.md`** — move existing inline prompt here; add tolerance notes (Hebrew/English, merged cells), field table, input placeholder `{{XLSX_TEXT}}`.

**`backend/app/services/prompts/dependency_inference.md`** — full prompt (see SPRINT_4B_PLAN.md for exact content). Key sections: Role (senior construction PM), Context (parallel workflow chains), Input `{{TASKS_JSON}}`, two-step task (Step 1: identify workflows, Step 2: infer deps), output JSON schema.

#### Updated endpoints (`onboarding.py`)

```
POST /projects/{project_id}/upload-schedule
  — response now includes: tasks, workflows, dependencies, confidence, error

POST /projects/{project_id}/confirm-schedule
  — now accepts: { tasks: [...], dependencies: [...] }
  — inserts tasks (clean slate) then inserts deps via existing create_task_dependency()
  — returns: { tasks_created: int, deps_created: int }
```

Reuse: `create_task_dependency()` from `backend/app/routers/tasks.py` (already handles UniqueConstraint).

#### Graceful degradation

- No API key → Pass 1 skipped entirely; return empty result with `error`
- Pass 1 succeeds, Pass 2 fails → return tasks only, `workflows=[], dependencies=[], error` set
- Foreman can still confirm tasks-only in both degraded cases — never return 500

#### New tests in `backend/tests/test_onboarding.py` (10 additions)

All mock `anthropic.Anthropic()`. Add `_mock_pass2_response()` helper returning `{workflows, dependencies}` JSON shape.

| # | Test |
|---|------|
| 1 | upload response includes `workflows` field |
| 2 | upload response includes `dependencies` field |
| 3 | Pass 2 failure → tasks returned, `workflows=[]`, `dependencies=[]`, `error` set |
| 4 | deps with confidence < 0.4 excluded from response |
| 5 | confirm-schedule with deps → deps inserted in DB |
| 6 | confirm idempotency — re-confirming doesn't duplicate deps |
| 7 | parallel workflows — Electrical and Plumbing get zero cross-workflow deps between them |
| 8 | intra-workflow transitive reduction — 3-task chain yields 2 edges (A→B, B→C), not 3 |
| 9 | intra-workflow ordering — tasks ordered by level_tag within a workflow |
| 10 | no API key — Pass 2 skipped, tasks still returned, error field set |

**Stream A gate:** 10 new tests pass (mocked), all existing onboarding + task tests still pass.

---

### Stream B: Frontend Review Update `[worktree: sprint-4b-fe]` — starts after A deploys

**Gate:** `POST /projects/{id}/upload-schedule` returns `workflows` + `dependencies` fields on Render.

**File ownership:** `frontend/src/pages/Review.tsx`, `frontend/src/api/tasks.ts`

**`frontend/src/api/tasks.ts`** — extend types:
- Add `Workflow`, `InferredDependency` interfaces
- Extend `ExtractionResult` with `workflows: Workflow[]`, `dependencies: InferredDependency[]`
- Update `confirmSchedule(tasks, dependencies)` signature and request body

**`frontend/src/pages/Review.tsx`** — update UI:
- Group tasks by `workflow_id` — one collapsible section per workflow (workflow name as header)
- Show each inferred dependency with its `reasoning` and `confidence` badge
- Allow foreman to remove individual deps before confirming (local state remove)
- Pass both `tasks` and `dependencies` to `confirmSchedule()`

### Sprint 4B done when
- Upload returns `workflows` + `dependencies` on Render
- Review screen groups tasks by workflow and shows reviewable deps
- Foreman can remove individual deps before confirming
- Confirm → tasks + deps both appear in `/plans` and cascade engine can use them
- All 10 new tests pass

---

## Sprint 5 — User Module + Multi-Project ✅ DONE

**Goal:** Add JWT authentication (email + password), a `User` model, a `ProjectMember` join table (many-to-many), and replace all hardcoded `project_id=1` references with dynamic project context. After this sprint every API call is authenticated and project-scoped.

**New pip dependencies:**
```
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
```

**Streams:** BE runs first. FE starts after BE deploys.

```
/sprint-execute 5 spawns:
  Worktree A: sprint-5-be   (User model, ProjectMember, auth service, auth router, projects router, update daily_log.py, conftest updates, migration, tests)
  → deploy to Render → user confirms Render is up
  → then: Worktree B: sprint-5-fe   (login, register, project-select screens, AuthContext, route guards, dynamic project_id)
```

---

### Stream A: Backend Auth + Multi-Project `[worktree: sprint-5-be]`

**File ownership:** `backend/app/models.py`, `backend/app/config.py`, `backend/app/main.py`, `backend/app/services/auth_service.py` (NEW), `backend/app/routers/auth.py` (NEW), `backend/app/routers/projects.py` (NEW), `backend/app/routers/daily_log.py`, `backend/alembic/`, `backend/tests/conftest.py`, `backend/tests/test_auth.py` (NEW), `backend/requirements.txt`

#### New models (`backend/app/models.py`)

```python
class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name          = Column(String(255), nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)
    projects      = relationship("ProjectMember", back_populates="user")

class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("user_id", "project_id", name="uq_user_project"),)
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    role       = Column(String(20), nullable=False, default="member")  # "owner" | "member"
    user       = relationship("User", back_populates="projects")
    project    = relationship("Project", back_populates="members")
```

Also add to `Project`: `members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")`

#### New service (`backend/app/services/auth_service.py`)

```python
def hash_password(plain: str) -> str          # passlib bcrypt
def verify_password(plain: str, hashed: str) -> bool
def create_access_token(user_id: int) -> str  # python-jose, HS256, settings.secret_key
def get_current_user(token: str = Depends(oauth2_scheme), db=Depends(get_db)) -> User
    # decodes JWT, looks up user, raises 401 if invalid/expired
```

#### New config fields (`backend/app/config.py`)

```python
jwt_algorithm: str = "HS256"
jwt_expiration_minutes: int = 60 * 24 * 7   # 7 days
```

#### New router: `backend/app/routers/auth.py`

```
POST /auth/register  → {email, password, name} → {id, email, name}  (201)
POST /auth/login     → {email, password} → {access_token, token_type: "bearer"}
GET  /auth/me        → current user info  (requires auth)
```

#### New router: `backend/app/routers/projects.py`

```
GET    /projects                          → list projects the current user is a member of
POST   /projects                          → create project → auto-assign current user as "owner"
GET    /projects/{project_id}             → get project (membership required)
PUT    /projects/{project_id}             → update project name/location (owner only)
DELETE /projects/{project_id}             → delete project + all data (owner only)
POST   /projects/{project_id}/members     → {email, role} → add user to project (owner only)
DELETE /projects/{project_id}/members/{user_id} → remove member (owner only)
```

#### Update `backend/app/routers/daily_log.py`

- Remove `HARDCODED_PROJECT_ID = 1` (line 14)
- Change `POST /daily-logs/today` → `POST /projects/{project_id}/daily-logs/today`
- Change `GET /daily-logs/{date}` → `GET /projects/{project_id}/daily-logs/{date}`
- Add `current_user: User = Depends(get_current_user)` to both endpoints
- Validate user is a member of `project_id` before proceeding
- All other routers (`tasks`, `crew`, `incidents`, `materials`, `onboarding`) already use `{project_id}` — just add `Depends(get_current_user)` + membership check to each

#### Update `backend/app/main.py`

- Register `auth.router`, `projects.router`
- Change CORS `allow_credentials=False` → `True`
- Restrict `allow_origins` from `["*"]` to `settings.cors_origins`

#### Update `backend/tests/conftest.py`

Use FastAPI `dependency_overrides` to bypass JWT in tests — never generate real tokens in tests:
```python
# In each fixture, after creating the TestClient:
from app.services.auth_service import get_current_user
client.app.dependency_overrides[get_current_user] = lambda: test_user_object
```
Add `test_user` fixture that creates a `User` row in the test DB. Update `seeded_client` to also create a `ProjectMember` linking the test user to project_id=1.

#### New test file: `backend/tests/test_auth.py` (10+ tests)

- Register new user → 201
- Register duplicate email → 409
- Login with correct credentials → returns token
- Login with wrong password → 401
- `GET /auth/me` with valid token → 200
- `GET /auth/me` with no token → 401
- Create project → current user is owner
- Add member to project → member can access project
- Non-owner cannot delete project → 403
- Non-member cannot access project endpoints → 403

**Stream A gate:** migration runs clean, all existing tests still pass (via dependency_override), 10+ new auth tests pass.

---

### Stream B: Frontend Auth + Dynamic Project `[worktree: sprint-5-fe]` — starts after A deploys

**Gate:** `POST /auth/login` returns 200 on Render production.

**New files:**
- `frontend/src/contexts/AuthContext.tsx` — stores `{token, user}` in localStorage; provides `login()`, `logout()`, `isAuthenticated`
- `frontend/src/contexts/ProjectContext.tsx` — stores `{currentProject}` (id + name); provides `setCurrentProject()`
- `frontend/src/api/auth.ts` — `register()`, `login()`, `getMe()`
- `frontend/src/api/projects.ts` — `fetchProjects()`, `createProject()`, `addMember()`, `removeMember()`
- `frontend/src/components/ProtectedRoute.tsx` — redirects to `/login` if not authenticated
- `frontend/src/pages/Login.tsx` — email + password form, calls `login()`, stores token, redirects to `/projects`
- `frontend/src/pages/Register.tsx` — name + email + password form, calls `register()`, auto-logs in, redirects to `/projects`
- `frontend/src/pages/ProjectSelect.tsx` — lists user's projects, "Create new project" button, sets current project in context, redirects to `/`

**Update `frontend/src/api/client.ts`:**
- Add request interceptor: reads token from localStorage, adds `Authorization: Bearer <token>` header
- Add response interceptor: on 401, clear token + redirect to `/login`

**Update `frontend/src/router.tsx`:**
- Add routes outside `DesktopShell`: `/login` → Login, `/register` → Register, `/projects` → ProjectSelect
- Wrap `DesktopShell` in `<ProtectedRoute>` so all existing routes require auth

**Update all page files** (Today, Task, Plans, Site, CrewManagement, Upload, Review):
- Remove `const PROJECT_ID = 1`
- Replace with `const { currentProject } = useProject()` + `const PROJECT_ID = currentProject.id`

**Update `frontend/src/api/tasks.ts`:**
- Remove hardcoded `/projects/1/` in `uploadSchedule` and `confirmSchedule`
- Accept `projectId` as parameter instead

**Update `frontend/src/components/AsidePanel.tsx`:**
- Replace hardcoded Tel Aviv string with project location from `currentProject`

### Sprint 5 done when
- Register → login → project select → app works end-to-end
- Multi-project: create second project, switch to it, data is isolated
- Add a member to a project → that user can access the project
- Non-member gets 403 on all project endpoints
- All existing tests pass with `dependency_override` auth bypass
- 10+ new auth tests pass
- Render deploy successful

---

## Sprint 7 — Submission + AI Summary + PDF + Export UI ✅ DONE (backend) / 🟡 FE stubs

**What was built (backend — fully done):**
- `backend/app/services/ai_summary.py` — 90L, `generate_and_store_summary()` loads all log data, calls Claude via BackgroundTasks, writes to `DailyLog.ai_summary`. Graceful degradation: no API key → stores fallback message, never raises.
- `backend/app/services/pdf_generator.py` — 194L, `generate_daily_log_pdf()` returns PDF bytes via reportlab. Sections: project header, weather, crew, tasks, materials, safety, AI summary.
- `backend/app/routers/daily_log.py` — added `POST /projects/{project_id}/daily-logs/{log_id}/submit` (sets submitted flag, triggers summary background task) and `GET /projects/{project_id}/daily-logs/{log_id}/export-pdf` (StreamingResponse, application/pdf).
- `backend/tests/test_submission.py` — 12 tests: submit sets flag, idempotent re-submit, PDF content-type, PDF for missing log → 404, AI summary stored after mocked background task.
- `backend/requirements.txt` — includes `reportlab>=4.2.0`

**FE screens remaining (stubs — need real content):**
- `frontend/src/pages/Summary.tsx` — 12L placeholder ("coming in Sprint 5"), needs: AI summary text block + polling every 3s while null + Edit affordance
- `frontend/src/pages/Export.tsx` — 12L placeholder ("coming in Sprint 5"), needs: KPI bar, progress bars, photo gallery stubs, PDF download button
- `frontend/src/api/daily_log.ts` — needs: `submitLog(logId)`, `exportPdf(logId)`, `DailyLog` interface extended with `submitted`, `ai_summary`

**FE work is part of Sprint 8 scope below.**

---

## Sprint 8 — Today View Polish + Alerts/Report UI 🟡 NEXT

**Backend status: ✅ DONE** (today endpoint fields verified, not_done validation with 422, 50 tests in test_tasks.py)

**Remaining work: Frontend only** — all three FE screens are stubs with zero API wiring.

### Stub current state

| Screen | File | Current state |
|--------|------|---------------|
| Alerts | `frontend/src/pages/Alerts.tsx` | 35L — "No alerts" placeholder, no API |
| Report | `frontend/src/pages/Report.tsx` | 57L — static placeholder, no API |
| Summary | `frontend/src/pages/Summary.tsx` | 12L — "coming in Sprint 5" text only |
| Export | `frontend/src/pages/Export.tsx` | 12L — "coming in Sprint 5" text only |

### FE stream `[worktree: sprint-8-fe]`

Build using `/fe-screen` (invokes `/frontend-design` before writing each screen):

**`/fe-screen alerts` — Screen 7:**
- Upcoming/Past tabs
- Alert cards: tasks starting within 3 days (from `GET /projects/{id}/tasks/today` + lookahead), delayed tasks (not_done entries)
- Wires to: tasks API + task-entries API

**`/fe-screen report` — Screen 8:**
- 6 stat cards wired to live data: weather (from DailyLog), crew on-site count (attendance endpoint), tasks done count, tasks not done count, materials count, photos (stub)
- "Generate report" button → `POST /projects/{id}/daily-logs/{log_id}/submit` → navigate to `/summary`
- Wires to: `DailyLog`, attendance endpoint, TaskLogEntry, materials endpoint

**`/fe-screen summary` — Screen 9:**
- AI summary text block
- Polls `GET /projects/{id}/daily-logs/{log_id}` every 3s while `ai_summary` is null (max 10 attempts)
- Edit affordance (inline text edit, re-submit)
- "Use in report" → navigate to `/export`
- New API calls in `frontend/src/api/daily_log.ts`: `submitLog(projectId, logId)`, extend `DailyLog` with `submitted`, `ai_summary`

**`/fe-screen export` — Screen 10:**
- KPI bar (days on track, tasks completed %, crew utilization)
- Progress bars per task category
- Photo gallery stubs
- PDF download button → calls `GET /projects/{id}/daily-logs/{log_id}/export-pdf`
- New API call in `frontend/src/api/daily_log.ts`: `exportPdf(projectId, logId)`

### Sprint 8 done when
- 111+ total backend tests still pass (no regressions)
- Alerts screen shows real cascade-derived data
- Report screen shows 6 live stat cards; "Generate report" → submit works
- Summary screen polls and displays AI summary
- Export screen downloads PDF with `application/pdf` content-type
- Full flow: Report → Summary → Export → PDF download works in browser
- Render deploy successful — full app feature-complete

---

---

## Post-Sprint Features

These features are queued for deployment after all main sprints (1–8) are complete. Each is self-contained and can be executed independently.

---

### Feature A — Crew Registry + Daily Attendance

**Status:** ⏳ Not started  
**Effort:** Frontend-only (backend is fully built)

#### What already exists

| Layer | File | What it does |
|-------|------|-------------|
| Backend | `backend/app/routers/crew.py` | Full CRUD + attendance endpoints |
| Backend | `backend/app/models.py` | `CrewMember` + `CrewAttendance` models |
| Frontend | `frontend/src/pages/CrewManagement.tsx` | Worker list + add/delete (144L, uses dynamic `currentProject.id`) |
| Frontend | `frontend/src/components/CrewAttendanceBlock.tsx` | Attendance toggle per worker (137L) |
| Frontend | `frontend/src/api/crew.ts` | All API calls wired |

#### What is missing

1. **No route** — `CrewManagement.tsx` exists but `/crew` is not in `frontend/src/router.tsx`
2. **No navigation entry point** — no link to crew in sidebar, bottom nav, or any screen
3. **Daily attendance not surfaced** — `CrewAttendanceBlock` exists but is not accessible in the current app flow (Today/Report screens don't show it)

#### Implementation plan

**`frontend/src/router.tsx`** — add two routes inside the `DesktopShell` children:
```
/crew              → CrewManagement.tsx   (worker registry: list, add, delete)
/crew/attendance   → CrewAttendance.tsx   (NEW — daily attendance marking)
```

**`frontend/src/pages/CrewAttendance.tsx`** — NEW screen:
- Header: today's date
- List all crew members for current project (calls `fetchCrew(projectId)`)
- For each worker: name + status toggle (Present / Absent / Partial) + optional note
- Uses existing `CrewAttendanceBlock` component or wires directly to `upsertAttendance()`
- Requires today's `log_id` — call `fetchTodayLog()` on mount to get it
- On-site count shown at top: "4 / 5 on site today"

**Navigation — add Crew entry point to:**
- `frontend/src/components/SidebarNav.tsx` (desktop) — add "Crew" item linking to `/crew`
- `frontend/src/pages/Report.tsx` — "Mark attendance" button linking to `/crew/attendance`
- `frontend/src/pages/Today.tsx` — crew summary card (X/Y on site) tapping → `/crew/attendance`

**`frontend/src/pages/CrewManagement.tsx`** — verify it works with:
- Current auth token (axios interceptor handles this)
- Dynamic `currentProject.id` from context (already uses `currentProject?.id ?? 1` — remove the `?? 1` fallback)

#### Done when
- `/crew` shows worker list, add and delete work per-project
- `/crew/attendance` shows today's workers with present/absent/partial toggles
- At least one nav entry point reaches each screen
- No hardcoded `project_id=1` fallback remains in crew files

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

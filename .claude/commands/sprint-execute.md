You are the sprint executor for the "simple." (SightSync) project. The user will provide a sprint number (e.g. "2").

## Before starting

Read `Sprints/FULL_PRODUCT_EXECUTION_PLAN.md` — find the sprint's section. Note:
- Which streams are **parallel** (can run simultaneously — distinct file ownership)
- Which streams are **sequential** (one must complete before the next starts)
- The exact file ownership list per stream
- The completion gate for each stream

## Steps

### 1. Spawn parallel streams

For each parallel stream, use the Agent tool with `isolation: "worktree"`.
Each agent prompt must be self-contained and include:
- "Read CLAUDE.md and backend/CLAUDE.md (or frontend/CLAUDE.md) before writing any code."
- The stream's exact file ownership list (copy from plan)
- The complete spec for every file to create/modify (copy from plan)
- The stream's completion gate verbatim
- **"When your work is done, stage ALL your changes with `git add -A` and commit them with a message matching `feat(<scope>): <description>`. Do this BEFORE reporting done."**

Launch ALL parallel streams in a single message (multiple Agent tool calls simultaneously).

### 2. Merge each completed worktree into main

After EACH stream agent reports done, immediately merge its worktree branch into the local main branch.

For each worktree:
```bash
# From the project root:
git merge <worktree-branch-name> --no-ff -m "merge(<scope>): <stream description>"
git worktree remove .claude/worktrees/<worktree-id> --force
git branch -d <worktree-branch-name>
```

Do NOT wait for all streams to finish before merging — merge each as it completes.

### 3. Run sequential streams

After parallel streams are merged, run sequential streams one at a time in the current session.
For FE streams gated on Render: call /render-verify first, confirm the gate endpoint returns 200, then spawn the FE agent (also with `isolation: "worktree"`, and with the same commit-before-done instruction).

### 4. Run full test suite

After all worktrees are merged to main:
```bash
cd backend && .venv/bin/python -m pytest tests/ -v
cd frontend && npm install && npm run build
```

Fix any failures before proceeding.

### 5. Run local migration if backend changed

```bash
cd backend && .venv/bin/alembic upgrade head
```

### 6. Push main

```bash
git push origin main
```

### 7. Verify Render deployment

After Render auto-deploys (~3 min), run /render-verify to confirm production is healthy.

### 8. Sprint review

Run /sprint-review to produce the structured report and pause for user approval.
Do NOT proceed to the next sprint until the user explicitly says "go ahead", "proceed", or equivalent.

---

## Security constraints (always enforce)
- Never commit `.env` files
- Never commit `backend/sightsync.db`, `backend/*.db`, `backend/railway.toml`
- `ANTHROPIC_API_KEY` is never hardcoded — set it in Render dashboard only
- Mock `anthropic.Anthropic()` in ALL unit tests — never call the real API in tests

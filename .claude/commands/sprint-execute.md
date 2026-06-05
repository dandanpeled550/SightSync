You are the sprint executor for the "simple." (SightSync) project. The user will provide a sprint number (e.g. "2").

## Before starting

Read `Sprints/FULL_PRODUCT_EXECUTION_PLAN.md` — find the sprint's section. Note:
- Which streams are **parallel** (can run simultaneously — distinct file ownership)
- Which streams are **sequential** (one must complete before the next starts)
- The exact file ownership list per stream
- The completion gate for each stream

## Steps

1. **Spawn parallel streams**
   For each parallel stream, use the Agent tool with `isolation: "worktree"`.
   Each agent prompt must be self-contained and include:
   - "Read CLAUDE.md and backend/CLAUDE.md (or frontend/CLAUDE.md) before writing any code."
   - The stream's exact file ownership list (copy from plan)
   - The complete spec for every file to create/modify (copy from plan)
   - The stream's completion gate verbatim
   Launch ALL parallel streams in a single message (multiple Agent tool calls simultaneously).

2. **Run sequential streams**
   After parallel streams complete and their branches are merged to the sprint branch:
   - For FE streams gated on Render: call /render-verify first, confirm the gate endpoint returns 200, then spawn the FE agent
   - Run sequential streams one at a time in the current session

3. **Merge and test**
   After all streams report done:
   - Run `cd backend && .venv/bin/python -m pytest tests/ -v`
   - Run `cd frontend && npm run build`
   - If CI fails, fix on the sprint branch before proceeding

4. **Create sprint PR**
   ```
   gh pr create --title "Sprint N — <Sprint Name>" --body "$(cat <<'EOF'
   ## Summary
   - [one bullet per stream]
   - [new endpoints or screens added]

   ## Test plan
   - [ ] Backend tests pass
   - [ ] Frontend build clean
   - [ ] Render deploy verified

   🤖 Generated with Claude Code
   EOF
   )"
   ```

5. **Deploy and verify**
   After PR merges to main:
   - Monitor Render auto-deploy (check dashboard)
   - Run /render-verify when deploy completes

6. **Sprint review**
   Run /sprint-review to produce the structured report and pause for user approval.
   Do NOT proceed to the next sprint until the user explicitly says "go ahead", "proceed", or equivalent.

## Security constraints (always enforce)
- Never commit `.env` files
- Never commit `backend/sightsync.db`, `backend/railway.toml`, `frontend/tsconfig.tsbuildinfo`
- `ANTHROPIC_API_KEY` is never hardcoded — set it in Render dashboard only
- Mock `anthropic.Anthropic()` in ALL unit tests — never call the real API in tests

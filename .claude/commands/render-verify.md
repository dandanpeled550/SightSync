Verify the production Render deployment is healthy. Execute the following checks and report the results.

## Steps to execute

1. **Read the Render backend URL**
   Check render.yaml or ask the user to provide the production URL if not found.

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
   Look at the most recently completed sprint in Sprints/FULL_PRODUCT_EXECUTION_PLAN.md and identify its "key endpoint". Hit that endpoint and verify it returns a non-500 response.

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

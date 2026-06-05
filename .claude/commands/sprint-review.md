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
   Invoke the render-verify slash command to check production health.

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

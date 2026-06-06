## Sprint 4B — AI Dependency Inference

**Goal:** Extend the Sprint 4 task-extraction pipeline with a second Claude pass that infers construction task dependencies. The foreman reviews extracted tasks grouped by workflow chain, removes any incorrect dependencies, then confirms — creating both tasks and dependencies in a single onboarding flow.

**Gate:** Sprint 4 must be deployed and live on Render (`POST /projects/1/upload-schedule` returns 200) before this sprint runs.

**Streams:** BE runs first. FE updates after BE deploys.

```
/sprint-execute 4B spawns:
  Worktree A: sprint-4b-be   (extend ai_extraction + add prompt files + update onboarding router + new tests)
  → deploy to Render
  → then: Worktree B: sprint-4b-fe   (update Review screen — workflow grouping + reviewable deps)
```

---

### Core Principle: Workflow-Scoped Dependencies

A construction project runs **multiple parallel workflow chains** — one per trade — simultaneously. A delay in one workflow only cascades within that workflow.

```
Workflow A (Structural):  [Frame L1] → [Frame L2] → [Frame L3]
Workflow B (Electrical):  [Rough-in L1] → [Rough-in L2] → [Rough-in L3] → [Panel]
Workflow C (Plumbing):    [Stack] → [Rough Plumbing L1] → [Rough Plumbing L2]
```

- "Rough-in L1" stuck → only "Rough-in L2" blocked. Structural and Plumbing continue.
- "Rough-in L1" → "Rough-in L2" = **intra-workflow** (same trade, next floor).
- "Frame L2 close" → "Rough-in L2 start" = **cross-workflow handoff** (physical constraint).
- Cross-workflow deps are real construction constraints, not row-order artifacts.

---

### Architecture: Two-Pass Pipeline

```
xlsx bytes
    │
    ▼
[Pass 1] task_extraction.md prompt  ← ALREADY EXISTS in Sprint 4
    Output: List[ExtractedTask] — name, level_tag, trade_tag,
            start_date, duration_days, excel_row_index
    │
    ▼
[Pass 2] dependency_inference.md prompt  ← NEW
    Single Claude call:
    Step A: identify parallel workflow chains (same trade_tag = one workflow,
            ordered by level_tag floor-by-floor)
    Step B: infer dependencies from real construction knowledge
            — intra-workflow: sequential edges within each chain
            — cross-workflow: real physical handoffs only
            Claude acts as a senior PM — no artificial shape constraints
    Output: { workflows: [...], dependencies: [...] }
    │
    ▼
ExtractionResult (extended — adds workflows + dependencies)
    │
    ▼
Review screen (tasks grouped by workflow, deps reviewable) → confirm-schedule
```

---

### Stream A: Backend `[worktree: sprint-4b-be]`

**File ownership (all modifications to existing Sprint 4 files + two new prompt files):**
- `backend/app/services/ai_extraction.py` — EXTEND: add Pass 2, new types, update pipeline
- `backend/app/services/prompts/task_extraction.md` — NEW: move inline prompt to file
- `backend/app/services/prompts/dependency_inference.md` — NEW: Pass 2 prompt
- `backend/app/routers/onboarding.py` — UPDATE: new response shape, accept deps in confirm
- `backend/tests/test_onboarding.py` — EXTEND: 10 new tests for Pass 2 behaviour

**New / updated types in `ai_extraction.py`:**
```python
@dataclass
class ExtractedTask:          # add workflow_id field
    name: str
    level_tag: str
    trade_tag: str | None
    start_date: str
    duration_days: int
    excel_row_index: int
    workflow_id: str          # assigned by Pass 2; NOT persisted to DB

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
    confidence: float
    reasoning: str
    type: str                 # "intra_workflow" | "cross_workflow_handoff"

@dataclass
class ExtractionResult:       # extend: add workflows + dependencies
    tasks: list[ExtractedTask]
    workflows: list[Workflow]            # NEW
    dependencies: list[InferredDependency]  # NEW
    confidence: float
    error: str | None
    raw_text_length: int = 0
```

**New functions to add to `ai_extraction.py`:**
```python
def _load_prompt(name: str) -> str:
    # Loads backend/app/services/prompts/{name}.md relative to this file

def infer_workflows_and_dependencies(
    tasks: list[ExtractedTask],
) -> tuple[list[Workflow], list[InferredDependency]]:
    # Pass 2: inject tasks JSON into dependency_inference.md → call Claude/OpenAI
    # Filter deps where confidence < 0.4
    # On failure: return ([], []) — never raise

# Update extract_tasks_from_xlsx() to also call infer_workflows_and_dependencies()
# and return the extended ExtractionResult.
# If Pass 2 fails → return tasks with empty workflows/deps + error field set.
```

---

### Prompt Files

**`backend/app/services/prompts/task_extraction.md`**

Move the existing inline `_build_prompt()` string here. Add:
- Context header (construction PM app, Israeli foremen, project_id=1)
- Tolerance note (Hebrew/English, inconsistent columns, merged cells)
- Field table with types and defaults
- Rule: skip headers/empty rows; do NOT hallucinate names
- Input placeholder: `{{XLSX_TEXT}}`
- Output: JSON array with fields: name, level_tag, trade_tag, start_date (ISO), duration_days, excel_row_index

**`backend/app/services/prompts/dependency_inference.md`**

```markdown
# Role
You are a senior construction project manager with 20+ years of experience planning
and executing multi-floor building projects. You have deep, hands-on knowledge of
every trade — structural, electrical, plumbing, HVAC, drywall, tiling, painting,
finishing — and you know exactly which tasks must complete before others can begin,
which trades can work in parallel, and the real-world consequences when a task is delayed.

You are using "simple." — a field management app for Israeli construction foremen —
to set up a project's task dependencies.

# Context: How Construction Projects Work
A construction project runs multiple parallel workflow chains — one per trade —
simultaneously across all floors. They only intersect at physical handoff points.

Workflow = same trade, ordered floor-by-floor:
- Structural: Frame L1 → Frame L2 → Frame L3
- Electrical: Rough-in L1 → Rough-in L2 → Panel → Fixtures
- Plumbing: Stack → Rough Plumbing L1 → Rough Plumbing L2 → Finish

A delay in "Rough-in L2" blocks only "Rough-in L3" — not "Frame L2" or "Rough Plumbing L2".

Physical handoff examples:
- Concrete must cure (28 days) before framing starts
- Structural framing on a floor must close before MEP rough-in on that floor
- MEP rough-in must complete before drywall on that floor
- Excavation must complete before foundation pour

# Input
{{TASKS_JSON}}

# Your Task — Two Steps

## Step 1: Identify Parallel Workflows
Group tasks into workflow chains by trade_tag, ordered by level_tag (Basement → L1 → L2 → Roof).
Tasks in different workflows work in parallel unless Step 2 requires a dependency.

Output:
"workflows": [{ "id": "wf_0", "name": "Structural", "task_indices": [0, 3, 7] }, ...]

## Step 2: Infer Dependencies
- Intra-workflow: each task depends on the previous one in its workflow.
  Emit ONE edge per consecutive pair only — no transitive edges (A→B + B→C, NOT A→C).
- Cross-workflow: use your real construction knowledge. Ask:
  "Could this task realistically begin if that other task is not yet complete?"
  No artificial shape constraints — deps may span floors, areas, or be global prerequisites.
- Omit deps with confidence < 0.4.

Confidence:
- 1.0 = hard physical requirement
- 0.8 = strong construction convention
- 0.6 = common practice, exceptions exist
- 0.4 = plausible but uncertain

# Output
Return ONLY valid JSON — no prose, no markdown fences:
{
  "workflows": [
    { "id": "wf_0", "name": "Structural", "task_indices": [0, 2, 5] }
  ],
  "dependencies": [
    {
      "task_index": 2,
      "depends_on_index": 0,
      "lag_days": 0,
      "confidence": 1.0,
      "reasoning": "Foundation must complete before slab can begin",
      "type": "intra_workflow"
    },
    {
      "task_index": 4,
      "depends_on_index": 2,
      "lag_days": 0,
      "confidence": 0.85,
      "reasoning": "Framing must close this floor before electrical rough-in can begin",
      "type": "cross_workflow_handoff"
    }
  ]
}
```

---

### Updated Endpoints (`onboarding.py`)

```
POST /projects/{project_id}/upload-schedule
  — unchanged URL
  — response now includes: tasks, workflows, dependencies, confidence, error

POST /projects/{project_id}/confirm-schedule
  — now accepts: { tasks: [...], dependencies: [...] }
  — inserts tasks via existing clean-slate logic (already in Sprint 4)
  — inserts deps via existing create_task_dependency() from tasks.py
  — returns: { tasks_created: int, deps_created: int }
```

Reuse from existing codebase:
- `create_task_dependency()` — `backend/app/routers/tasks.py` (already handles unique constraint)
- `get_db()` — `backend/app/database.py`

---

### Graceful Degradation

- No API key → Pass 1 skipped entirely; return `ExtractionResult(tasks=[], workflows=[], dependencies=[], error="...")`
- Pass 1 succeeds, Pass 2 fails → return tasks with `workflows=[], dependencies=[], error="Dependency inference failed: ..."`
- Foreman can still confirm tasks-only (no deps) in both degraded cases
- Never return 500

---

### New Tests (`backend/tests/test_onboarding.py`) — 10 additions

All mock `anthropic.Anthropic()` with `unittest.mock.patch`. Add a `_mock_pass2_response()` helper that returns the `{workflows, dependencies}` JSON shape.

| # | Test |
|---|------|
| 1 | upload response includes `workflows` field |
| 2 | upload response includes `dependencies` field |
| 3 | Pass 2 failure → tasks returned, `workflows=[]`, `dependencies=[]`, `error` set |
| 4 | deps with confidence < 0.4 excluded from response |
| 5 | confirm-schedule with deps → deps inserted in DB |
| 6 | confirm idempotency — re-confirming doesn't duplicate deps |
| 7 | parallel workflows — Electrical and Plumbing tasks get zero cross-workflow deps between them |
| 8 | intra-workflow transitive reduction — 3-task chain yields 2 edges (A→B, B→C), not 3 |
| 9 | intra-workflow ordering — tasks ordered by level_tag within a workflow |
| 10 | no API key — Pass 2 skipped, tasks still returned, error field set |

---

### Stream B: Frontend Review Update `[worktree: sprint-4b-fe]`

**Gate:** `POST /projects/1/upload-schedule` returns `workflows` + `dependencies` on Render.

**File ownership:**
- `frontend/src/pages/Review.tsx` — UPDATE
- `frontend/src/api/tasks.ts` — UPDATE (extend types + confirmSchedule signature)

Changes to `Review.tsx`:
- Group tasks by `workflow_id` — one collapsible section per workflow
- Show each inferred dependency with its `reasoning` and `confidence`
- Allow foreman to remove individual deps before confirming
- Pass both `tasks` and `dependencies` to `confirmSchedule()`

Changes to `frontend/src/api/tasks.ts`:
- Extend `ExtractionResult` type with `workflows: Workflow[]` and `dependencies: InferredDependency[]`
- Update `confirmSchedule(tasks, dependencies)` signature and body

### Sprint 4B done when
- Upload returns `workflows` + `dependencies` on Render
- Review screen groups tasks by workflow and shows reviewable deps
- Foreman confirms → tasks + deps both appear in `/plans`

---

### Verification

1. `cd backend && .venv/bin/python -m pytest tests/test_onboarding.py -v` → all 10 new tests pass
2. Upload a real `.xlsx` → response contains `workflows` array with tasks grouped by trade
3. Upload a real `.xlsx` → response `dependencies` make construction sense (not arbitrary)
4. Unset `ANTHROPIC_API_KEY` → 200 response with `error` field, not 500
5. Confirm with deps → `GET /projects/1/task-dependencies` returns the inserted edges

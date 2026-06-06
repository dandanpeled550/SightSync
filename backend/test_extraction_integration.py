"""
Integration test for the AI extraction pipeline — uses the real Claude API.

Run from the backend/ directory:
    .venv/bin/python test_extraction_integration.py

What this verifies:
1. openpyxl can parse the generated fixture xlsx
2. Claude receives the text and returns valid JSON
3. ExtractionResult is populated with real tasks
4. Confidence score is meaningful (> 0)
5. No error field is set on success
6. Each task has required fields: name, level_tag, start_date, duration_days
"""

import io
import os
import sys

# Add the project root to path so we can import app modules
sys.path.insert(0, os.path.dirname(__file__))

# Load .env — check the worktree dir first, then fall back to main backend dir
from dotenv import load_dotenv
_here = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_here, ".env")
if not os.path.exists(_env_path):
    # Running from a worktree — .env lives in the main repo's backend/
    _env_path = os.path.join(_here, "../../../../backend/.env")
load_dotenv(_env_path)

import openpyxl
from app.services.ai_extraction import extract_tasks_from_xlsx, ExtractionResult


def make_test_xlsx() -> bytes:
    """Build a realistic construction schedule xlsx in memory."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Schedule"

    # Header row
    ws.append(["Task Name", "Level / Phase", "Trade", "Start Date", "Duration (days)"])

    # Realistic construction tasks
    rows = [
        ("Site Preparation & Excavation",  "Level 0 - Foundation", "Civil",        "2025-02-01",  7),
        ("Foundation Formwork & Rebar",    "Level 0 - Foundation", "Concrete",     "2025-02-10", 10),
        ("Foundation Pour & Cure",         "Level 0 - Foundation", "Concrete",     "2025-02-22",  5),
        ("Ground Floor Slab",              "Level 1",              "Concrete",     "2025-03-01",  8),
        ("Ground Floor Framing",           "Level 1",              "Structural",   "2025-03-12", 12),
        ("Electrical Rough-In - Ground",   "Level 1",              "Electrical",   "2025-03-20",  6),
        ("Plumbing Rough-In - Ground",     "Level 1",              "Plumbing",     "2025-03-20",  5),
        ("Level 2 Slab",                   "Level 2",              "Concrete",     "2025-04-01",  8),
        ("Level 2 Framing",                "Level 2",              "Structural",   "2025-04-12", 10),
        ("Roofing Structure",              "Roof",                 "Structural",   "2025-05-01", 14),
        ("Roof Waterproofing",             "Roof",                 "Waterproofing","2025-05-20",  7),
        ("Exterior Cladding",              "Facade",               "Finishing",    "2025-06-01", 20),
        ("Interior Drywall - Level 1",     "Level 1",              "Drywall",      "2025-06-15", 10),
        ("Interior Drywall - Level 2",     "Level 2",              "Drywall",      "2025-06-20", 10),
        ("Final Electrical Fit-Out",       "Level 1",              "Electrical",   "2025-07-01",  8),
        ("Final Plumbing Fit-Out",         "Level 1",              "Plumbing",     "2025-07-05",  6),
    ]

    for row in rows:
        ws.append(row)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


def run():
    print("=" * 60)
    print("AI Extraction Integration Test")
    print("=" * 60)

    # Check at least one API key is present
    from app.config import settings
    if settings.anthropic_api_key:
        print(f"✓ Using Anthropic Claude (model: {settings.anthropic_model})")
    elif settings.openai_api_key:
        print(f"✓ Using OpenAI GPT (model: {settings.openai_model})")
    else:
        print("❌ No AI API key set — add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env")
        sys.exit(1)

    # Build test xlsx
    xlsx_bytes = make_test_xlsx()
    print(f"✓ Test xlsx created ({len(xlsx_bytes)} bytes, 16 tasks in sheet)")

    # Run the full pipeline
    print("\nCalling Claude... (this may take a few seconds)")
    result: ExtractionResult = extract_tasks_from_xlsx(xlsx_bytes)

    print("\n--- Raw result ---")
    print(f"  error:            {result.error!r}")
    print(f"  confidence:       {result.confidence}")
    print(f"  raw_text_length:  {result.raw_text_length}")
    print(f"  tasks extracted:  {len(result.tasks)}")

    if result.tasks:
        print("\n  First 3 tasks:")
        for t in result.tasks[:3]:
            print(f"    • {t.name!r}  level={t.level_tag!r}  trade={t.trade_tag!r}  "
                  f"start={t.start_date}  duration={t.duration_days}d")

    # Assertions
    failures = []

    if result.error is not None:
        failures.append(f"error is set: {result.error!r}")

    if len(result.tasks) == 0:
        failures.append("no tasks extracted")

    if result.confidence <= 0.0:
        failures.append(f"confidence is {result.confidence} — expected > 0")

    if result.raw_text_length == 0:
        failures.append("raw_text_length is 0 — xlsx was not parsed")

    for i, t in enumerate(result.tasks):
        if not t.name:
            failures.append(f"task[{i}].name is empty")
        if not t.level_tag:
            failures.append(f"task[{i}].level_tag is empty")
        if not t.start_date:
            failures.append(f"task[{i}].start_date is empty")
        if t.duration_days < 1:
            failures.append(f"task[{i}].duration_days={t.duration_days} is < 1")
        # Basic ISO date format check
        parts = t.start_date.split("-")
        if len(parts) != 3 or len(parts[0]) != 4:
            failures.append(f"task[{i}].start_date={t.start_date!r} is not YYYY-MM-DD")

    print("\n--- Assertions ---")
    if failures:
        for f in failures:
            print(f"  ❌ {f}")
        print(f"\n✗ {len(failures)} assertion(s) failed")
        sys.exit(1)
    else:
        print(f"  ✓ error is None")
        print(f"  ✓ {len(result.tasks)} tasks extracted (≥1)")
        print(f"  ✓ confidence={result.confidence} > 0")
        print(f"  ✓ raw_text_length={result.raw_text_length} > 0")
        print(f"  ✓ all tasks have required fields (name, level_tag, start_date, duration_days ≥ 1)")
        print(f"\n✅ Pipeline working end-to-end through Claude.")


if __name__ == "__main__":
    run()

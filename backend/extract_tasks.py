"""
CLI script: extract tasks + dependencies from a real xlsx file using the AI extraction pipeline.

Runs both pipeline passes:
  Pass 1 — AI extracts tasks (name, level, trade, dates, apartment/room tags)
  Pass 2 — AI infers workflow groupings and dependency edges between tasks

Usage (run from backend/):
    .venv/bin/python extract_tasks.py <path/to/file.xlsx>
    .venv/bin/python extract_tasks.py ../Dataset/small_smoke_test.xlsx

Output: tasks table → workflow groups → dependency edges.
Exits 0 on success, 1 on error.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.services.ai_extraction import extract_tasks_from_xlsx
from app.config import settings

_SEP = "─" * 72


def _print_tasks(tasks) -> None:
    col_w = max(len(t.name) for t in tasks)
    header = f"{'#':<4} {'Task Name':<{col_w}}  {'Level':<30}  {'Trade':<20}  {'Apartment':<14}  {'Room':<18}  {'Start':<12}  Dur  Workflow"
    print(header)
    print(_SEP)
    for i, t in enumerate(tasks):
        trade = t.trade_tag or "-"
        apt = t.apartment_tag or "-"
        room = t.room_tag or "-"
        wf = t.workflow_id or "-"
        print(f"{i:<4} {t.name:<{col_w}}  {t.level_tag:<30}  {trade:<20}  {apt:<14}  {room:<18}  {t.start_date:<12}  {t.duration_days}d   {wf}")


def _print_workflows(workflows, tasks) -> None:
    if not workflows:
        print("  (none)")
        return
    for wf in workflows:
        member_names = [tasks[idx].name for idx in wf.task_indices if idx < len(tasks)]
        print(f"  [{wf.id}]  {wf.name}")
        for name in member_names:
            print(f"         • {name}")


def _print_dependencies(dependencies, tasks) -> None:
    if not dependencies:
        print("  (none)")
        return
    for dep in dependencies:
        src = tasks[dep.depends_on_index].name if dep.depends_on_index < len(tasks) else f"#{dep.depends_on_index}"
        dst = tasks[dep.task_index].name if dep.task_index < len(tasks) else f"#{dep.task_index}"
        lag = f"+{dep.lag_days}d" if dep.lag_days else "  0d"
        print(f"  {src}")
        print(f"    └─({dep.type}, conf={dep.confidence:.0%}, lag={lag})──► {dst}")
        if dep.reasoning:
            print(f"       {dep.reasoning}")
        print()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: .venv/bin/python extract_tasks.py <path/to/file.xlsx>")
        sys.exit(1)

    xlsx_path = sys.argv[1]
    if not os.path.exists(xlsx_path):
        print(f"File not found: {xlsx_path}")
        sys.exit(1)

    if settings.anthropic_api_key:
        print(f"Provider : Anthropic Claude ({settings.anthropic_model})")
    elif settings.openai_api_key:
        print(f"Provider : OpenAI ({settings.openai_model})")
    else:
        print("No AI API key set — add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env")
        sys.exit(1)

    with open(xlsx_path, "rb") as f:
        xlsx_bytes = f.read()

    print(f"File     : {xlsx_path} ({len(xlsx_bytes):,} bytes)")
    import logging
    logging.basicConfig(
        format="%(levelname)s  %(message)s",
        level=logging.WARNING,
    )

    print(f"\nPass 1 — extracting tasks ...")
    result = extract_tasks_from_xlsx(xlsx_bytes)

    if result.error and not result.tasks:
        print(f"\nError: {result.error}")
        sys.exit(1)

    print(f"\n{_SEP}")
    print(f"PASS 1 RESULTS")
    print(f"{_SEP}")
    print(f"Confidence  : {result.confidence:.0%}")
    print(f"Text parsed : {result.raw_text_length:,} chars")
    print(f"Tasks found : {len(result.tasks)}")
    if result.error:
        print(f"Warning     : {result.error}")
    print()

    if not result.tasks:
        print("No tasks extracted.")
        sys.exit(0)

    _print_tasks(result.tasks)

    print(f"\n{_SEP}")
    print(f"PASS 2 RESULTS — WORKFLOW GROUPS  ({len(result.workflows)} groups)")
    print(f"{_SEP}")
    _print_workflows(result.workflows, result.tasks)

    print(f"\n{_SEP}")
    print(f"PASS 2 RESULTS — DEPENDENCIES  ({len(result.dependencies)} edges)")
    print(f"{_SEP}")
    _print_dependencies(result.dependencies, result.tasks)


if __name__ == "__main__":
    main()

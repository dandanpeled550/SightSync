"""
CLI script: extract tasks from a real xlsx file using the AI extraction pipeline.

Usage (run from backend/):
    .venv/bin/python extract_tasks.py <path/to/file.xlsx>
    .venv/bin/python extract_tasks.py ../Dataset/small_smoke_test.xlsx

Output: pretty-printed task list + confidence score.
Exits 0 on success, 1 on error.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.services.ai_extraction import extract_tasks_from_xlsx
from app.config import settings


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: .venv/bin/python extract_tasks.py <path/to/file.xlsx>")
        sys.exit(1)

    xlsx_path = sys.argv[1]
    if not os.path.exists(xlsx_path):
        print(f"File not found: {xlsx_path}")
        sys.exit(1)

    if settings.anthropic_api_key:
        print(f"Provider: Anthropic Claude ({settings.anthropic_model})")
    elif settings.openai_api_key:
        print(f"Provider: OpenAI ({settings.openai_model})")
    else:
        print("No AI API key set — add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env")
        sys.exit(1)

    with open(xlsx_path, "rb") as f:
        xlsx_bytes = f.read()

    print(f"File: {xlsx_path} ({len(xlsx_bytes):,} bytes)")
    print("Extracting tasks...\n")

    result = extract_tasks_from_xlsx(xlsx_bytes)

    if result.error:
        print(f"Error: {result.error}")
        sys.exit(1)

    print(f"Confidence:  {result.confidence:.0%}")
    print(f"Text parsed: {result.raw_text_length:,} chars")
    print(f"Tasks found: {len(result.tasks)}\n")

    if not result.tasks:
        print("No tasks extracted.")
        sys.exit(0)

    col_w = max(len(t.name) for t in result.tasks)
    header = f"{'#':<4} {'Task Name':<{col_w}}  {'Level':<30}  {'Trade':<20}  {'Apartment':<14}  {'Room':<18}  {'Start':<12}  Dur"
    print(header)
    print("-" * len(header))
    for i, t in enumerate(result.tasks, 1):
        trade = t.trade_tag or "-"
        apt = t.apartment_tag or "-"
        room = t.room_tag or "-"
        print(f"{i:<4} {t.name:<{col_w}}  {t.level_tag:<30}  {trade:<20}  {apt:<14}  {room:<18}  {t.start_date:<12}  {t.duration_days}d")


if __name__ == "__main__":
    main()

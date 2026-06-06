"""
AI extraction service: parse an xlsx file and call Claude to extract tasks.

Never raises exceptions — all failures are captured in ExtractionResult.error.
"""

import io
import json
from dataclasses import dataclass, field
from typing import Optional

import openpyxl

from app.config import settings


@dataclass
class ExtractedTask:
    name: str
    level_tag: str
    trade_tag: Optional[str]
    start_date: str   # ISO date string "YYYY-MM-DD"
    duration_days: int


@dataclass
class ExtractionResult:
    tasks: list[ExtractedTask] = field(default_factory=list)
    confidence: float = 0.0
    error: Optional[str] = None
    raw_text_length: int = 0


def _xlsx_to_text(xlsx_bytes: bytes) -> tuple[str, int]:
    """Parse xlsx bytes into flat text (max 6000 chars). Returns (text, length)."""
    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), read_only=True, data_only=True)
    lines: list[str] = []
    for sheet in wb.worksheets:
        lines.append(f"Sheet: {sheet.title}")
        for row in sheet.iter_rows(values_only=True):
            row_values = [str(cell) if cell is not None else "" for cell in row]
            if any(v.strip() for v in row_values):
                lines.append("\t".join(row_values))
    wb.close()
    full_text = "\n".join(lines)
    truncated = full_text[:6000]
    return truncated, len(truncated)


def _build_prompt(text: str) -> str:
    return f"""You are a construction schedule parser. Extract all tasks from the following spreadsheet data.

Return ONLY valid JSON with this exact structure:
{{
  "tasks": [
    {{
      "name": "task name",
      "level_tag": "level or phase label",
      "trade_tag": "trade or null",
      "start_date": "YYYY-MM-DD",
      "duration_days": 5
    }}
  ],
  "confidence": 0.85
}}

Rules:
- Each task must have a name, level_tag, start_date (ISO format), and duration_days (integer ≥ 1).
- trade_tag is optional; use null if not present.
- confidence is a float from 0.0 to 1.0 reflecting how confident you are in the extraction.
- If no tasks are found, return {{"tasks": [], "confidence": 0.0}}.
- Return ONLY the JSON object, no extra text.

Spreadsheet data:
{text}"""


def extract_tasks_from_xlsx(xlsx_bytes: bytes) -> ExtractionResult:
    """
    Parse xlsx bytes, call Claude, and return an ExtractionResult.

    Never raises — all errors are captured in ExtractionResult.error.
    """
    # Guard: missing API key
    if not settings.anthropic_api_key:
        return ExtractionResult(
            tasks=[],
            confidence=0.0,
            error="ANTHROPIC_API_KEY not configured",
        )

    # Step 1: parse xlsx to text
    try:
        text, text_length = _xlsx_to_text(xlsx_bytes)
    except Exception as e:
        return ExtractionResult(tasks=[], confidence=0.0, error=str(e))

    # Step 2: call Claude
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        prompt = _build_prompt(text)
        message = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        response_text = message.content[0].text
    except Exception as e:
        return ExtractionResult(tasks=[], confidence=0.0, error=str(e))

    # Step 3: parse JSON response
    try:
        data = json.loads(response_text)
        raw_tasks = data.get("tasks", [])
        confidence = float(data.get("confidence", 0.0))

        tasks: list[ExtractedTask] = []
        for t in raw_tasks:
            tasks.append(
                ExtractedTask(
                    name=str(t["name"]),
                    level_tag=str(t["level_tag"]),
                    trade_tag=t.get("trade_tag") or None,
                    start_date=str(t["start_date"]),
                    duration_days=int(t["duration_days"]),
                )
            )
        return ExtractionResult(
            tasks=tasks,
            confidence=confidence,
            error=None,
            raw_text_length=text_length,
        )
    except Exception as e:
        return ExtractionResult(
            tasks=[],
            confidence=0.0,
            error=str(e),
            raw_text_length=text_length,
        )

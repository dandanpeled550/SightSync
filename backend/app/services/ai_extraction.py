"""
AI extraction service: parse an xlsx file and call an AI provider to extract tasks.

Provider selection (checked in order):
  1. ANTHROPIC_API_KEY set → use Claude
  2. OPENAI_API_KEY set    → use OpenAI
  3. Neither set           → return error, never raise

Never raises exceptions — all failures are captured in ExtractionResult.error.
"""

import io
import json
import logging
import time
import zipfile
from dataclasses import dataclass, field
from typing import Optional

import openpyxl

from app.config import settings

logger = logging.getLogger(__name__)


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


# Minimal valid styles.xml — replaces invalid styles to bypass openpyxl's colour-pattern
# validation (MatchPattern raises "The string did not match the expected pattern." on
# non-standard ARGB values like 3-char hex or vendor-specific colour codes).
_MINIMAL_STYLES_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
    '<fills count="2">'
    '<fill><patternFill patternType="none"/></fill>'
    '<fill><patternFill patternType="gray125"/></fill>'
    '</fills>'
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
    '</styleSheet>'
)


def _strip_xlsx_styles(xlsx_bytes: bytes) -> bytes:
    """Replace xl/styles.xml with a minimal valid stub so cell values can be read."""
    buf_in = io.BytesIO(xlsx_bytes)
    buf_out = io.BytesIO()
    with zipfile.ZipFile(buf_in, 'r') as zin, \
         zipfile.ZipFile(buf_out, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = _MINIMAL_STYLES_XML.encode() if item.filename == 'xl/styles.xml' \
                   else zin.read(item.filename)
            zout.writestr(item, data)
    return buf_out.getvalue()


def _parse_workbook(wb) -> list[str]:
    """Extract non-empty rows from all sheets as tab-separated strings."""
    out: list[str] = []
    for sheet in wb.worksheets:
        out.append(f"Sheet: {sheet.title}")
        for row in sheet.iter_rows(values_only=True):
            try:
                row_values = [str(cell) if cell is not None else "" for cell in row]
            except Exception:
                continue
            if any(v.strip() for v in row_values):
                out.append("\t".join(row_values))
    wb.close()
    return out


def _xlsx_to_text(xlsx_bytes: bytes) -> tuple[str, int]:
    """Parse xlsx bytes into flat text (max 6000 chars). Returns (text, length)."""
    try:
        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes), data_only=True)
        lines = _parse_workbook(wb)
    except Exception:
        # Fallback: strip xl/styles.xml to bypass colour/style pattern errors.
        # Cell values live in sheet XMLs — styles only affect formatting, not data.
        cleaned = _strip_xlsx_styles(xlsx_bytes)
        wb = openpyxl.load_workbook(io.BytesIO(cleaned), data_only=True)
        lines = _parse_workbook(wb)

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
- Each task must have a name, level_tag, start_date (ISO format), and duration_days (integer >= 1).
- trade_tag is optional; use null if not present.
- confidence is a float from 0.0 to 1.0 reflecting how confident you are in the extraction.
- If no tasks are found, return {{"tasks": [], "confidence": 0.0}}.
- Return ONLY the JSON object, no extra text.

Spreadsheet data:
{text}"""


def _call_anthropic(prompt: str) -> str:
    """Call Claude and return the raw response text. Raises on any error."""
    import anthropic
    logger.debug("AI prompt [anthropic/%s] (%d chars):\n%s", settings.anthropic_model, len(prompt), prompt)
    start = time.perf_counter()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text
    elapsed = int((time.perf_counter() - start) * 1000)
    logger.info("AI call [anthropic/%s] done in %dms — %d chars", settings.anthropic_model, elapsed, len(text))
    logger.debug("AI response:\n%s", text)
    return text


def _call_openai(prompt: str) -> str:
    """Call OpenAI and return the raw response text. Raises on any error."""
    import openai
    logger.debug("AI prompt [openai/%s] (%d chars):\n%s", settings.openai_model, len(prompt), prompt)
    start = time.perf_counter()
    client = openai.OpenAI(api_key=settings.openai_api_key)
    # No response_format param — SDK version differences cause Pydantic validation errors.
    # _strip_fences() handles markdown-wrapped responses as a fallback.
    response = client.chat.completions.create(
        model=settings.openai_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.choices[0].message.content
    elapsed = int((time.perf_counter() - start) * 1000)
    logger.info("AI call [openai/%s] done in %dms — %d chars", settings.openai_model, elapsed, len(text))
    logger.debug("AI response:\n%s", text)
    return text


def _strip_fences(text: str) -> str:
    """Strip markdown code fences if present (e.g. ```json ... ```)."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove first line (```json or ```) and last line (```)
        inner = lines[1:] if len(lines) > 1 else lines
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        text = "\n".join(inner).strip()
    return text


def _parse_response(response_text: str, text_length: int) -> ExtractionResult:
    """Parse the JSON response from any provider into an ExtractionResult."""
    data = json.loads(_strip_fences(response_text))
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


def extract_tasks_from_xlsx(xlsx_bytes: bytes) -> ExtractionResult:
    """
    Parse xlsx bytes, call the available AI provider, and return an ExtractionResult.

    Provider priority: Anthropic (Claude) > OpenAI (GPT).
    Never raises — all errors are captured in ExtractionResult.error.
    """
    # Detect provider
    use_anthropic = bool(settings.anthropic_api_key)
    use_openai = bool(settings.openai_api_key)

    if not use_anthropic and not use_openai:
        return ExtractionResult(
            tasks=[],
            confidence=0.0,
            error="No AI API key configured — set ANTHROPIC_API_KEY or OPENAI_API_KEY",
        )

    # Parse xlsx to text
    try:
        text, text_length = _xlsx_to_text(xlsx_bytes)
    except Exception as e:
        return ExtractionResult(tasks=[], confidence=0.0, error=str(e))

    # Call provider (Claude takes priority if both keys are present)
    prompt = _build_prompt(text)
    try:
        if use_anthropic:
            response_text = _call_anthropic(prompt)
        else:
            response_text = _call_openai(prompt)
    except Exception as e:
        return ExtractionResult(tasks=[], confidence=0.0, error=str(e), raw_text_length=text_length)

    # Parse JSON response
    try:
        return _parse_response(response_text, text_length)
    except Exception as e:
        return ExtractionResult(tasks=[], confidence=0.0, error=str(e), raw_text_length=text_length)

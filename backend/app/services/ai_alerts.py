"""
AI learning-alerts service.

Analyzes historical not_done TaskLogEntry patterns across DailyLogs and
generates proactive risk alerts / reminders for upcoming tasks using Claude.

Never raises — always returns [] on any failure or missing API key.
"""
from __future__ import annotations

import datetime
import json
import logging
import time
from collections import defaultdict
from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_MIN_DELAYS = 3
_LOOKAHEAD_DAYS = 14
_MAX_RETRIES = 4
_BASE_BACKOFF = 5.0
_SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}

_PROMPT_TEMPLATE = """\
You are a construction project risk analyst for the SightSync field management app.
Analyze the historical delay patterns below and generate proactive alerts and reminders
for upcoming tasks that appear to be at risk based on those patterns.

HISTORICAL DELAY PATTERNS (all-time, this project):
Total delays recorded: {total_delays}
Delays by trade: {delay_by_trade}
Delays by level/floor: {delay_by_level}
Delays by day of week: {day_of_week}
Common delay reasons: {common_reasons}
Weather correlation (conditions,trade,level): {weather_corr}

RECENT DELAYS (last 10, most recent first):
{recent_delays}

UPCOMING TASKS (next {lookahead} days):
{upcoming_tasks}

INSTRUCTIONS:
- Generate 1-5 alerts or reminders for upcoming tasks showing risk signals.
- "risk" = AI-detected pattern risk (trade/level/weather correlation).
- "pattern" = systemic delay pattern spotted across multiple tasks.
- "reminder" = gentle time-based nudge (e.g. crew prep, material delivery).
- Only generate entries supported by clear evidence in the data above.
- affected_task_ids must only contain IDs from the UPCOMING TASKS list.
- If no meaningful patterns exist, return an empty alerts array.

OUTPUT: Respond with ONLY valid JSON — no markdown fences, no prose outside JSON:
{{"alerts": [{{"type": "risk|pattern|reminder", "severity": "high|medium|low", \
"title": "Short title max 8 words", \
"message": "2-3 sentence explanation citing specific pattern evidence.", \
"affected_task_ids": [123], \
"recommendation": "One concrete action the manager should take."}}]}}\
"""


def _is_rate_limit(exc: Exception) -> bool:
    name = type(exc).__name__
    msg = str(exc)
    return "RateLimitError" in name or "rate_limit" in msg.lower() or "429" in msg


def _retry_delay(exc: Exception, attempt: int) -> float:
    import re
    m = re.search(r"try again in\s+([\d.]+)s", str(exc), re.IGNORECASE)
    if m:
        return float(m.group(1)) + 1.0
    return _BASE_BACKOFF * (2 ** attempt)


def _call_claude(prompt: str) -> str:
    """Call Claude directly (no prefill). Raises on failure."""
    import anthropic
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    for attempt in range(_MAX_RETRIES + 1):
        try:
            msg = client.messages.create(
                model=settings.anthropic_model,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text
        except Exception as exc:
            if _is_rate_limit(exc) and attempt < _MAX_RETRIES:
                time.sleep(_retry_delay(exc, attempt))
                continue
            raise


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        inner = lines[1:] if len(lines) > 1 else lines
        if inner and inner[-1].strip().startswith("```"):
            inner = inner[:-1]
        return "\n".join(inner).strip()
    return raw


def generate_alerts(project_id: int, db: "Session") -> list[dict]:
    """
    Return alert dicts matching AlertOut schema.
    Returns [] on any error, missing key, or insufficient history.
    """
    from app.models import DailyLog, Task, TaskLogEntry

    if not settings.anthropic_api_key:
        logger.info("ai_alerts: no ANTHROPIC_API_KEY — returning []")
        return []

    try:
        today = datetime.date.today()
        lookahead_end = today + datetime.timedelta(days=_LOOKAHEAD_DAYS)

        not_done_rows = (
            db.query(TaskLogEntry, DailyLog, Task)
            .join(DailyLog, TaskLogEntry.daily_log_id == DailyLog.id)
            .join(Task, TaskLogEntry.task_id == Task.id)
            .filter(
                DailyLog.project_id == project_id,
                TaskLogEntry.action == "not_done",
            )
            .order_by(DailyLog.date.asc())
            .all()
        )

        if len(not_done_rows) < _MIN_DELAYS:
            logger.info("ai_alerts: %d delay entries — below threshold, skipping", len(not_done_rows))
            return []

        upcoming_tasks = (
            db.query(Task)
            .filter(
                Task.project_id == project_id,
                Task.start_date >= today,
                Task.start_date <= lookahead_end,
                Task.status != "done",
            )
            .order_by(Task.start_date.asc())
            .all()
        )

        if not upcoming_tasks:
            return []

        delay_by_trade: dict = defaultdict(int)
        delay_by_level: dict = defaultdict(int)
        day_of_week: dict = defaultdict(int)
        weather_corr: list[str] = []
        common_reasons: list[str] = []
        recent_lines: list[str] = []

        for entry, log, task in not_done_rows:
            t_tag = task.trade_tag or "Unknown"
            l_tag = task.level_tag or "Unknown"
            delay_by_trade[t_tag] += 1
            delay_by_level[l_tag] += 1
            day_of_week[log.date.strftime("%A")] += 1
            if log.weather_conditions:
                weather_corr.append(f"{log.weather_conditions},{t_tag},{l_tag}")
            if entry.reason and entry.reason not in common_reasons:
                common_reasons.append(entry.reason)
            recent_lines.append(
                f"{log.date} | TASK: {task.name} | TRADE: {t_tag} | "
                f"LEVEL: {l_tag} | REASON: {entry.reason or 'none'} | "
                f"SHIFTED TO: {entry.new_date}"
            )

        recent_10 = "\n".join(reversed(recent_lines[-10:]))
        upcoming_json = json.dumps(
            [
                {
                    "id": t.id,
                    "name": t.name,
                    "trade_tag": t.trade_tag,
                    "level_tag": t.level_tag,
                    "start_date": t.start_date.isoformat(),
                }
                for t in upcoming_tasks
            ],
            indent=2,
        )

        prompt = _PROMPT_TEMPLATE.format(
            total_delays=len(not_done_rows),
            delay_by_trade=json.dumps(dict(delay_by_trade), indent=2),
            delay_by_level=json.dumps(dict(delay_by_level), indent=2),
            day_of_week=json.dumps(dict(day_of_week), indent=2),
            common_reasons="; ".join(common_reasons[:10]) or "none",
            weather_corr="; ".join(weather_corr[:20]) or "none",
            recent_delays=recent_10,
            lookahead=_LOOKAHEAD_DAYS,
            upcoming_tasks=upcoming_json,
        )

        raw = _call_claude(prompt)
        raw = _strip_fences(raw)
        data = json.loads(raw)
        alerts = data.get("alerts", [])

        valid_ids = {t.id for t in upcoming_tasks}
        result: list[dict] = []
        for i, a in enumerate(alerts):
            if not isinstance(a, dict):
                continue
            affected = [tid for tid in a.get("affected_task_ids", []) if tid in valid_ids]
            result.append(
                {
                    "id": f"alert_{i}",
                    "type": a.get("type", "risk"),
                    "severity": a.get("severity", "medium"),
                    "title": str(a.get("title", "")),
                    "message": str(a.get("message", "")),
                    "affected_task_ids": affected,
                    "recommendation": str(a.get("recommendation", "")),
                }
            )

        result.sort(key=lambda x: _SEVERITY_ORDER.get(x["severity"], 99))
        return result

    except Exception as exc:
        logger.warning("ai_alerts: generate_alerts failed gracefully: %s", exc)
        return []

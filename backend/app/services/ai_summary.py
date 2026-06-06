from __future__ import annotations

import datetime
import pathlib

from sqlalchemy.orm import Session

from app.models import DailyLog, CrewAttendance, SafetyIncident, MaterialEntry, TaskLogEntry
from app.config import settings

_PROMPT_PATH = pathlib.Path(__file__).parent / "prompts" / "daily_summary.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8")

_HISTORY_DAYS = 7


def _build_today_section(log_id: int, log: DailyLog, db: Session) -> str:
    lines: list[str] = []
    lines.append(f"Date: {log.date}")

    if log.weather_conditions:
        lines.append(
            f"Weather: {log.weather_conditions}, temp {log.weather_temp_min}–{log.weather_temp_max}°C, "
            f"precipitation {log.weather_precipitation}mm, wind {log.weather_wind_speed} km/h"
        )

    attendances = db.query(CrewAttendance).filter(CrewAttendance.daily_log_id == log_id).all()
    present = [a for a in attendances if a.status == "present"]
    absent = [a for a in attendances if a.status == "absent"]
    partial = [a for a in attendances if a.status == "partial"]
    if attendances:
        lines.append(f"Crew: {len(present)} present, {len(absent)} absent, {len(partial)} partial")
        for a in absent:
            note_str = f" (note: {a.note})" if getattr(a, "note", None) else ""
            lines.append(f"  - Absent member id={a.crew_member_id}{note_str}")

    entries = db.query(TaskLogEntry).filter(TaskLogEntry.daily_log_id == log_id).all()
    done_tasks = [e for e in entries if e.action == "done"]
    not_done_tasks = [e for e in entries if e.action == "not_done"]
    if entries:
        lines.append(f"Tasks completed: {len(done_tasks)}, delayed: {len(not_done_tasks)}")
        for e in not_done_tasks:
            reason_str = f" (reason: {e.reason})" if e.reason else ""
            new_date_str = f" → rescheduled to {e.new_date}" if e.new_date else ""
            lines.append(f"  - Delayed task id={e.task_id}{reason_str}{new_date_str}")

    materials = db.query(MaterialEntry).filter(MaterialEntry.daily_log_id == log_id).all()
    if materials:
        lines.append(f"Materials used: {len(materials)} entries")
        for m in materials:
            lines.append(f"  - {m.material_name}: {m.quantity} {m.unit}")

    incidents = db.query(SafetyIncident).filter(SafetyIncident.daily_log_id == log_id).all()
    if incidents:
        lines.append(f"Safety incidents: {len(incidents)}")
        for i in incidents:
            detail = f"  - {i.incident_type}: {i.description}"
            if i.people_involved:
                detail += f"; people involved: {i.people_involved}"
            if i.corrective_action:
                detail += f"; corrective action: {i.corrective_action}"
            lines.append(detail)

    return "\n".join(lines)


def _build_history_section(log: DailyLog, db: Session) -> str:
    cutoff = log.date - datetime.timedelta(days=_HISTORY_DAYS)
    prior_logs = (
        db.query(DailyLog)
        .filter(
            DailyLog.project_id == log.project_id,
            DailyLog.date > cutoff,
            DailyLog.date < log.date,
            DailyLog.submitted == True,  # noqa: E712
        )
        .order_by(DailyLog.date.asc())
        .all()
    )

    if not prior_logs:
        return "(No prior submitted logs available for the past 7 days.)"

    lines: list[str] = []
    for prior in prior_logs:
        summary_text = prior.ai_summary if prior.ai_summary else "[no summary]"
        lines.append(f"[{prior.date}]: {summary_text}")
    return "\n".join(lines)


def generate_and_store_summary(log_id: int, db: Session) -> None:
    """Called from BackgroundTasks. Fetches full log + 7-day history, calls GPT-4o, stores result."""
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        return

    api_key = settings.openai_api_key
    if not api_key:
        log.ai_summary = "[Summary generation failed: no API key configured]"
        db.commit()
        return

    try:
        history_section = _build_history_section(log, db)
        today_section = _build_today_section(log_id, log, db)

        user_message = (
            "HISTORICAL SUMMARIES (past 7 days, oldest first):\n"
            f"{history_section}\n\n"
            "TODAY'S REPORT:\n"
            f"{today_section}"
        )

        import openai
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=settings.openai_model,
            max_tokens=300,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )
        summary = response.choices[0].message.content.strip()
        log.ai_summary = summary

    except Exception as exc:
        log.ai_summary = f"[Summary generation failed: {exc}]"

    db.commit()

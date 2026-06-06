from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import DailyLog, CrewAttendance, SafetyIncident, MaterialEntry, TaskLogEntry
from app.config import settings


def generate_and_store_summary(log_id: int, db: Session) -> None:
    """Called from BackgroundTasks. Fetches full log data, calls Claude, stores result."""
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        return

    api_key = settings.anthropic_api_key

    if not api_key:
        log.ai_summary = "[Summary generation failed: no API key configured]"
        db.commit()
        return

    try:
        # Build a structured context string from the log data
        lines = []
        lines.append(f"Date: {log.date}")

        # Weather
        if log.weather_conditions:
            lines.append(
                f"Weather: {log.weather_conditions}, temp {log.weather_temp_min}–{log.weather_temp_max}°C, "
                f"precipitation {log.weather_precipitation}mm, wind {log.weather_wind_speed} km/h"
            )

        # Crew attendance
        attendances = db.query(CrewAttendance).filter(CrewAttendance.daily_log_id == log_id).all()
        present = [a for a in attendances if a.status == "present"]
        absent = [a for a in attendances if a.status == "absent"]
        partial = [a for a in attendances if a.status == "partial"]
        if attendances:
            lines.append(f"Crew: {len(present)} present, {len(absent)} absent, {len(partial)} partial")

        # Task log entries
        entries = db.query(TaskLogEntry).filter(TaskLogEntry.daily_log_id == log_id).all()
        done_tasks = [e for e in entries if e.action == "done"]
        not_done_tasks = [e for e in entries if e.action == "not_done"]
        if entries:
            lines.append(f"Tasks completed: {len(done_tasks)}, delayed: {len(not_done_tasks)}")
            for e in not_done_tasks:
                reason_str = f" (reason: {e.reason})" if e.reason else ""
                new_date_str = f" → rescheduled to {e.new_date}" if e.new_date else ""
                lines.append(f"  - Delayed task id={e.task_id}{reason_str}{new_date_str}")

        # Materials
        materials = db.query(MaterialEntry).filter(MaterialEntry.daily_log_id == log_id).all()
        if materials:
            lines.append(f"Materials used: {len(materials)} entries")
            for m in materials:
                lines.append(f"  - {m.material_name}: {m.quantity} {m.unit}")

        # Safety incidents
        incidents = db.query(SafetyIncident).filter(SafetyIncident.daily_log_id == log_id).all()
        if incidents:
            lines.append(f"Safety incidents: {len(incidents)}")
            for i in incidents:
                lines.append(f"  - {i.incident_type}: {i.description}")

        context = "\n".join(lines)

        prompt = (
            "You are a construction site foreman writing a daily log summary. "
            "Based on the following field data, write a clear, professional 3–5 sentence summary "
            "of today's site activities, progress, and any issues that occurred.\n\n"
            f"Field data:\n{context}\n\n"
            "Write only the summary paragraph, no headers or labels."
        )

        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        summary = message.content[0].text.strip()
        log.ai_summary = summary

    except Exception as exc:
        log.ai_summary = f"[Summary generation failed: {exc}]"

    db.commit()

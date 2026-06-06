from __future__ import annotations

import io
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_LEFT, TA_CENTER  # noqa: F401

from app.models import DailyLog, Project, CrewAttendance, CrewMember, SafetyIncident, MaterialEntry, TaskLogEntry, Task


def generate_daily_log_pdf(log_id: int, db: Session) -> bytes:
    """Generate a PDF report for the given daily log. Returns raw PDF bytes."""
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise ValueError(f"Log {log_id} not found")

    project = db.query(Project).filter(Project.id == log.project_id).first()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=18, spaceAfter=6)
    heading_style = ParagraphStyle(
        "heading",
        parent=styles["Heading2"],
        fontSize=13,
        spaceAfter=4,
        spaceBefore=12,
        textColor=colors.HexColor("#2563eb"),
    )
    body_style = styles["Normal"]
    muted_style = ParagraphStyle(
        "muted", parent=styles["Normal"], textColor=colors.HexColor("#667085"), fontSize=10
    )

    story = []

    # Header
    project_name = project.name if project else "Unknown Project"
    story.append(Paragraph(f"Daily Log Report — {project_name}", title_style))
    story.append(Paragraph(f"Date: {log.date}", muted_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e8edf5")))
    story.append(Spacer(1, 8 * mm))

    # Weather
    story.append(Paragraph("Weather", heading_style))
    if log.weather_conditions:
        weather_data = [
            ["Conditions", log.weather_conditions or "—"],
            [
                "Temp",
                f"{log.weather_temp_min}°C – {log.weather_temp_max}°C"
                if log.weather_temp_min is not None
                else "—",
            ],
            [
                "Precipitation",
                f"{log.weather_precipitation} mm" if log.weather_precipitation is not None else "—",
            ],
            [
                "Wind",
                f"{log.weather_wind_speed} km/h" if log.weather_wind_speed is not None else "—",
            ],
        ]
        t = Table(weather_data, colWidths=[50 * mm, None])
        t.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#667085")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        story.append(t)
    else:
        story.append(Paragraph("No weather data available.", muted_style))
    story.append(Spacer(1, 4 * mm))

    # Crew Attendance
    story.append(Paragraph("Crew Attendance", heading_style))
    attendances = (
        db.query(CrewAttendance, CrewMember)
        .join(CrewMember, CrewAttendance.crew_member_id == CrewMember.id)
        .filter(CrewAttendance.daily_log_id == log_id)
        .all()
    )
    if attendances:
        crew_data = [["Name", "Status", "Note"]]
        for att, member in attendances:
            crew_data.append([member.name, att.status.capitalize(), att.note or ""])
        t = Table(crew_data, colWidths=[70 * mm, 35 * mm, None])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f7faff")),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8edf5")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(t)
    else:
        story.append(Paragraph("No attendance records.", muted_style))
    story.append(Spacer(1, 4 * mm))

    # Tasks Done / Not Done
    story.append(Paragraph("Task Progress", heading_style))
    entries = (
        db.query(TaskLogEntry, Task)
        .join(Task, TaskLogEntry.task_id == Task.id)
        .filter(TaskLogEntry.daily_log_id == log_id)
        .all()
    )
    if entries:
        task_data = [["Task", "Status", "Note"]]
        for entry, task in entries:
            status = "Done" if entry.action == "done" else f"Delayed → {entry.new_date or 'TBD'}"
            note = entry.reason or ""
            task_data.append([task.name, status, note])
        t = Table(task_data, colWidths=[90 * mm, 45 * mm, None])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f7faff")),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8edf5")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(t)
    else:
        story.append(Paragraph("No task entries for today.", muted_style))
    story.append(Spacer(1, 4 * mm))

    # Materials
    story.append(Paragraph("Materials Used", heading_style))
    materials = db.query(MaterialEntry).filter(MaterialEntry.daily_log_id == log_id).all()
    if materials:
        mat_data = [["Material", "Quantity", "Unit", "Notes"]]
        for m in materials:
            mat_data.append([m.material_name, str(m.quantity), m.unit, m.notes or ""])
        t = Table(mat_data, colWidths=[70 * mm, 30 * mm, 30 * mm, None])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f7faff")),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e8edf5")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(t)
    else:
        story.append(Paragraph("No materials recorded.", muted_style))
    story.append(Spacer(1, 4 * mm))

    # Safety Incidents
    story.append(Paragraph("Safety Incidents", heading_style))
    incidents = db.query(SafetyIncident).filter(SafetyIncident.daily_log_id == log_id).all()
    if incidents:
        for inc in incidents:
            story.append(Paragraph(f"<b>{inc.incident_type}</b>: {inc.description}", body_style))
            if inc.corrective_action:
                story.append(Paragraph(f"Corrective action: {inc.corrective_action}", muted_style))
            story.append(Spacer(1, 2 * mm))
    else:
        story.append(Paragraph("No safety incidents.", muted_style))
    story.append(Spacer(1, 4 * mm))

    # AI Summary
    story.append(Paragraph("AI Summary", heading_style))
    if log.ai_summary:
        story.append(Paragraph(log.ai_summary, body_style))
    else:
        story.append(Paragraph("Summary not yet generated.", muted_style))

    doc.build(story)
    return buffer.getvalue()

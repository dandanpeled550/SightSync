from __future__ import annotations

import io
import re
from PIL import Image as PILImage
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfgen import canvas as rl_canvas

from app.models import (
    DailyLog, Project, CrewAttendance, CrewMember,
    SafetyIncident, MaterialEntry, TaskLogEntry, Task, StoredPhoto,
)

# Design tokens
CREAM       = colors.HexColor("#faf8f3")
NAVY        = colors.HexColor("#1c2d5a")
GOLD        = colors.HexColor("#e8b84b")
LIGHT_GRAY  = colors.HexColor("#f5f5f5")
LINE_CLR    = colors.HexColor("#e8edf5")
MUTED_CLR   = colors.HexColor("#667085")
TEXT_CLR    = colors.HexColor("#2d3748")
GREEN_CLR   = colors.HexColor("#139a4b")
GREEN_SOFT  = colors.HexColor("#eaf8ef")
RED_CLR     = colors.HexColor("#ef4444")
RED_SOFT    = colors.HexColor("#fff1f1")
ORANGE_CLR  = colors.HexColor("#f59e0b")
ORANGE_SOFT = colors.HexColor("#fff7e6")

PAGE_W, PAGE_H = A4
L_MAR = R_MAR = 20 * mm
T_MAR = 40 * mm
B_MAR = 20 * mm
CW = PAGE_W - L_MAR - R_MAR


def _make_numbered_canvas(project_name: str, log_date: str, location: str, owner_name: str = "—"):
    """Returns a canvas class that draws branded page header/footer on every page."""

    class _NumberedCanvas(rl_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            rl_canvas.Canvas.__init__(self, *args, **kwargs)
            self._saved_page_states: list[dict] = []

        def showPage(self) -> None:
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self) -> None:
            total = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self._draw_page(total)
                rl_canvas.Canvas.showPage(self)
            rl_canvas.Canvas.save(self)

        def _draw_page(self, total_pages: int) -> None:
            page_num = self._pageNumber

            # Header: project name left, "simple." right
            y_top = PAGE_H - 14 * mm
            self.setFillColor(NAVY)
            self.setFont("Helvetica-Bold", 18)
            self.drawString(L_MAR, y_top, project_name.upper())

            self.setFillColor(colors.black)
            self.setFont("Helvetica-Bold", 18)
            self.drawRightString(PAGE_W - R_MAR, y_top, "simple.")

            # Subtitle
            self.setFillColor(MUTED_CLR)
            self.setFont("Helvetica", 9)
            self.drawString(L_MAR, y_top - 7 * mm, "Daily Construction Report")

            # Gold divider
            self.setStrokeColor(GOLD)
            self.setLineWidth(1.5)
            self.line(L_MAR, y_top - 11 * mm, PAGE_W - R_MAR, y_top - 11 * mm)

            # Meta row
            meta_y = y_top - 19 * mm
            self.setFillColor(TEXT_CLR)
            self.setFont("Helvetica-Bold", 9)
            self.drawString(L_MAR, meta_y, "Project Address:")
            self.setFont("Helvetica", 9)
            addr_off = self.stringWidth("Project Address:  ", "Helvetica-Bold", 9)
            self.drawString(L_MAR + addr_off, meta_y, location or "—")

            mid = PAGE_W / 2 - 20 * mm
            self.setFont("Helvetica-Bold", 9)
            self.drawString(mid, meta_y, "Date:")
            self.setFont("Helvetica", 9)
            date_off = self.stringWidth("Date:  ", "Helvetica-Bold", 9)
            self.drawString(mid + date_off, meta_y, log_date)

            owner_label = "Project Owner: "
            label_w = self.stringWidth(owner_label, "Helvetica-Bold", 9)
            val_w = self.stringWidth(owner_name, "Helvetica", 9)
            start_x = PAGE_W - R_MAR - label_w - val_w
            self.setFont("Helvetica-Bold", 9)
            self.drawString(start_x, meta_y, owner_label)
            self.setFont("Helvetica", 9)
            self.drawString(start_x + label_w, meta_y, owner_name)

            # Footer
            footer_y = 10 * mm
            self.setStrokeColor(LINE_CLR)
            self.setLineWidth(0.5)
            self.line(L_MAR, footer_y + 5 * mm, PAGE_W - R_MAR, footer_y + 5 * mm)
            self.setFillColor(MUTED_CLR)
            self.setFont("Helvetica", 8)
            self.drawString(L_MAR, footer_y, f"{project_name.upper()} • Daily Construction Report")
            self.drawRightString(PAGE_W - R_MAR, footer_y, f"Page {page_num} of {total_pages}")

    return _NumberedCanvas


def _load_photo(photo_url: str | None, db: Session) -> bytes | None:
    """Return raw image bytes from StoredPhoto given a /uploads/photo/{id} URL."""
    if not photo_url:
        return None
    match = re.search(r"/uploads/photo/(\d+)", photo_url)
    if not match:
        return None
    stored = db.get(StoredPhoto, int(match.group(1)))
    return stored.data if stored else None


def _make_rl_image(data: bytes, max_w: float, max_h: float) -> RLImage | None:
    """Scale image to fit within max_w × max_h while preserving aspect ratio."""
    try:
        buf = io.BytesIO(data)
        pil = PILImage.open(buf)
        orig_w, orig_h = pil.size
        scale = min(max_w / orig_w, max_h / orig_h, 1.0)
        return RLImage(io.BytesIO(data), width=orig_w * scale, height=orig_h * scale)
    except Exception:
        return None


def _photo_grid(items: list[tuple[str, RLImage]], col_w: float, caption_ps: ParagraphStyle) -> Table:
    """Lay out (caption, image) pairs in a 2-column grid."""
    rows = []
    for i in range(0, len(items), 2):
        row = []
        for j in range(2):
            if i + j < len(items):
                cap, img = items[i + j]
                cell = Table([[Paragraph(cap, caption_ps)], [img]], colWidths=[col_w])
                cell.setStyle(TableStyle([
                    ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING",    (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                ]))
                row.append(cell)
            else:
                row.append(Spacer(1, 1))
        rows.append(row)
    t = Table(rows, colWidths=[col_w + 4, col_w + 4])
    t.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    return t


def generate_daily_log_pdf(log_id: int, db: Session, owner_name: str = "—") -> bytes:
    log = db.query(DailyLog).filter(DailyLog.id == log_id).first()
    if not log:
        raise ValueError(f"Log {log_id} not found")

    project = db.query(Project).filter(Project.id == log.project_id).first()
    project_name = project.name if project else "Unknown Project"
    location = project.location_city if project else "—"
    log_date = str(log.date)

    # Paragraph style factory
    def _ps(name: str, **kw) -> ParagraphStyle:
        base = dict(fontName="Helvetica", fontSize=10, textColor=TEXT_CLR, leading=14)
        base.update(kw)
        return ParagraphStyle(name, **base)

    heading_ps  = _ps("h",   fontName="Helvetica-Bold", fontSize=12, textColor=NAVY, leading=16)
    italic_ps   = _ps("it",  fontName="Helvetica-Oblique", leading=16)
    muted_ps    = _ps("mu",  fontSize=9, textColor=MUTED_CLR, leading=13)
    th_ps       = _ps("th",  fontName="Helvetica-Bold", fontSize=9, textColor=colors.white)
    td_ps       = _ps("td",  fontSize=9, leading=13)
    gold_hdr_ps = _ps("gh",  fontName="Helvetica-Bold", fontSize=9, textColor=GOLD, leading=13)
    temp_ps     = _ps("tp",  fontName="Helvetica-Bold", fontSize=22, textColor=NAVY,
                      alignment=TA_CENTER, leading=28)
    time_ps     = _ps("ti",  fontSize=8, textColor=MUTED_CLR, alignment=TA_CENTER, leading=11)
    body_ps     = _ps("bo",  leading=15)
    caption_ps  = _ps("cap", fontSize=8, textColor=MUTED_CLR, fontName="Helvetica-Oblique",
                      alignment=TA_CENTER, leading=11)

    BADGE_PS   = {
        "present": _ps("bp",  fontName="Helvetica-Bold", fontSize=8, textColor=GREEN_CLR),
        "absent":  _ps("ba",  fontName="Helvetica-Bold", fontSize=8, textColor=RED_CLR),
        "partial": _ps("bpa", fontName="Helvetica-Bold", fontSize=8, textColor=ORANGE_CLR),
    }
    BADGE_BG   = {"present": GREEN_SOFT,      "absent": RED_SOFT,   "partial": ORANGE_SOFT}
    BADGE_TEXT = {"present": "YES (PRESENT)", "absent": "NO (ABSENT)", "partial": "PARTIAL"}

    def section_heading(title: str) -> Table:
        t = Table([[Spacer(1, 1), Paragraph(title, heading_ps)]], colWidths=[6, CW - 6])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (0, 0), GOLD),
            ("LEFTPADDING",   (0, 0), (0, 0), 0),
            ("RIGHTPADDING",  (0, 0), (0, 0), 0),
            ("LEFTPADDING",   (1, 0), (1, 0), 10),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]))
        return t

    def dts(extra: list | None = None) -> TableStyle:
        """Base data table style: navy header, grid, padding."""
        cmds = [
            ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("GRID",          (0, 0), (-1, -1), 0.25, LINE_CLR),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ]
        if extra:
            cmds.extend(extra)
        return TableStyle(cmds)

    sp = lambda n: Spacer(1, n * mm)
    story = []

    # ── AI SUMMARY ────────────────────────────────────────────────────────────
    story += [section_heading("AI SUMMARY"), sp(4)]
    summary_box = Table([[Paragraph(log.ai_summary or "Summary not yet generated.", italic_ps)]], colWidths=[CW])
    summary_box.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_GRAY),
        ("TOPPADDING",    (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING",   (0, 0), (-1, -1), 16),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 16),
        ("BOX",           (0, 0), (-1, -1), 0.5, LINE_CLR),
    ]))
    story += [summary_box, sp(6)]

    # ── WEATHER CONDITIONS ────────────────────────────────────────────────────
    story += [section_heading("WEATHER CONDITIONS"), sp(4)]
    if log.weather_temp_min is not None and log.weather_temp_max is not None:
        cond  = log.weather_conditions or "—"
        col_w = CW / 3

        precip_str = f"{log.weather_precipitation} mm" if log.weather_precipitation is not None else "—"
        wind_str   = f"{log.weather_wind_speed} km/h" if log.weather_wind_speed is not None else "—"

        def wx_cell(label: str, main_value: str, sub_value: str) -> Table:
            main_ps = _ps("wm", fontName="Helvetica-Bold", fontSize=22, textColor=NAVY,
                          alignment=TA_CENTER, leading=28)
            cell = Table(
                [[Paragraph(label, time_ps)],
                 [Paragraph(main_value, main_ps)],
                 [Paragraph(sub_value, time_ps)]],
                colWidths=[col_w - 2 * mm],
            )
            cell.setStyle(TableStyle([
                ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING",    (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING",   (0, 0), (-1, -1), 2),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 2),
            ]))
            return cell

        wx_tbl = Table(
            [[wx_cell("Daily Low",  f"{int(log.weather_temp_min)}°C", cond),
              wx_cell("Daily High", f"{int(log.weather_temp_max)}°C", cond),
              wx_cell("Wind & Rain", wind_str, precip_str)]],
            colWidths=[col_w, col_w, col_w],
        )
        wx_tbl.setStyle(TableStyle([
            ("GRID",          (0, 0), (-1, -1), 0.5, LINE_CLR),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(wx_tbl)
    else:
        story.append(Paragraph("No weather data available.", muted_ps))
    story.append(sp(6))

    # ── TASK SUMMARY ──────────────────────────────────────────────────────────
    story += [section_heading("TASK SUMMARY"), sp(4)]
    entries = (
        db.query(TaskLogEntry, Task)
        .join(Task, TaskLogEntry.task_id == Task.id)
        .filter(TaskLogEntry.daily_log_id == log_id)
        .all()
    )
    if entries:
        rows = [[Paragraph("NAME", th_ps), Paragraph("DESCRIPTION", th_ps), Paragraph("STATUS", th_ps)]]
        for e, task in entries:
            status = "Done" if e.action == "done" else f"Delayed → {e.new_date or 'TBD'}"
            rows.append([Paragraph(task.name, td_ps), Paragraph(e.reason or "—", td_ps), Paragraph(status, td_ps)])
        t = Table(rows, colWidths=[55 * mm, None, 42 * mm])
        t.setStyle(dts())
        story.append(t)

        # Photos for completed tasks
        img_col_w = (CW - 8) / 2
        task_photos: list[tuple[str, RLImage]] = []
        for e, task in entries:
            if e.action == "done" and e.photo_url:
                data = _load_photo(e.photo_url, db)
                if data:
                    img = _make_rl_image(data, img_col_w, 60 * mm)
                    if img:
                        task_photos.append((task.name, img))
        if task_photos:
            story += [sp(3), Paragraph("Task Photos", muted_ps),
                      sp(2), _photo_grid(task_photos, img_col_w, caption_ps)]
    else:
        story.append(Paragraph("No task entries recorded today.", muted_ps))
    story.append(sp(6))

    # ── CREW ATTENDANCE SUMMARY ───────────────────────────────────────────────
    story += [section_heading("CREW ATTENDANCE SUMMARY"), sp(4)]
    attendances = (
        db.query(CrewAttendance, CrewMember)
        .join(CrewMember, CrewAttendance.crew_member_id == CrewMember.id)
        .filter(CrewAttendance.daily_log_id == log_id)
        .all()
    )
    if attendances:
        rows = [[Paragraph("CREW MEMBER NAME", th_ps), Paragraph("ATTENDED?", th_ps)]]
        badge_cmds = []
        for i, (att, member) in enumerate(attendances, 1):
            key = att.status if att.status in BADGE_PS else "absent"
            rows.append([Paragraph(member.name, td_ps), Paragraph(BADGE_TEXT[key], BADGE_PS[key])])
            badge_cmds.append(("BACKGROUND", (1, i), (1, i), BADGE_BG[key]))
        t = Table(rows, colWidths=[None, 55 * mm])
        t.setStyle(dts(badge_cmds))
        story.append(t)
    else:
        story.append(Paragraph("No attendance records.", muted_ps))
    story.append(sp(6))

    # ── MATERIALS USED ────────────────────────────────────────────────────────
    story += [section_heading("MATERIALS USED"), sp(4)]
    materials = db.query(MaterialEntry).filter(MaterialEntry.daily_log_id == log_id).all()
    if materials:
        rows = [[Paragraph("MATERIAL DESCRIPTION", th_ps), Paragraph("QUANTITY USED", th_ps),
                 Paragraph("UNIT", th_ps), Paragraph("STATUS / NOTES", th_ps)]]
        for m in materials:
            rows.append([Paragraph(m.material_name, td_ps), Paragraph(str(m.quantity), td_ps),
                         Paragraph(m.unit or "—", td_ps), Paragraph(m.notes or "—", td_ps)])
        t = Table(rows, colWidths=[None, 32 * mm, 28 * mm, 50 * mm])
        t.setStyle(dts())
        story.append(t)
    else:
        story.append(Paragraph("No materials recorded.", muted_ps))
    story.append(sp(6))

    # ── SAFETY INCIDENT REPORTS ───────────────────────────────────────────────
    story += [section_heading("SAFETY INCIDENT REPORTS"), sp(4)]
    incidents = db.query(SafetyIncident).filter(SafetyIncident.daily_log_id == log_id).all()

    safety_rows: list[list] = [[Paragraph("INCIDENT LOG SUMMARY", gold_hdr_ps)]]
    safety_inner_w = CW - 32  # inner table width after box padding
    safety_img_col_w = (safety_inner_w - 8) / 2
    if incidents:
        for inc in incidents:
            desc = f"<b>Status:</b> {inc.incident_type}"
            if inc.description:
                desc += f" — {inc.description}"
            safety_rows.append([Paragraph(desc, body_ps)])
            if inc.corrective_action:
                safety_rows.append([Paragraph(f"Corrective Action: {inc.corrective_action}", muted_ps)])
            # Photo attached to this incident
            if inc.photo_url:
                data = _load_photo(inc.photo_url, db)
                if data:
                    img = _make_rl_image(data, safety_img_col_w, 60 * mm)
                    if img:
                        safety_rows.append([_photo_grid(
                            [(inc.incident_type or "Photo", img)], safety_img_col_w, caption_ps
                        )])
    else:
        safety_rows.append([Paragraph(
            "<b>Status:</b> No injuries or safety compliance violations reported today.", body_ps
        )])

    safety_inner = Table(safety_rows, colWidths=[CW - 32])
    safety_inner.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
    ]))
    safety_box = Table([[safety_inner]], colWidths=[CW])
    safety_box.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_GRAY),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",   (0, 0), (-1, -1), 16),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 16),
        ("BOX",           (0, 0), (-1, -1), 0.5, LINE_CLR),
    ]))
    story.append(safety_box)

    # ── Build ─────────────────────────────────────────────────────────────────
    def _draw_background(canvas, doc):
        # Must run before flowables so background sits beneath content in the stream
        canvas.saveState()
        canvas.setFillColor(CREAM)
        canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
        canvas.restoreState()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=R_MAR,
        leftMargin=L_MAR,
        topMargin=T_MAR,
        bottomMargin=B_MAR,
    )
    doc.build(
        story,
        onFirstPage=_draw_background,
        onLaterPages=_draw_background,
        canvasmaker=_make_numbered_canvas(project_name, log_date, location, owner_name),
    )
    return buffer.getvalue()

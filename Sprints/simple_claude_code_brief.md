# simple. — Claude Code Build Brief · Sprint 1

## Context

The environment is already set up. Do not scaffold a new project or install a base framework — work within what exists. Pick whatever stack best fits the tasks below; no constraints are imposed on language, framework, or libraries. Make sensible, boring choices that keep the codebase easy to extend.

---

## Goal for This Sprint

Build a working, testable foundation for the **simple.** construction daily log. The output of this sprint is a functional system where a developer can enter data, see it displayed correctly, and confirm that all four data domains below are wired up end-to-end. No polish, no final UI — just something real that runs.

---

## Features to Build

### 1 — Weather Fetching

The system must fetch real weather data for a given location and date automatically — the user never types weather manually. Pull at minimum: temperature, conditions (e.g. sunny/rain/wind), precipitation, and wind speed. Store the fetched data as part of the daily log record. Pick a free-tier weather API; handle the case where the fetch fails gracefully (log the error, don't crash).

- Location is set per project (lat/long or city is fine for now)
- Fetch triggers when a new daily log entry is created for today's date
- Fetched data is read-only on the log — not editable by the user

---

### 2 — Crew Attendance Tracking

The foreman needs to log who showed up, who was absent, and any notes per person (late, left early, etc.). Crew members belong to a project. For now, crew can be pre-seeded or manually added — no need for a full HR module.

- Each daily log has a crew attendance section
- Per crew member: present / absent / partial, plus an optional short note
- Data must be stored and retrievable per day

---

### 3 — Safety Incident Documentation

The foreman logs any safety incidents or near-misses that occurred during the day. Each incident is its own record attached to the daily log.

- Fields: incident type, description, people involved, corrective action taken
- A day can have zero or multiple incidents
- Photo attachment field should exist in the data model even if upload UI is stubbed for now

---

### 4 — Materials Used Logging

The foreman logs what materials were consumed or used on site that day. Keep it simple — this is a quantity log, not an inventory system.

- Fields: material name, quantity, unit (e.g. bags, m2, tons), notes
- Multiple material entries per daily log
- Photo attachment field in the data model (can be stubbed)

---

## UI — Two Views Only

No design system, no component library, no styling effort. The UI exists purely so a developer can verify the system works. Functional over beautiful — every field visible, every value readable.

### View A — Daily Log Dashboard

Displays all data for today's log in a single readable page.

- Weather block: auto-fetched values displayed as plain text
- Crew block: list of all crew members and their attendance status for the day
- Safety block: list of incidents logged today (or "none" if empty)
- Materials block: list of materials used today with quantities
- A way to navigate to a past date's log

### View B — Data Entry Form

A single page where the developer can manually enter or edit all four data domains for a given date.

- Date selector at the top — defaults to today
- Weather: trigger a manual re-fetch, or show current fetched values
- Crew: toggle each crew member present / absent, add a note
- Safety: add / remove incident entries inline
- Materials: add / remove material line items inline
- One save action that persists everything

---

## Explicitly Out of Scope for This Sprint

- Auth / login — hardcode a single user or project for now
- AI summaries and pattern flagging
- PDF export
- Cascade alerts and schedule dependency logic
- Photo uploads (data model field is enough)
- Any visual polish, branding, or responsive design

---

## Done When

1. Opening the app shows today's daily log with real weather data populated automatically
2. The entry form lets you set crew attendance, add incidents, and add materials — and save
3. Saved data appears correctly on the dashboard view
4. Switching dates shows the correct log for that day
5. No crashes on empty states (no crew, no incidents, no materials logged yet)

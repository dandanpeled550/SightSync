# simple. — Product Requirements Document v2.2

> **Audience:** Development team  
> **Status:** Draft — Pending Technical Review  
> **Primary User:** Site Foreman (single role, Sprint 1)  
> **Infrastructure:** Cloud-deployed backend + database on Render  
> **Key File Input:** Excel schedules (.xlsx) uploaded during onboarding

---

## 1. Product Vision

simple. is a construction project management platform built for site foremen. Its defining idea is that a project plan — uploaded once at the start — becomes a living document that automatically recalculates every time reality diverges from the plan.

Every morning the foreman opens simple. and sees exactly what needs to happen today, derived from the current state of the plan. During the day they mark tasks done or not done. When a task is not done, they input a new target date and record why — the platform then calculates every downstream task that is now affected, shows the foreman the full cascade impact, and waits for confirmation before updating the plan.

Layered on top of the plan is a daily log: weather (fetched automatically once per day), crew attendance (pre-populated from the roster), materials used, and safety incidents. At end of day the foreman submits — AI writes a narrative summary of everything that happened. After 5+ days, AI surfaces patterns the foreman would never spot manually.

The name is a constraint. The foreman is on site, in noise, in glare, with dirty hands. Every interaction must be fast, obvious, and require minimal input.

---

## 2. The Core Product Loop

Everything in the product serves one of these six steps.

| Step | What Happens | Who Acts |
|---|---|---|
| 1. Onboard | Foreman uploads Excel schedule. AI extracts tasks, dependencies, and dates into a structured project plan. Foreman reviews and confirms (or edits) the extracted structure. | Foreman + AI |
| 2. App Open | Daily Log for today is auto-created. Weather is fetched once for the day. Attendance records are pre-populated for the full roster. | Platform |
| 3. Today View | Platform surfaces all tasks scheduled for today, organised by level and trade. Foreman sees what the plan expects. | Platform |
| 4. Mark Tasks | During the day, foreman marks each task Done or Not Done. If Not Done, they input a new target date and select a reason. | Foreman |
| 5. Cascade | For every Not Done task, platform calculates all downstream tasks now affected using the new date as input. Shows foreman the full impact before applying any changes. | Platform + Foreman |
| 6. Submit | End of day: foreman submits the log. AI generates the daily narrative summary. Cascade updates are written to the plan. | Foreman + AI |

---

## 3. Users & Roles

Single role in Sprint 1. Architecture must not block future addition of Project Manager and Site Owner roles.

| Role | Description | Access |
|---|---|---|
| Site Foreman | Physically present on site. Creates and submits all daily logs. Marks all tasks. Confirms all cascade updates. | Full access to all features |

> **Default decision:** Auth and login are stubbed for Sprint 1. A single hardcoded user and project is acceptable to start.

---

## 4. Core Entities & Data Model

Eight entities form the complete data model. Every feature reads from or writes to these.

### 4.1 Project

The root entity. One foreman has one active project at a time. All other entities belong to a project.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | Project name |
| location_lat | Float | Used for automatic weather fetching |
| location_lng | Float | Used for automatic weather fetching |
| start_date | Date | Project start date |
| status | Enum | active / completed / archived |
| original_file | String | Path to the uploaded Excel schedule |

---

### 4.2 Task

The central entity. Tasks are extracted from the uploaded Excel schedule by AI and can be manually edited. Every task must have a start date. The system calculates end_date from start_date + duration_days.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| project_id | FK → Project | |
| name | String | e.g. "Electrical rough-in" |
| level_tag | String | **Required.** Floor/level identifier (e.g. "Level 4", "Roof") |
| trade_tag | String | Optional. Trade category (e.g. "Electrical", "Concrete") |
| start_date | Date | Planned start date. All tasks must have this. |
| duration_days | Integer | Planned duration in working days |
| end_date | Date | Calculated: start_date + duration_days |
| status | Enum | pending / in-progress / done / not-done |
| rescheduled_to | Date | Set when foreman marks not-done and inputs new target date. Becomes the new start_date after cascade is confirmed. |
| source | Enum | ai-extracted / manual |
| notes | Text | Optional foreman notes |

---

### 4.3 Task Dependency

Defines which tasks must complete before another can start (finish-to-start). This is the engine that powers cascade delay calculation.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| predecessor_id | FK → Task | The task that must finish first |
| successor_id | FK → Task | The task blocked until predecessor is done |
| lag_days | Integer | Optional delay between predecessor end and successor start (default 0) |

> **Cascade logic:** When a task is marked Not Done, the foreman provides a new target date. The system uses that date as the task's new start_date and traverses all successor chains recursively to recalculate every affected task's dates. No task ever stays overdue — the plan always reflects current reality after confirmation.

---

### 4.4 Daily Log

**One log per project per day.** Created automatically when the foreman opens the app on a new day. It is the single container for everything that happens on site that day — task marking, attendance, materials, incidents, weather, and the AI summary. The foreman submits it once at end of day.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| project_id | FK → Project | |
| date | Date | Calendar date. **Unique per project** — only one log per project per day. |
| submitted_at | Timestamp | When the foreman submitted at end of day. Null if still in progress. |
| ai_summary | Text | AI-generated narrative, written post-submit |
| weather_id | FK → Weather | Auto-fetched once when the log is first created for the day |

---

### 4.5 Task Log Entry

Records the foreman's action on a specific task for a specific day. Lives inside the Daily Log. This is what feeds the cascade engine.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| task_id | FK → Task | |
| daily_log_id | FK → Daily Log | |
| outcome | Enum | done / not-done |
| new_date | Date | **Required when outcome = not-done.** The foreman's new target date for this task. Drives the entire cascade calculation. |
| reason | Enum | delayed / missing-materials / blocked-by-prior-task / weather / subcontractor-staffing / other |
| notes | Text | Optional foreman notes |
| photos | JSON Array | Array of base64 encoded photo strings |
| cascade_confirmed | Boolean | True if foreman reviewed and confirmed the cascade impact |

---

### 4.6 Weather

Fetched automatically **once** when the Daily Log is created for the day. Represents the weather for the full day at the project location. Read-only — foreman cannot edit it.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| log_id | FK → Daily Log | |
| fetched_at | Timestamp | |
| temperature_c | Float | Degrees Celsius |
| condition | String | e.g. Sunny, Rain, Overcast, Windy |
| precipitation_mm | Float | |
| wind_kph | Float | |
| fetch_status | Enum | success / failed |
| raw_response | JSON | Full API response, stored for debugging |

---

### 4.7 Crew Member & Crew Attendance

Crew members belong to a project roster. One attendance record is auto-created per crew member when the Daily Log is created each day.

**Crew Member**

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| project_id | FK → Project | |
| name | String | |
| role | String | e.g. Electrician, Labourer, Foreman |
| is_one_off | Boolean | True = not on permanent roster |

**Crew Attendance**

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| daily_log_id | FK → Daily Log | |
| crew_member_id | FK → Crew Member | |
| status | Enum | present / absent / partial |
| note | String | Optional (e.g. "left early at 2pm") |

---

### 4.8 Safety Incident

Write-once records attached to a daily log. No lifecycle or follow-up — incidents are permanent log entries only.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| daily_log_id | FK → Daily Log | |
| incident_type | Enum | near-miss / injury / property-damage / JHA / toolbox-talk |
| description | Text | |
| people_involved | String | Free text |
| corrective_action | Text | |
| photo | String (base64) | Stored in DB |

---

### 4.9 Material & Material Entry

Project-level materials catalogue plus daily consumption entries. New materials typed during a log are saved to the catalogue automatically.

**Material**

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| project_id | FK → Project | |
| name | String | e.g. "Concrete (Ready-Mix)" |
| default_unit | String | e.g. m3, bags, tons |

**Material Entry**

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| daily_log_id | FK → Daily Log | |
| material_id | FK → Material | |
| quantity | Float | |
| unit | String | Can differ from default_unit |
| note | String | Optional, e.g. "short by 2 tons" |
| photo | String (base64) | Stored in DB |

---

## 5. Entity Relationships

All relationships enforced at the database level.

| From | To | Type | Rule |
|---|---|---|---|
| Project | Task | One-to-Many | All tasks belong to one project |
| Project | Daily Log | One-to-Many | All logs belong to one project |
| Project | Crew Member | One-to-Many | Permanent crew roster per project |
| Project | Material | One-to-Many | Materials catalogue per project |
| Task | Task Dependency | One-to-Many | A task can have many predecessors and successors |
| Task | Task Log Entry | One-to-Many | A task is marked done/not-done across multiple days |
| Daily Log | Task Log Entry | One-to-Many | Many task entries per daily log |
| Daily Log | Weather | One-to-One | One weather snapshot per day, fetched on log creation |
| Daily Log | Crew Attendance | One-to-Many | One record per crew member per log |
| Daily Log | Safety Incident | One-to-Many | Zero or more incidents per log |
| Daily Log | Material Entry | One-to-Many | Zero or more material entries per log |
| Crew Member | Crew Attendance | One-to-Many | Same member tracked across many logs |
| Material | Material Entry | One-to-Many | Same material used across many logs |

---

## 6. What Creates Each Entity

| Entity | Created when... |
|---|---|
| Project | Foreman completes onboarding |
| Task | AI extracts from Excel, or foreman adds manually during review |
| Task Dependency | AI infers from Excel, or foreman draws manually during review |
| Daily Log | Auto-created when foreman opens the app on a new day |
| Weather | Auto-fetched once when the Daily Log is created |
| Crew Attendance | Auto-created for every roster member when the Daily Log is created |
| Task Log Entry | Foreman marks a task Done or Not Done during the day |
| Safety Incident | Foreman manually adds one inside the Daily Log |
| Material Entry | Foreman manually adds one inside the Daily Log |

---

## 7. Feature Specifications

### 7.1 Onboarding — Schedule Upload & AI Extraction

The entry point. Foreman uploads their Excel schedule once. AI produces a structured task list with dependencies that becomes the living project plan.

**Flow:**
- Foreman uploads an Excel file (.xlsx)
- AI parses the file and extracts: task names, level tags, trade tags (if present), start dates, durations, and inferred dependency relationships
- Extracted structure is presented as a reviewable task tree, organised by level
- Foreman can: confirm as-is, edit any task (name, dates, tags, duration), add missing tasks manually, delete incorrectly extracted tasks, draw or correct dependency links
- Once confirmed, the project plan is locked in and the daily task view becomes active

> **Note:** The AI will not always get dependencies right from an Excel file. The review step is mandatory, not optional.  
> **Note:** A foreman with no Excel file must still be able to build the plan manually from scratch using the same review interface.

---

### 7.2 Today View — Daily Task Dashboard

The landing screen. When the foreman opens the app each day, the Daily Log for today is auto-created (if it doesn't already exist), weather is fetched, and attendance records are pre-populated. The view shows all tasks scheduled for today derived from the current live plan.

**Display rules:**
- A task appears if its current `start_date` matches today's date
- Tasks are grouped by `level_tag` as the primary grouping
- Within each level, tasks can be filtered by `trade_tag`
- Each task shows: name, level, trade, planned time window, current status
- Because all not-done tasks are rescheduled via the cascade engine, **there are no overdue tasks** — the today view always reflects the current live plan
- A task marked not-done today disappears from today and reappears on its new confirmed date

**Lookahead / Alerts panel:**
- Secondary panel shows upcoming tasks for the next 7 days
- Alerts surface tasks at risk (e.g. a predecessor was recently rescheduled and the successor may be tight)
- Deliveries and inspections can be tagged on tasks and appear as distinct alert types

---

### 7.3 Task Marking — Done / Not Done

The foreman's primary daily action. For each task, they record the outcome. This is the trigger for the cascade engine.

**Done flow:**
- Foreman taps the task and selects Done
- Task status updates to `done`; Task Log Entry created with `outcome = done`
- No further action required

**Not Done flow:**
- Foreman selects Not Done
- System immediately prompts: **"When will this be done?"** — foreman picks a new date from a date picker
- **The new date is mandatory.** The foreman cannot proceed without setting it.
- System presents reason selector: Delayed / Missing materials / Blocked by prior task / Weather / Subcontractor staffing / Other
- Foreman can add free-text notes and attach photos
- On confirmation, the cascade engine runs using the foreman's new date as input

---

### 7.4 Cascade Delay Engine

The technical heart of the platform. When a task is marked Not Done, the foreman provides a new target date. The engine uses that date to recalculate the entire downstream dependency chain and presents the full impact for confirmation. Once confirmed, the plan updates completely — every affected task has a new valid date. **There are no overdue tasks.**

**How it works:**
- Input: the not-done task's new date (provided by foreman)
- Not-done task's `start_date` is updated to the new date; `end_date` recalculated as `new_date + duration_days`
- For each direct successor: `new start_date = predecessor's new end_date + lag_days`, `new end_date = new start_date + duration_days`
- Traversal continues recursively through all successor chains until no more dependent tasks remain
- Full list of affected tasks, old dates, and new dates compiled into a Cascade Impact Report

**Foreman review flow:**
- Cascade Impact Report shown before any plan changes are saved
- Report shows: total tasks affected, each task's name, old date, new date, days shifted
- Foreman can review task by task or accept all at once
- Foreman confirms → all task dates written to the database
- `cascade_confirmed = true` set on the Task Log Entry
- The not-done task reappears in the Today View on its new confirmed date

> **No overdue state:** Once the foreman confirms the cascade, every task in the plan has a valid future or present date. The concept of "overdue" does not exist in this system — the plan is always current.  
> **Partial confirmation:** Not supported in Sprint 1. Foreman either accepts the full cascade or cancels and adjusts the new date.

---

### 7.5 Weather Fetching

Fetched automatically once when the Daily Log is created on app open. The foreman never enters weather manually.

- Triggered once when the Daily Log is auto-created on app open for a new day
- Uses the project's lat/lng coordinates and today's date
- Fetches: temperature, condition, precipitation, wind speed
- Stored as a Weather record linked to the log
- If fetch fails: log is not blocked; "Weather unavailable" shown; manual re-fetch button available
- Weather data is read-only — foreman cannot edit it

> **AI summaries** must reference weather conditions when describing daily productivity (e.g. "Rain at 14mm likely contributed to the concrete pour delay").

---

### 7.6 Crew Attendance Tracking

Foreman marks attendance for each crew member. The permanent roster is pre-loaded so the foreman only changes exceptions.

- When the Daily Log is auto-created, attendance records auto-created for all roster members, defaulting to `present`
- Foreman toggles status per person: present / absent / partial
- Optional short note per person (e.g. "left at 2pm", "sent home — injury")
- Foreman can add a one-off worker — added to the log only, not the permanent roster

**AI Pattern Flagging (5+ logs):**
- Crew members absent in 3 or more of the last 10 logs are flagged by name
- Days of week with consistently low attendance are surfaced
- Correlation between low crew days and task delays is highlighted

---

### 7.7 Safety Incident Documentation

Write-once incident records attached to a daily log. No review lifecycle.

- Zero or many incidents per log
- Required fields: incident type, description, people involved, corrective action taken
- Optional photo (base64)
- Incident types: near-miss / injury / property-damage / JHA completed / toolbox-talk completed
- Cannot be deleted after log submission; editable only before submission

**AI Pattern Flagging (5+ logs):**
- Recurring incident types surfaced with frequency count
- Correlation between weather conditions and incident rate flagged

---

### 7.8 Materials Used Logging

Foreman logs materials consumed on site during the day. A quantity log only — not inventory management.

- Foreman picks from the project materials catalogue (type-ahead search)
- If material not in catalogue: foreman types it; saved to the catalogue automatically for future use
- Per entry: material, quantity, unit, optional note, optional photo (base64)
- Multiple entries per log; same material can appear more than once

**AI Pattern Flagging (5+ logs):**
- Materials frequently noted as short or insufficient are flagged
- Consumption spikes vs. rolling average surfaced

---

### 7.9 AI Daily Summary & Pattern Analysis

After a log is submitted, AI writes a structured narrative covering everything that happened.

**Summary contents:**
- Weather context and its effect on the day
- Tasks completed and tasks not completed (with reasons)
- Crew count and any notable absences
- Materials received and used
- Safety incidents (or confirmation of none)
- Cascade impact summary if any task was marked not done

**Generation behaviour:**
- Runs automatically post-submit, asynchronously — foreman does not wait
- Also triggerable on-demand via "Regenerate" button
- Loading state shown on log view until summary is ready
- Pattern section appended when 5+ logs exist for the project

---

### 7.10 PDF Export

Any submitted daily log can be exported as a professional PDF report.

**Contents:** project name, date, weather, crew summary, tasks done/not done, materials, safety incidents, AI narrative, attached photos.

- Export triggered by foreman from the log view
- PDF generated server-side and downloaded

---

## 8. Application Screens

Ten screens are defined in the product mockup.

| Screen | Name | Description |
|---|---|---|
| 1 | Onboarding — Upload | Entry point. Foreman uploads Excel schedule. Single Upload button. |
| 2 | Review Extracted Structure | AI-organised task tree shown for foreman review. Grouped by level. Foreman confirms, edits, or adds tasks. "Looks good" CTA to proceed. |
| 3 | Plans & Deliveries | Weekly / Monthly / Schedule toggle. All tasks across the week with dates, times, and type tags (Inspect, Delivery, Concrete, etc.). |
| 4 | Daily Log Dashboard — Today | Today's task list with done/not-done marking. Weather shown top right. Auto-created on app open. Foreman works here throughout the day. |
| 5 | Task Detail — Mark Not Done | Expanded task view. Done / Not Done toggle. New date picker (mandatory if Not Done). Reason selector. Notes field. Photo attachment. |
| 6 | Filters / Site Tree | Left panel. Building diagram with level indicators. Level and trade filter chips. Apply filters CTA. |
| 7 | Alerts / Lookahead | Tomorrow and This Week alert panels. Upcoming tasks at risk. Past alerts tab. |
| 8 | Daily Report Draft | End-of-day summary card: weather, crew count, tasks done, tasks not done, materials received, photos added. Generate report CTA triggers AI summary. |
| 9 | AI Summary Preview | Full AI-written narrative. Draft badge. "Use in report" CTA to include in PDF export. |
| 10 | Export Report / PDF | Final report view. Download PDF and Share CTAs. Includes all sections and photo thumbnails. |

---

## 9. Default Decisions & Constraints

| Decision | Default | Rationale |
|---|---|---|
| Schedule file format | Excel (.xlsx) only | Most common on construction sites; other formats deferred |
| Task date model | Start date + duration → end date calculated | All tasks must have a start date; system derives end date |
| Task grouping | Level tag (required) + Trade tag (optional) | Matches real site structure; both are filterable |
| Cascade trigger | Foreman inputs new date when marking not-done | New date is the engine input; no date = cannot proceed |
| Cascade confirmation | Foreman must confirm before plan updates | Prevents accidental plan corruption |
| Cascade scope | Full chain, no partial confirmation | Simplest correct behaviour for Sprint 1 |
| Overdue tasks | Do not exist | Every not-done task gets a new date; plan is always current |
| Logs per day | One per project per day | No shift division; the daily log covers the full day |
| Weather | Fetched once on app open for the day | One weather snapshot per day, tied to the log |
| Crew roster | Fixed per project + one-off per log | Balances stability with field flexibility |
| Materials catalogue | Pre-seeded + grows on-the-fly | Catalogue improves over time from real usage |
| Safety incident lifecycle | Write-once, no status or follow-up | Keeps the form fast; no review workflow needed |
| Photo storage | Base64 in database | No S3 setup required; migrate later if size becomes an issue |
| Auth / login | Stubbed for Sprint 1 | Single hardcoded user and project acceptable to start |
| AI summary trigger | Auto on submit + on-demand regenerate | Covers both automatic and manual use cases |

---

## 10. Out of Scope — Sprint 1

- Authentication, login, and user management
- Multiple user roles (Project Manager, Site Owner, Subcontractors)
- Non-Excel schedule formats (PDF drawings, MS Project, Primavera)
- Partial cascade confirmation (selective task override)
- Subcontractor and partner notifications
- Predictive schedule recalculation beyond cascade math
- Accept / reject individual AI schedule suggestions
- Morning briefing AI view
- Photo upload UI (data model field exists; upload UI stubbed only)
- Any visual polish, branding, or responsive design beyond functional layout

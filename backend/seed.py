"""Run once to populate a default project, crew members, and sample tasks.

Usage: python seed.py  (from the backend/ directory with .env loaded)
"""
import datetime
import os
import sys

# Ensure app package is importable when run from backend/
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine
from app.models import Base, Project, CrewMember, Task, TaskDependency

Base.metadata.create_all(bind=engine)

db = SessionLocal()

if db.query(Project).filter(Project.id == 1).first():
    print("Default project already exists — checking tasks...")
    # Still try to seed tasks if they don't exist yet
    project_exists = True
else:
    project_exists = False

if not project_exists:
    project = Project(
        id=1,
        name="Downtown Office Build",
        location_city="Tel Aviv",
        latitude=32.0853,
        longitude=34.7818,
    )
    db.add(project)
    db.flush()

    crew = [
        CrewMember(project_id=1, name="Avi Cohen"),
        CrewMember(project_id=1, name="Miri Levi"),
        CrewMember(project_id=1, name="Yossi Mizrahi"),
        CrewMember(project_id=1, name="Dana Shapiro"),
        CrewMember(project_id=1, name="Ron Peretz"),
    ]
    db.add_all(crew)
    db.commit()
    print(f"Seeded project '{project.name}' with {len(crew)} crew members.")

# ── Tasks (idempotent — skip if any tasks exist for project 1) ────────────────
if db.query(Task).filter(Task.project_id == 1).first():
    print("Tasks already seeded — skipping.")
    db.close()
    sys.exit(0)

today = datetime.date.today()


def make_task(name, level_tag, trade_tag, days_offset, duration, status="pending", source="manual", notes=None):
    start = today + datetime.timedelta(days=days_offset)
    return Task(
        project_id=1,
        name=name,
        level_tag=level_tag,
        trade_tag=trade_tag,
        start_date=start,
        duration_days=duration,
        end_date=start + datetime.timedelta(days=duration),
        status=status,
        source=source,
        notes=notes,
    )


tasks = [
    make_task("Excavation & Site Prep",          "Level 1", "Concrete",    -5,  7, status="in_progress"),
    make_task("Pour Foundation Slab",             "Level 1", "Concrete",     2,  5),
    make_task("Steel Frame — Level 4",            "Level 4", "Steel",        8,  10),
    make_task("Electrical Conduit Rough-In L4",   "Level 4", "Electrical",  18,   8),
    make_task("Plumbing Rough-In L4",             "Level 4", "Plumbing",    18,   6),
    make_task("Steel Frame — Level 5",            "Level 5", "Steel",       20,  10),
    make_task("Electrical Conduit Rough-In L5",   "Level 5", "Electrical",  30,   8),
    make_task("Roof Waterproofing",               "Roof",    "Concrete",    30,   5),
]

db.add_all(tasks)
db.flush()

# 5 dependency edges
deps = [
    TaskDependency(task_id=tasks[1].id, depends_on_task_id=tasks[0].id, lag_days=0),
    TaskDependency(task_id=tasks[2].id, depends_on_task_id=tasks[1].id, lag_days=1),
    TaskDependency(task_id=tasks[3].id, depends_on_task_id=tasks[2].id, lag_days=0),
    TaskDependency(task_id=tasks[4].id, depends_on_task_id=tasks[2].id, lag_days=0),
    TaskDependency(task_id=tasks[7].id, depends_on_task_id=tasks[5].id, lag_days=2),
]
db.add_all(deps)
db.commit()

print(f"Seeded {len(tasks)} tasks and {len(deps)} dependencies for project 1.")
db.close()

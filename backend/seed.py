"""Run once to populate a default project and crew members.

Usage: python seed.py  (from the backend/ directory with .env loaded)
"""
import os
import sys

# Ensure app package is importable when run from backend/
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine
from app.models import Base, Project, CrewMember

Base.metadata.create_all(bind=engine)

db = SessionLocal()

if db.query(Project).filter(Project.id == 1).first():
    print("Default project already exists — skipping seed.")
    db.close()
    sys.exit(0)

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
db.close()

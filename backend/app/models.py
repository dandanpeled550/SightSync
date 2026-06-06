from datetime import datetime as _dt

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Float, Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    id            = Column(Integer, primary_key=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name          = Column(String(255), nullable=False)
    created_at    = Column(DateTime, default=_dt.utcnow)
    projects      = relationship("ProjectMember", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    location_city = Column(String(200), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    daily_logs = relationship("DailyLog", back_populates="project", cascade="all, delete-orphan")
    crew_members = relationship("CrewMember", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("user_id", "project_id", name="uq_user_project"),)
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    role       = Column(String(20), nullable=False, default="member")
    user       = relationship("User", back_populates="projects")
    project    = relationship("Project", back_populates="members")


class DailyLog(Base):
    __tablename__ = "daily_logs"
    __table_args__ = (UniqueConstraint("project_id", "date", name="uq_project_date"),)

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    date = Column(Date, nullable=False)

    weather_temp_max = Column(Float)
    weather_temp_min = Column(Float)
    weather_code = Column(Integer)
    weather_conditions = Column(String(100))
    weather_precipitation = Column(Float)
    weather_wind_speed = Column(Float)
    weather_error = Column(Text)

    submitted = Column(Boolean, default=False, nullable=False, server_default="0")
    ai_summary = Column(Text, nullable=True)

    project = relationship("Project", back_populates="daily_logs")
    crew_attendances = relationship("CrewAttendance", back_populates="daily_log", cascade="all, delete-orphan")
    safety_incidents = relationship("SafetyIncident", back_populates="daily_log", cascade="all, delete-orphan")
    material_entries = relationship("MaterialEntry", back_populates="daily_log", cascade="all, delete-orphan")
    task_log_entries = relationship("TaskLogEntry", back_populates="daily_log", cascade="all, delete-orphan")


class CrewMember(Base):
    __tablename__ = "crew_members"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(200), nullable=False)
    id_number = Column(String(100))
    profession = Column(String(200))
    reason = Column(String(500))

    project = relationship("Project", back_populates="crew_members")
    attendances = relationship("CrewAttendance", back_populates="crew_member", cascade="all, delete-orphan")


class CrewAttendance(Base):
    __tablename__ = "crew_attendances"
    __table_args__ = (UniqueConstraint("daily_log_id", "crew_member_id", name="uq_log_crew"),)

    id = Column(Integer, primary_key=True)
    daily_log_id = Column(Integer, ForeignKey("daily_logs.id"), nullable=False)
    crew_member_id = Column(Integer, ForeignKey("crew_members.id"), nullable=False)
    status = Column(String(20), nullable=False, default="absent")  # present / absent / partial
    note = Column(String(500))

    daily_log = relationship("DailyLog", back_populates="crew_attendances")
    crew_member = relationship("CrewMember", back_populates="attendances")


class SafetyIncident(Base):
    __tablename__ = "safety_incidents"

    id = Column(Integer, primary_key=True)
    daily_log_id = Column(Integer, ForeignKey("daily_logs.id"), nullable=False)
    incident_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    people_involved = Column(Text)
    corrective_action = Column(Text)
    photo_url = Column(String(500))

    daily_log = relationship("DailyLog", back_populates="safety_incidents")


class MaterialEntry(Base):
    __tablename__ = "material_entries"

    id = Column(Integer, primary_key=True)
    daily_log_id = Column(Integer, ForeignKey("daily_logs.id"), nullable=False)
    material_name = Column(String(200), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    notes = Column(Text)
    photo_url = Column(String(500))

    daily_log = relationship("DailyLog", back_populates="material_entries")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String(300), nullable=False)
    description = Column(Text)
    level_tag = Column(String(100), nullable=False)
    trade_tag = Column(String(100))
    start_date = Column(Date, nullable=False)
    duration_days = Column(Integer, nullable=False, default=1)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    source = Column(String(20), nullable=False, default="manual")
    notes = Column(Text)

    project = relationship("Project", back_populates="tasks")
    task_log_entries = relationship("TaskLogEntry", back_populates="task", cascade="all, delete-orphan")


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (UniqueConstraint("task_id", "depends_on_task_id", name="uq_task_dep"),)

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    depends_on_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    lag_days = Column(Integer, nullable=False, default=0)


class TaskLogEntry(Base):
    __tablename__ = "task_log_entries"
    __table_args__ = (UniqueConstraint("daily_log_id", "task_id", name="uq_log_task"),)

    id = Column(Integer, primary_key=True)
    daily_log_id = Column(Integer, ForeignKey("daily_logs.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(20), nullable=False)   # "done" or "not_done"
    new_date = Column(Date, nullable=True)          # required when action == "not_done"
    reason = Column(String(200))

    daily_log = relationship("DailyLog", back_populates="task_log_entries")
    task = relationship("Task", back_populates="task_log_entries")

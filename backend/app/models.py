from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    location_city = Column(String(200), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    daily_logs = relationship("DailyLog", back_populates="project", cascade="all, delete-orphan")
    crew_members = relationship("CrewMember", back_populates="project", cascade="all, delete-orphan")


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

    project = relationship("Project", back_populates="daily_logs")
    crew_attendances = relationship("CrewAttendance", back_populates="daily_log", cascade="all, delete-orphan")
    safety_incidents = relationship("SafetyIncident", back_populates="daily_log", cascade="all, delete-orphan")
    material_entries = relationship("MaterialEntry", back_populates="daily_log", cascade="all, delete-orphan")


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

import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from app.database import Base

class PriorityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class SessionModeEnum(str, enum.Enum):
    WORK = "WORK"
    BREAK = "BREAK"

class TaskCategoryEnum(str, enum.Enum):
    COURSEWORK = "COURSEWORK"
    RESEARCH = "RESEARCH"
    DEVELOPMENT = "DEVELOPMENT"
    CAREER = "CAREER"
    OTHER = "OTHER"

class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    priority = Column(SQLEnum(PriorityEnum), default=PriorityEnum.MEDIUM, nullable=False)
    previous_priority = Column(SQLEnum(PriorityEnum), nullable=True)
    category = Column(SQLEnum(TaskCategoryEnum), default=TaskCategoryEnum.DEVELOPMENT)
    due_date = Column(DateTime, nullable=True)
    is_completed = Column(Boolean, default=False)
    is_top3 = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)

    sessions = relationship("FocusSessionModel", back_populates="task", cascade="all, delete-orphan")

class FocusSessionModel(Base):
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    mode = Column(SQLEnum(SessionModeEnum), default=SessionModeEnum.WORK, nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    notes = Column(Text, nullable=True)

    task = relationship("TaskModel", back_populates="sessions")
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from app.database import Base


class PriorityEnum(str, enum.Enum):
    UNASSIGNED = "UNASSIGNED"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class SessionModeEnum(str, enum.Enum):
    WORK = "WORK"
    BREAK = "BREAK"


class TaskEnrichmentModel(Base):
    __tablename__ = "task_enrichments"

    google_task_id = Column(String, primary_key=True, index=True)
    google_list_id = Column(String, nullable=False, index=True)

    priority = Column(SQLEnum(PriorityEnum), default=PriorityEnum.UNASSIGNED, nullable=False)
    previous_priority = Column(SQLEnum(PriorityEnum), nullable=True)
    is_top3 = Column(Boolean, default=False, nullable=False)

    estimated_minutes = Column(Integer, nullable=True)
    assigned_block_start = Column(DateTime(timezone=True), nullable=True)

    steps = relationship(
        "MicroStepModel",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="MicroStepModel.position",
    )
    sessions = relationship("FocusSessionModel", back_populates="task")


class MicroStepModel(Base):
    __tablename__ = "micro_steps"

    id = Column(Integer, primary_key=True, index=True)
    google_task_id = Column(
        String,
        ForeignKey("task_enrichments.google_task_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String, nullable=False)
    is_done = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0, nullable=False)

    task = relationship("TaskEnrichmentModel", back_populates="steps")


class FocusSessionModel(Base):
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True)
    google_task_id = Column(
        String,
        ForeignKey("task_enrichments.google_task_id", ondelete="SET NULL"),
        nullable=True,
    )
    task_title = Column(String, nullable=True)
    category_name = Column(String, nullable=True)

    duration_minutes = Column(Integer, nullable=False)
    mode = Column(SQLEnum(SessionModeEnum), default=SessionModeEnum.WORK, nullable=False)
    completed_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    notes = Column(Text, nullable=True)

    task = relationship("TaskEnrichmentModel", back_populates="sessions")
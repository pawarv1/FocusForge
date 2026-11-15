from datetime import datetime
from typing import List
from pydantic import BaseModel, ConfigDict, Field
from app.models import PriorityEnum, SessionModeEnum


# -------------------------------------------------------------------
# Micro-Step Schemas (Task Breakdowns)
# -------------------------------------------------------------------

class MicroStepCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    position: int = Field(default=0, ge=0)


class MicroStepUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    is_done: bool | None = None
    position: int | None = Field(default=None, ge=0)


class MicroStepResponse(BaseModel):
    id: int
    google_task_id: str
    title: str
    is_done: bool
    position: int

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# Task Schemas (Merged Google Task + Local Enrichment)
# -------------------------------------------------------------------

class TaskEnrichmentUpdate(BaseModel):
    google_list_id: str | None = None
    priority: PriorityEnum | None = None
    estimated_minutes: int | None = Field(default=None, gt=0)
    assigned_block_start: datetime | None = None


class UnifiedTaskResponse(BaseModel):
    # Live fields sourced from Google Tasks API
    google_task_id: str
    google_list_id: str
    category: str
    title: str
    notes: str | None = None
    due_date: datetime | None = None
    is_completed: bool = False

    # Execution fields sourced from local TaskEnrichmentModel
    priority: PriorityEnum = PriorityEnum.UNASSIGNED
    previous_priority: PriorityEnum | None = None
    is_top3: bool = False
    estimated_minutes: int | None = None
    assigned_block_start: datetime | None = None
    steps: List[MicroStepResponse] = []

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# Focus Session Schemas (Timer, Analytics & Journal)
# -------------------------------------------------------------------

class FocusSessionCreate(BaseModel):
    google_task_id: str | None = None
    task_title: str | None = None
    category_name: str | None = None
    duration_minutes: int = Field(gt=0)
    mode: SessionModeEnum = SessionModeEnum.WORK
    notes: str | None = None


class FocusSessionUpdate(BaseModel):
    notes: str | None = None


class FocusSessionResponse(BaseModel):
    id: int
    google_task_id: str | None = None
    task_title: str | None = None
    category_name: str | None = None
    duration_minutes: int
    mode: SessionModeEnum
    notes: str | None = None
    completed_at: datetime

    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------------
# Analytics Schemas
# -------------------------------------------------------------------

class DailyAnalyticsResponse(BaseModel):
    total_focus_minutes: int
    completed_work_sessions: int
    completed_break_sessions: int


class DailyFocusItem(BaseModel):
    date: str
    day_label: str
    focus_minutes: int
    session_count: int


class WeeklyAnalyticsResponse(BaseModel):
    daily_history: List[DailyFocusItem]
    total_weekly_minutes: int
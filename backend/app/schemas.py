from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.models import PriorityEnum, SessionModeEnum, TaskCategoryEnum

# -------------------------------------------------------------------
# Task Schemas
# -------------------------------------------------------------------

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: TaskCategoryEnum = TaskCategoryEnum.DEVELOPMENT
    priority: PriorityEnum = PriorityEnum.MEDIUM
    previous_priority: Optional[PriorityEnum] = None
    due_date: Optional[datetime] = None
    is_completed: bool = False
    is_top3: bool = False
    is_archived: bool = False

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: TaskCategoryEnum = TaskCategoryEnum.DEVELOPMENT
    priority: Optional[PriorityEnum] = PriorityEnum.MEDIUM
    due_date: Optional[datetime] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[TaskCategoryEnum] = None
    priority: Optional[PriorityEnum] = None
    due_date: Optional[datetime] = None
    is_completed: Optional[bool] = None
    is_top3: Optional[bool] = None
    is_archived: Optional[bool] = None

class TaskResponse(TaskBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# -------------------------------------------------------------------
# Focus Session Schemas
# -------------------------------------------------------------------

class FocusSessionCreate(BaseModel):
    task_id: Optional[int] = None
    duration_minutes: int
    mode: SessionModeEnum = SessionModeEnum.WORK
    notes: Optional[str] = None

class FocusSessionUpdate(BaseModel):
    notes: str | None = None

class FocusSessionResponse(BaseModel):
    id: int
    task_id: Optional[int] = None
    duration_minutes: int
    mode: SessionModeEnum
    notes: Optional[str] = None
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
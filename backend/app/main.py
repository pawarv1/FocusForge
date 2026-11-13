from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import case, func
from datetime import datetime, time, timedelta, date
from icalendar import Calendar
import recurring_ical_events
import requests

from app.config import settings
from app.security import setup_security_middleware
from app.database import Base, engine, get_db
from app.models import TaskModel, PriorityEnum, FocusSessionModel, SessionModeEnum, TaskCategoryEnum
from app.schemas import (
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    FocusSessionCreate,
    FocusSessionResponse,
    DailyAnalyticsResponse,
    WeeklyAnalyticsResponse,
    DailyFocusItem
)
from app.calendar_categories import parse_calendar_event

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

setup_security_middleware(app)

# -------------------------------------------------------------------
# Google Calendar iCal Endpoint
# -------------------------------------------------------------------

@app.get("/api/calendar/today")
def get_today_calendar_events():
    """Fetch and parse live events (including recurring series) for today from Google Calendar."""
    ical_url = settings.GOOGLE_CALENDAR_ICAL_URL
    if not ical_url:
        return []

    try:
        response = requests.get(ical_url, timeout=5)
        response.raise_for_status()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch Google Calendar feed: {str(e)}"
        )

    cal = Calendar.from_ical(response.content)

    # Local day boundaries (timezone-aware) for expanding recurring series
    local_now = datetime.now().astimezone()
    today = local_now.date()
    day_start = datetime.combine(today, time.min, tzinfo=local_now.tzinfo)
    day_end = datetime.combine(today, time.max, tzinfo=local_now.tzinfo)

    todays_components = recurring_ical_events.of(cal).between(day_start, day_end)
    events = []

    for idx, component in enumerate(todays_components):
        dtstart_prop = component.get("dtstart")
        if not dtstart_prop:
            continue

        dtstart = dtstart_prop.dt
        dtend_prop = component.get("dtend")
        dtend = dtend_prop.dt if dtend_prop else None

        raw_summary = str(component.get("summary", "Untitled Event"))
        clean_title, event_category = parse_calendar_event(component, raw_summary)

        if isinstance(dtstart, datetime):
            if dtstart.tzinfo is not None:
                dtstart = dtstart.astimezone()
            if isinstance(dtend, datetime) and dtend.tzinfo is not None:
                dtend = dtend.astimezone()

            start_hour = dtstart.hour + (dtstart.minute / 60.0)
            end_hour = (
                dtend.hour + (dtend.minute / 60.0)
                if isinstance(dtend, datetime)
                else start_hour + 1.0
            )
            start_str = dtstart.strftime("%I:%M %p")
            end_str = dtend.strftime("%I:%M %p") if isinstance(dtend, datetime) else ""
        else:
            # All-day event (date object)
            start_hour = 9.0
            end_hour = 10.0
            start_str = "All Day"
            end_str = ""

        duration = max(end_hour - start_hour, 0.5)
        base_uid = str(component.get("uid", f"evt-{idx}"))

        events.append({
            "id": f"{base_uid}-{today.isoformat()}-{idx}",
            "title": clean_title,
            "startTime": start_str,
            "endTime": end_str,
            "startHour": start_hour,
            "durationHours": duration,
            "category": event_category,
        })

    # Sort chronologically by startHour
    events.sort(key=lambda e: e["startHour"])
    return events

# -------------------------------------------------------------------
# Focus Session & Telemetry Endpoints
# -------------------------------------------------------------------

@app.post("/api/sessions", response_model=FocusSessionResponse, status_code=status.HTTP_201_CREATED)
def log_focus_session(session_in: FocusSessionCreate, db: Session = Depends(get_db)):
    """Log a completed work or break focus session."""

    if session_in.task_id is not None:
        task = db.query(TaskModel).filter(TaskModel.id == session_in.task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Associated task not found")

    new_session = FocusSessionModel(
        task_id=session_in.task_id,
        duration_minutes=session_in.duration_minutes,
        mode=session_in.mode,
        notes=session_in.notes,
        completed_at=datetime.now()
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@app.get("/api/sessions/analytics/today", response_model=DailyAnalyticsResponse)
def get_today_analytics(db: Session = Depends(get_db)):
    """Fetch aggregated focus stats for the current day."""
    today_start = datetime.combine(datetime.now().date(), time.min)
    today_end = datetime.combine(datetime.now().date(), time.max)

    # Query total focus minutes for completed WORK sessions today
    total_minutes = (
        db.query(func.coalesce(func.sum(FocusSessionModel.duration_minutes), 0))
        .filter(
            FocusSessionModel.mode == SessionModeEnum.WORK,
            FocusSessionModel.completed_at >= today_start,
            FocusSessionModel.completed_at <= today_end,
        )
        .scalar()
    )

    # Count completed work sessions today
    work_count = (
        db.query(FocusSessionModel)
        .filter(
            FocusSessionModel.mode == SessionModeEnum.WORK,
            FocusSessionModel.completed_at >= today_start,
            FocusSessionModel.completed_at <= today_end,
        )
        .count()
    )

    # Count completed break sessions today
    break_count = (
        db.query(FocusSessionModel)
        .filter(
            FocusSessionModel.mode == SessionModeEnum.BREAK,
            FocusSessionModel.completed_at >= today_start,
            FocusSessionModel.completed_at <= today_end,
        )
        .count()
    )

    return DailyAnalyticsResponse(
        total_focus_minutes=total_minutes,
        completed_work_sessions=work_count,
        completed_break_sessions=break_count,
    )

@app.get("/api/sessions/analytics/weekly", response_model=WeeklyAnalyticsResponse)
def get_weekly_analytics(db: Session = Depends(get_db)):
    """Fetch focus minutes and session counts for each of the past 7 days (local time)."""
    today = datetime.now().date()
    seven_days_ago = today - timedelta(days=6)
    
    start_datetime = datetime.combine(seven_days_ago, time.min)
    end_datetime = datetime.combine(today, time.max)

    results = (
        db.query(
            func.date(FocusSessionModel.completed_at).label("session_date"),
            func.coalesce(func.sum(FocusSessionModel.duration_minutes), 0).label("total_minutes"),
            func.count(FocusSessionModel.id).label("session_count")
        )
        .filter(
            FocusSessionModel.mode == SessionModeEnum.WORK,
            FocusSessionModel.completed_at >= start_datetime,
            FocusSessionModel.completed_at <= end_datetime
        )
        .group_by(func.date(FocusSessionModel.completed_at))
        .all()
    )

    # Map SQL results into a dict keyed by 'YYYY-MM-DD'
    stats_by_date = {}
    for row in results:
        if not row.session_date:
            continue

        date_key = str(row.session_date)[:10]
        stats_by_date[date_key] = {
            "minutes": int(row.total_minutes),
            "count": int(row.session_count)
        }

    daily_history = []
    grand_total_minutes = 0

    for i in range(7):
        current_date = seven_days_ago + timedelta(days=i)
        date_str = current_date.strftime("%Y-%m-%d")
        day_label = current_date.strftime("%a")

        day_stats = stats_by_date.get(date_str, {"minutes": 0, "count": 0})
        grand_total_minutes += day_stats["minutes"]

        daily_history.append(
            DailyFocusItem(
                date=date_str,
                day_label=day_label,
                focus_minutes=day_stats["minutes"],
                session_count=day_stats["count"]
            )
        )

    return WeeklyAnalyticsResponse(
        daily_history=daily_history,
        total_weekly_minutes=grand_total_minutes
    )

@app.get("/api/sessions/journal")
def get_journal_entries(db: Session = Depends(get_db)):
    """Fetch all focus session reflections sorted from newest to oldest."""
    sessions = (
        db.query(FocusSessionModel)
        .filter(FocusSessionModel.notes.isnot(None))
        .order_by(FocusSessionModel.completed_at.desc())
        .all()
    )

    result = []
    for s in sessions:
        task_title = s.task.title if s.task else None
        task_category = s.task.category.value if (s.task and s.task.category) else None
        result.append({
            "id": s.id,
            "task_title": task_title,
            "task_category": task_category,
            "duration_minutes": s.duration_minutes,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "notes": s.notes
        })

    return result

# -------------------------------------------------------------------
# Static & Collection Routes
# -------------------------------------------------------------------

@app.get("/api/tasks", response_model=list[TaskResponse])
def get_tasks(category: TaskCategoryEnum | None = None, db: Session = Depends(get_db)):
    """Fetch active tasks, optionally filtered by category."""
    priority_order = case(
        {
            PriorityEnum.HIGH: 1,
            PriorityEnum.MEDIUM: 2,
            PriorityEnum.LOW: 3,
        },
        value=TaskModel.priority,
    )

    query = db.query(TaskModel).filter(TaskModel.is_archived == False)

    if category is not None:
        query = query.filter(TaskModel.category == category)

    return query.order_by(
        TaskModel.due_date.asc().nullslast(),
        priority_order.asc()
    ).all()

@app.get("/api/tasks/archived", response_model=list[TaskResponse])
def get_archived_tasks(db: Session = Depends(get_db)):
    """Fetch all archived tasks."""
    return db.query(TaskModel).filter(TaskModel.is_archived == True).all()

@app.post("/api/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task with title, description, priority, and optional due date."""
    new_task = TaskModel(
        title=task_in.title.strip(),
        description=task_in.description.strip() if task_in.description else None,
        category=task_in.category or TaskCategoryEnum.DEVELOPMENT,
        priority=task_in.priority or PriorityEnum.MEDIUM,
        due_date=task_in.due_date,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@app.post("/api/tasks/clear-completed", response_model=list[TaskResponse])
def clear_completed_tasks(db: Session = Depends(get_db)):
    """Archive all completed tasks instead of hard deleting them."""
    completed_tasks = db.query(TaskModel).filter(
        TaskModel.is_completed == True,
        TaskModel.is_archived == False
    ).all()
    
    for task in completed_tasks:
        task.is_archived = True
        task.is_top3 = False
        task.previous_priority = None  # Clean up top3 fallback state
        
    db.commit()
    return db.query(TaskModel).filter(TaskModel.is_archived == False).all()

# -------------------------------------------------------------------
# Dynamic Parameter Routes ({task_id})
# -------------------------------------------------------------------

@app.patch("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_in: TaskUpdate, db: Session = Depends(get_db)):
    """Update title, description, priority, or due_date on an existing task."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task_in.priority is not None and task_in.priority != task.priority:
        if task.is_top3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change priority while task is pinned in Top 3 Today. Unpin it first."
            )
        task.priority = task_in.priority

    if task_in.title is not None:
        if not task_in.title.strip():
            raise HTTPException(status_code=400, detail="Title cannot be empty")
        task.title = task_in.title.strip()

    if task_in.description is not None:
        task.description = task_in.description.strip() if task_in.description else None

    if task_in.category is not None:
        task.category = task_in.category

    if "due_date" in task_in.model_fields_set:
        task.due_date = task_in.due_date

    db.commit()
    db.refresh(task)
    return task

@app.patch("/api/tasks/{task_id}/top3", response_model=TaskResponse)
def toggle_top3_task(task_id: int, db: Session = Depends(get_db)):
    """Toggle is_top3 status with max 3-item limit and priority elevation/reversion."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.is_top3:
        top3_count = db.query(TaskModel).filter(
            TaskModel.is_top3 == True,
            TaskModel.is_archived == False
        ).count()
        if top3_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot pin more than 3 tasks to Top 3 Today."
            )
        
        task.previous_priority = task.priority
        task.priority = PriorityEnum.HIGH
        task.is_top3 = True
    else:
        task.priority = task.previous_priority if task.previous_priority else PriorityEnum.MEDIUM
        task.previous_priority = None
        task.is_top3 = False

    db.commit()
    db.refresh(task)
    return task

@app.patch("/api/tasks/{task_id}/complete", response_model=TaskResponse)
def toggle_task_completion(task_id: int, db: Session = Depends(get_db)):
    """Toggle the is_completed status of a task."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.is_completed = not task.is_completed
    
    db.commit()
    db.refresh(task)
    return task

@app.patch("/api/tasks/{task_id}/unarchive", response_model=TaskResponse)
def unarchive_task(task_id: int, db: Session = Depends(get_db)):
    """Restore an archived task back to the active inbox."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.is_archived = False
    task.is_completed = False
    
    db.commit()
    db.refresh(task)
    return task

@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task by ID."""
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return None
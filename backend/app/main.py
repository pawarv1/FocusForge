from datetime import datetime, time, timedelta, timezone
from fastapi import FastAPI, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from icalendar import Calendar
import recurring_ical_events
import requests

from app.config import settings
from app.security import setup_security_middleware
from app.database import Base, engine, get_db
from app.models import (
    TaskEnrichmentModel,
    MicroStepModel,
    PriorityEnum,
    FocusSessionModel,
    SessionModeEnum,
)
from app.schemas import (
    TaskEnrichmentUpdate,
    UnifiedTaskResponse,
    MicroStepCreate,
    MicroStepUpdate,
    MicroStepResponse,
    FocusSessionCreate,
    FocusSessionUpdate,
    FocusSessionResponse,
    DailyAnalyticsResponse,
    WeeklyAnalyticsResponse,
    DailyFocusItem,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

setup_security_middleware(app)


# -------------------------------------------------------------------
# Helpers (UTC Normalization & Lazy Enrichment)
# -------------------------------------------------------------------

def _to_naive_utc(dt: datetime) -> datetime:
    """Normalize aware or naive local datetimes into naive UTC for SQLite storage."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    local_tz = datetime.now().astimezone().tzinfo
    return dt.replace(tzinfo=local_tz).astimezone(timezone.utc).replace(tzinfo=None)


def _utc_to_local_date_str(dt: datetime) -> str:
    """Convert a stored naive UTC datetime into a local 'YYYY-MM-DD' string."""
    aware_utc = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    return aware_utc.astimezone().strftime("%Y-%m-%d")


def _get_or_create_enrichment(
    db: Session,
    google_task_id: str,
    google_list_id: str = "default",
) -> TaskEnrichmentModel:
    """Fetch existing enrichment row or lazily create one on first mutation."""
    enrichment = (
        db.query(TaskEnrichmentModel)
        .filter(TaskEnrichmentModel.google_task_id == google_task_id)
        .first()
    )
    if not enrichment:
        enrichment = TaskEnrichmentModel(
            google_task_id=google_task_id,
            google_list_id=google_list_id,
        )
        db.add(enrichment)
        db.flush()
    elif google_list_id != "default" and enrichment.google_list_id != google_list_id:
        enrichment.google_list_id = google_list_id
    return enrichment


# -------------------------------------------------------------------
# Google Calendar Endpoint (Read-Only Today Agenda)
# -------------------------------------------------------------------

FOCUS_KEYWORDS = ("focus", "deep work", "study block")


def _is_focus_block(title: str) -> bool:
    normalized = title.strip().lower()
    return any(keyword in normalized for keyword in FOCUS_KEYWORDS)


@app.get("/api/calendar/today")
def get_today_calendar_events():
    """Fetch today's Google Calendar events and flag Focus Blocks vs. busy windows."""
    ical_url = settings.GOOGLE_CALENDAR_ICAL_URL
    if not ical_url:
        return []

    try:
        response = requests.get(ical_url, timeout=5)
        response.raise_for_status()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch Google Calendar feed: {str(e)}",
        )

    cal = Calendar.from_ical(response.content)

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

        title = str(component.get("summary", "Busy")).strip() or "Busy"

        if isinstance(dtstart, datetime):
            if dtstart.tzinfo is not None:
                dtstart = dtstart.astimezone()
            else:
                dtstart = dtstart.replace(tzinfo=local_now.tzinfo)

            if isinstance(dtend, datetime):
                dtend = (
                    dtend.astimezone()
                    if dtend.tzinfo is not None
                    else dtend.replace(tzinfo=local_now.tzinfo)
                )
            else:
                dtend = dtstart + timedelta(hours=1)

            start_hour = dtstart.hour + (dtstart.minute / 60.0)
            end_hour = dtend.hour + (dtend.minute / 60.0)
            start_str = dtstart.strftime("%I:%M %p")
            end_str = dtend.strftime("%I:%M %p")
            start_iso = dtstart.isoformat()
        else:
            # All-day event (date object)
            start_hour = 9.0
            end_hour = 10.0
            start_str = "All Day"
            end_str = ""
            start_iso = datetime.combine(dtstart, time(9, 0), tzinfo=local_now.tzinfo).isoformat()

        duration = max(end_hour - start_hour, 0.5)
        base_uid = str(component.get("uid", f"evt-{idx}"))

        events.append({
            "id": f"{base_uid}-{today.isoformat()}-{idx}",
            "title": title,
            "startIso": start_iso,
            "startTime": start_str,
            "endTime": end_str,
            "startHour": start_hour,
            "durationHours": duration,
            "isFocusBlock": _is_focus_block(title),
        })

    events.sort(key=lambda e: e["startHour"])
    return events

# -------------------------------------------------------------------
# Focus Session, Analytics & Journal Endpoints
# -------------------------------------------------------------------

@app.post("/api/sessions", response_model=FocusSessionResponse, status_code=status.HTTP_201_CREATED)
def log_focus_session(session_in: FocusSessionCreate, db: Session = Depends(get_db)):
    """Log a completed work or break focus session with task metadata snapshot."""
    linked_task_id = None
    if session_in.google_task_id:
        enrichment = (
            db.query(TaskEnrichmentModel)
            .filter(TaskEnrichmentModel.google_task_id == session_in.google_task_id)
            .first()
        )
        if enrichment:
            linked_task_id = enrichment.google_task_id

    new_session = FocusSessionModel(
        google_task_id=linked_task_id,
        task_title=session_in.task_title.strip() if session_in.task_title else None,
        category_name=session_in.category_name.strip() if session_in.category_name else None,
        duration_minutes=session_in.duration_minutes,
        mode=session_in.mode,
        notes=session_in.notes.strip() if session_in.notes else None,
        completed_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@app.get("/api/sessions/analytics/today", response_model=DailyAnalyticsResponse)
def get_today_analytics(db: Session = Depends(get_db)):
    """Fetch aggregated focus stats for the current local day."""
    local_now = datetime.now().astimezone()
    utc_start = _to_naive_utc(datetime.combine(local_now.date(), time.min, tzinfo=local_now.tzinfo))
    utc_end = _to_naive_utc(datetime.combine(local_now.date(), time.max, tzinfo=local_now.tzinfo))

    total_minutes = (
        db.query(func.coalesce(func.sum(FocusSessionModel.duration_minutes), 0))
        .filter(
            FocusSessionModel.mode == SessionModeEnum.WORK,
            FocusSessionModel.completed_at >= utc_start,
            FocusSessionModel.completed_at <= utc_end,
        )
        .scalar()
    )

    work_count = (
        db.query(FocusSessionModel)
        .filter(
            FocusSessionModel.mode == SessionModeEnum.WORK,
            FocusSessionModel.completed_at >= utc_start,
            FocusSessionModel.completed_at <= utc_end,
        )
        .count()
    )

    break_count = (
        db.query(FocusSessionModel)
        .filter(
            FocusSessionModel.mode == SessionModeEnum.BREAK,
            FocusSessionModel.completed_at >= utc_start,
            FocusSessionModel.completed_at <= utc_end,
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
    """Fetch focus minutes and session counts for each of the past 7 local days."""
    local_now = datetime.now().astimezone()
    today = local_now.date()
    seven_days_ago = today - timedelta(days=6)

    utc_start = _to_naive_utc(datetime.combine(seven_days_ago, time.min, tzinfo=local_now.tzinfo))
    utc_end = _to_naive_utc(datetime.combine(today, time.max, tzinfo=local_now.tzinfo))

    sessions = (
        db.query(FocusSessionModel)
        .filter(
            FocusSessionModel.mode == SessionModeEnum.WORK,
            FocusSessionModel.completed_at >= utc_start,
            FocusSessionModel.completed_at <= utc_end,
        )
        .all()
    )

    stats_by_date: dict[str, dict[str, int]] = {}
    for s in sessions:
        date_key = _utc_to_local_date_str(s.completed_at)
        bucket = stats_by_date.setdefault(date_key, {"minutes": 0, "count": 0})
        bucket["minutes"] += s.duration_minutes
        bucket["count"] += 1

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
                session_count=day_stats["count"],
            )
        )

    return WeeklyAnalyticsResponse(
        daily_history=daily_history,
        total_weekly_minutes=grand_total_minutes,
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

    return [
        {
            "id": s.id,
            "task_title": s.task_title,
            "task_category": s.category_name,
            "duration_minutes": s.duration_minutes,
            "completed_at": s.completed_at.replace(tzinfo=timezone.utc).isoformat()
            if s.completed_at
            else None,
            "notes": s.notes,
        }
        for s in sessions
    ]


@app.patch("/api/sessions/{session_id}", response_model=FocusSessionResponse)
def update_focus_session(
    session_id: int,
    session_in: FocusSessionUpdate,
    db: Session = Depends(get_db),
):
    """Update reflection notes on an existing focus session."""
    db_session = (
        db.query(FocusSessionModel)
        .filter(FocusSessionModel.id == session_id)
        .first()
    )
    if not db_session:
        raise HTTPException(status_code=404, detail="Focus session not found")

    db_session.notes = session_in.notes.strip() if session_in.notes else None
    db.commit()
    db.refresh(db_session)
    return db_session


# -------------------------------------------------------------------
# Task Sync & Enrichment Endpoints
# -------------------------------------------------------------------

@app.get("/api/tasks", response_model=list[UnifiedTaskResponse])
def get_tasks(category: str | None = None, db: Session = Depends(get_db)):
    """
    Phase 2 hook: Fetch active tasks from Google Tasks API and merge with
    local TaskEnrichmentModel rows. Currently returns locally enriched tasks
    until Google Tasks OAuth client is wired in Phase 2.
    """
    enrichments = db.query(TaskEnrichmentModel).all()
    return [
        UnifiedTaskResponse(
            google_task_id=e.google_task_id,
            google_list_id=e.google_list_id,
            category=category or e.google_list_id,
            title=f"[Pending Google Sync] {e.google_task_id}",
            priority=e.priority,
            previous_priority=e.previous_priority,
            is_top3=e.is_top3,
            estimated_minutes=e.estimated_minutes,
            assigned_block_start=e.assigned_block_start,
            steps=e.steps,
        )
        for e in enrichments
    ]


@app.patch("/api/tasks/{google_task_id}", response_model=TaskEnrichmentUpdate)
def update_task_enrichment(
    google_task_id: str,
    task_in: TaskEnrichmentUpdate,
    db: Session = Depends(get_db),
):
    """Update FocusForge-owned metadata (priority, estimated_minutes, assigned_block_start)."""
    enrichment = _get_or_create_enrichment(
        db,
        google_task_id=google_task_id,
        google_list_id=task_in.google_list_id or "default",
    )

    if task_in.priority is not None and task_in.priority != enrichment.priority:
        if enrichment.is_top3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change priority while task is pinned in Top 3 Today. Unpin it first.",
            )
        enrichment.priority = task_in.priority

    if "estimated_minutes" in task_in.model_fields_set:
        enrichment.estimated_minutes = task_in.estimated_minutes

    if "assigned_block_start" in task_in.model_fields_set:
        enrichment.assigned_block_start = (
            _to_naive_utc(task_in.assigned_block_start)
            if task_in.assigned_block_start is not None
            else None
        )

    db.commit()
    db.refresh(enrichment)
    return enrichment


@app.patch("/api/tasks/{google_task_id}/top3")
def toggle_top3_task(
    google_task_id: str,
    google_list_id: str = Query(default="default"),
    db: Session = Depends(get_db),
):
    """Toggle is_top3 status with max 3-item limit and priority elevation/reversion."""
    enrichment = _get_or_create_enrichment(db, google_task_id, google_list_id)

    if not enrichment.is_top3:
        top3_count = (
            db.query(TaskEnrichmentModel)
            .filter(TaskEnrichmentModel.is_top3 == True)
            .count()
        )
        if top3_count >= 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot pin more than 3 tasks to Top 3 Today.",
            )

        enrichment.previous_priority = enrichment.priority
        enrichment.priority = PriorityEnum.HIGH
        enrichment.is_top3 = True
    else:
        enrichment.priority = (
            enrichment.previous_priority
            if enrichment.previous_priority
            else PriorityEnum.UNASSIGNED
        )
        enrichment.previous_priority = None
        enrichment.is_top3 = False

    db.commit()
    db.refresh(enrichment)
    return {
        "google_task_id": enrichment.google_task_id,
        "priority": enrichment.priority,
        "previous_priority": enrichment.previous_priority,
        "is_top3": enrichment.is_top3,
    }


@app.patch("/api/tasks/{google_task_id}/complete")
def complete_google_task(
    google_task_id: str,
    google_list_id: str = Query(default="@default"),
    db: Session = Depends(get_db),
):
    """
    Mark task completed in Google Tasks (wired in Phase 2) and clean up
    local Top 3 / assigned block state.
    """
    enrichment = (
        db.query(TaskEnrichmentModel)
        .filter(TaskEnrichmentModel.google_task_id == google_task_id)
        .first()
    )
    if enrichment:
        enrichment.is_top3 = False
        enrichment.previous_priority = None
        enrichment.assigned_block_start = None
        db.commit()

    # Phase 2 will call Google Tasks API: tasks().patch(tasklist=google_list_id, task=google_task_id, body={"status": "completed"})
    return {"google_task_id": google_task_id, "is_completed": True}


# -------------------------------------------------------------------
# Micro-Step Breakdown Endpoints
# -------------------------------------------------------------------

@app.post(
    "/api/tasks/{google_task_id}/steps",
    response_model=MicroStepResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_micro_step(
    google_task_id: str,
    step_in: MicroStepCreate,
    google_list_id: str = Query(default="default"),
    db: Session = Depends(get_db),
):
    """Add a broken-down micro-step to a Google Task."""
    _get_or_create_enrichment(db, google_task_id, google_list_id)

    new_step = MicroStepModel(
        google_task_id=google_task_id,
        title=step_in.title.strip(),
        position=step_in.position,
    )
    db.add(new_step)
    db.commit()
    db.refresh(new_step)
    return new_step


@app.patch("/api/steps/{step_id}", response_model=MicroStepResponse)
def update_micro_step(
    step_id: int,
    step_in: MicroStepUpdate,
    db: Session = Depends(get_db),
):
    """Toggle completion, rename, or reorder a micro-step."""
    step = db.query(MicroStepModel).filter(MicroStepModel.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Micro-step not found")

    if step_in.title is not None:
        if not step_in.title.strip():
            raise HTTPException(status_code=400, detail="Step title cannot be empty")
        step.title = step_in.title.strip()

    if step_in.is_done is not None:
        step.is_done = step_in.is_done

    if step_in.position is not None:
        step.position = step_in.position

    db.commit()
    db.refresh(step)
    return step


@app.delete("/api/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_micro_step(step_id: int, db: Session = Depends(get_db)):
    """Remove a micro-step from a task breakdown."""
    step = db.query(MicroStepModel).filter(MicroStepModel.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Micro-step not found")

    db.delete(step)
    db.commit()
    return None
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from datetime import datetime, timedelta
from app.database import Base, engine, SessionLocal
from app.models import (
    TaskModel,
    PriorityEnum,
    TaskCategoryEnum,
    FocusSessionModel,
    SessionModeEnum,
)


def seed_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    now = datetime.now()

    try:
        # 1. Seed Diverse Tasks (Respecting Max 3 Top-3 Pin Rule)
        tasks = [
            TaskModel(
                title="Finalize FocusForge v1.0 end-to-end workflow test",
                description="Verify Workspace, Schedule, Journal, and Analytics tabs.",
                category=TaskCategoryEnum.DEVELOPMENT,
                priority=PriorityEnum.HIGH,
                previous_priority=PriorityEnum.HIGH,
                is_top3=True,
                due_date=now + timedelta(hours=4),
            ),
            TaskModel(
                title="Complete CSC380 Distributed Systems Problem Set",
                description="Finish Raft consensus proof and submit PDF.",
                category=TaskCategoryEnum.COURSEWORK,
                priority=PriorityEnum.HIGH,
                previous_priority=PriorityEnum.MEDIUM,
                is_top3=True,
                due_date=now + timedelta(days=1),
            ),
            TaskModel(
                title="Review technical interview system design notes",
                description="Focus on caching, rate limiting, and database indexing.",
                category=TaskCategoryEnum.CAREER,
                priority=PriorityEnum.HIGH,
                previous_priority=PriorityEnum.MEDIUM,
                is_top3=True,
                due_date=now + timedelta(days=2),
            ),
            TaskModel(
                title="Benchmark RecallMind RAG chunk retrieval latency",
                description="Compare ChromaDB HNSW parameters on local dataset.",
                category=TaskCategoryEnum.RESEARCH,
                priority=PriorityEnum.MEDIUM,
                is_top3=False,
                due_date=now + timedelta(days=3),
            ),
            TaskModel(
                title="Clean up Git branches and tag release",
                description="Push verified backend and frontend updates to GitHub.",
                category=TaskCategoryEnum.OTHER,
                priority=PriorityEnum.LOW,
                is_top3=False,
            ),
        ]

        db.add_all(tasks)
        db.commit()
        for t in tasks:
            db.refresh(t)

        # 2. Seed Multi-Day Focus Sessions & Journal Reflections
        sessions = [
            FocusSessionModel(
                task_id=tasks[0].id,
                duration_minutes=50,
                mode=SessionModeEnum.WORK,
                notes="Wired recurring-ical-events and local timezone conversion cleanly.",
                completed_at=now - timedelta(hours=1),
            ),
            FocusSessionModel(
                task_id=None,
                duration_minutes=10,
                mode=SessionModeEnum.BREAK,
                completed_at=now - timedelta(minutes=45),
            ),
            FocusSessionModel(
                task_id=tasks[1].id,
                duration_minutes=45,
                mode=SessionModeEnum.WORK,
                notes="Mapped out leader election edge cases for Raft consensus.",
                completed_at=now - timedelta(days=1, hours=2),
            ),
            FocusSessionModel(
                task_id=tasks[2].id,
                duration_minutes=50,
                mode=SessionModeEnum.WORK,
                notes="Practiced consistent hashing and read-replica tradeoffs.",
                completed_at=now - timedelta(days=2, hours=3),
            ),
            FocusSessionModel(
                task_id=tasks[3].id,
                duration_minutes=25,
                mode=SessionModeEnum.WORK,
                notes="Tested embedding batch sizes; 32 gave best throughput.",
                completed_at=now - timedelta(days=4, hours=1),
            ),
        ]

        db.add_all(sessions)
        db.commit()
        print("✅ FocusForge database seeded successfully!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
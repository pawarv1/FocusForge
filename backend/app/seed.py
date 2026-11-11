from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import TaskModel, PriorityEnum

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        if db.query(TaskModel).count() > 0:
            print("Database already contains tasks. Skipping seed.")
            return

        now = datetime.now(timezone.utc)

        sample_tasks = [
            TaskModel(
                title="Train YOLO11 vision model on workstation",
                description="Run dataset rotation script and evaluate mAP metrics.",
                priority=PriorityEnum.HIGH,
                is_top3=True,
                due_date=now + timedelta(hours=18),
            ),
            TaskModel(
                title="Refactor FocusForge API endpoints",
                description="Clean up TaskListView and verify router logic.",
                priority=PriorityEnum.MEDIUM,
                is_top3=True,
                due_date=now + timedelta(days=2),
            ),
            TaskModel(
                title="Abstract Algebra problem set 4",
                description="Complete proofs for ring homomorphisms.",
                priority=PriorityEnum.HIGH,
                is_top3=True,
                due_date=now + timedelta(days=1),
            ),
            TaskModel(
                title="Update resume with TCNJ research project",
                description="Add metrics for ROS 2 and PyTorch integration.",
                priority=PriorityEnum.LOW,
                is_top3=False,
                due_date=None,
            ),
        ]

        db.add_all(sample_tasks)
        db.commit()
        print("Successfully seeded FocusForge database with initial tasks!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
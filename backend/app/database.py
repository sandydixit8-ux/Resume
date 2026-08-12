from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=False,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    if _is_sqlite:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_owner_token_column():
    """Add the resumes.owner_token_hash column to pre-existing databases.

    `create_all` only creates missing tables; existing DBs need an explicit
    ALTER TABLE for the new ownership column.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "resumes" not in inspector.get_table_names():
        return
    column_names = {col["name"] for col in inspector.get_columns("resumes")}
    if "owner_token_hash" not in column_names:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE resumes ADD COLUMN owner_token_hash VARCHAR(64)"))


def _ensure_indexes():
    """Create indexes on existing databases for newly indexed columns.

    create_all creates indexes for new tables but skips already-existing ones,
    so add them explicitly for older databases.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing = {ix["name"] for t in inspector.get_table_names() for ix in inspector.get_indexes(t)}
    with engine.begin() as conn:
        if "analyses" in inspector.get_table_names() and "ix_analyses_resume_id" not in existing:
            conn.execute(text("CREATE INDEX ix_analyses_resume_id ON analyses (resume_id)"))
        if "jd_analyses" in inspector.get_table_names() and "ix_jd_analyses_resume_id" not in existing:
            conn.execute(text("CREATE INDEX ix_jd_analyses_resume_id ON jd_analyses (resume_id)"))
        if "cover_letters" in inspector.get_table_names() and "ix_cover_letters_resume_id" not in existing:
            conn.execute(text("CREATE INDEX ix_cover_letters_resume_id ON cover_letters (resume_id)"))
        if "cover_letters" in inspector.get_table_names() and "ix_cover_letters_jd_analysis_id" not in existing:
            conn.execute(text("CREATE INDEX ix_cover_letters_jd_analysis_id ON cover_letters (jd_analysis_id)"))


def _run_alembic_migrations() -> bool:
    """Run Alembic migrations if a scripts directory is present.

    Returns True when migrations ran. Falls back to create_all when there is
    no migration history yet (e.g. legacy local databases)."""
    import importlib.util

    if importlib.util.find_spec("alembic") is None:
        return False
    scripts_dir = Path(__file__).resolve().parent.parent / "alembic"
    if not (scripts_dir / "env.py").exists():
        return False
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(scripts_dir.parent / "alembic.ini"))
    cfg.set_main_option("script_location", str(scripts_dir))
    try:
        command.upgrade(cfg, "head")
        return True
    except Exception:
        # No alembic_version table yet (pre-migration database): fall through
        # to create_all so the app still boots, then stamp as head.
        try:
            command.stamp(cfg, "head")
        except Exception:
            pass
        return False


def init_db():
    from app.models.resume import Resume
    from app.models.analysis import Analysis, JDAnalysis, CoverLetter
    from app.models.admin import VisitorLog, AdminSetting
    from app.models.payment import Subscription
    from app.models.contact import ContactMessage
    if _run_alembic_migrations():
        return
    Base.metadata.create_all(bind=engine)
    _ensure_owner_token_column()
    _ensure_indexes()

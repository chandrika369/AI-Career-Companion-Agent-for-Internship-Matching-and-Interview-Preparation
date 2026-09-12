import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")

engine = create_engine(
    DATABASE_URL,
    echo=False
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables and ensure all new columns exist in database."""
    from sqlalchemy import text, inspect
    Base.metadata.create_all(bind=engine)

    try:
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()

        with engine.connect() as conn:
            # ── users table: additive column migrations ───────────────
            if "users" in existing_tables:
                existing_cols = {c["name"] for c in inspector.get_columns("users")}
                if "skills" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN skills TEXT NULL"))
                if "bio" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN bio TEXT NULL"))
                if "github" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN github VARCHAR(255) NULL"))
                if "linkedin" not in existing_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN linkedin VARCHAR(255) NULL"))

            # ── chat_sessions table: additive column migrations ───────
            if "chat_sessions" in existing_tables:
                existing_cols = {c["name"] for c in inspector.get_columns("chat_sessions")}
                if "mode" not in existing_cols:
                    conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN mode VARCHAR(50) NULL DEFAULT 'general'"))
                if "updated_at" not in existing_cols:
                    conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN updated_at DATETIME NULL"))

            conn.commit()
    except Exception as e:
        print(f"init_db migration note: {e}")

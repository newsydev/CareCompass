import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


def database_path():
    return Path(os.environ.get(
        "CARECOMPASS_DB_PATH",
        str(Path(__file__).resolve().parents[1] / "data" / "carecompass.sqlite3"),
    )).expanduser().resolve()


@contextmanager
def connection():
    db = sqlite3.connect(str(database_path()), timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize_database():
    path = database_path()
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.touch(mode=0o600, exist_ok=True)
    path.chmod(0o600)
    with connection() as db:
        db.execute("PRAGMA journal_mode = WAL")
        version = db.execute("PRAGMA user_version").fetchone()[0]
        if version > 2:
            raise RuntimeError("This database requires a newer CareCompass version.")
        if version == 0:
            db.executescript("""
                BEGIN IMMEDIATE;
                CREATE TABLE users (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE profiles (
                    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    address TEXT NOT NULL DEFAULT '',
                    age_years REAL,
                    medical_history TEXT NOT NULL DEFAULT '',
                    pregnant INTEGER NOT NULL DEFAULT 0,
                    immunocompromised INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    expires_at INTEGER NOT NULL
                );
                CREATE INDEX sessions_user ON sessions(user_id);
                CREATE TABLE chats (
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    revision INTEGER NOT NULL,
                    snapshot_json TEXT NOT NULL,
                    PRIMARY KEY (user_id, id)
                );
                CREATE TABLE messages (
                    user_id TEXT NOT NULL,
                    chat_id TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    PRIMARY KEY (user_id, chat_id, position),
                    FOREIGN KEY (user_id, chat_id) REFERENCES chats(user_id, id) ON DELETE CASCADE
                );
                CREATE INDEX chats_recent ON chats(user_id, updated_at DESC);
                CREATE TABLE login_attempts (
                    email_hash TEXT NOT NULL,
                    ip_hash TEXT NOT NULL,
                    attempted_at INTEGER NOT NULL
                );
                CREATE INDEX attempts_time ON login_attempts(attempted_at);
                PRAGMA user_version = 1;
                COMMIT;
            """)
            version = 1
        if version == 1:
            db.executescript("""
                BEGIN IMMEDIATE;
                CREATE TABLE bookings (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    chat_id TEXT,
                    caregiver_id TEXT NOT NULL,
                    care_type TEXT NOT NULL,
                    urgency TEXT,
                    slot_start TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('confirmed_demo', 'cancelled')),
                    created_at TEXT NOT NULL
                );
                CREATE INDEX bookings_user ON bookings(user_id, created_at DESC);
                CREATE UNIQUE INDEX bookings_active_slot ON bookings(caregiver_id, slot_start) WHERE status = 'confirmed_demo';
                PRAGMA user_version = 2;
                COMMIT;
            """)

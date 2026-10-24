import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

from app.schemas import Location, PatientContext, TriageResponse
from app.storage import connection

COOKIE = "carecompass_session"
SESSION_SECONDS = 7 * 24 * 60 * 60


def allowed_origins():
    configured = os.environ.get("CARECOMPASS_ORIGINS", "")
    if configured:
        return [value.strip() for value in configured.split(",") if value.strip()]
    return [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]


def check_origin(request: Request):
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    origins = allowed_origins()
    if "*" in origins:
        return
    origin = request.headers.get("origin")
    if not origin:
        return
    # If origin matches Host header (e.g. reverse proxy via Nginx)
    host = request.headers.get("host")
    if host and (origin == f"http://{host}" or origin == f"https://{host}"):
        return
    if origin in origins:
        return
    # Allow local loopback and standard RFC1918 private LAN IP ranges for mobile testing
    clean_host = origin.replace("http://", "").replace("https://", "").split(":")[0]
    if clean_host in ("localhost", "127.0.0.1") or clean_host.startswith(("192.168.", "10.", "172.")):
        return
    raise HTTPException(403, f"This request origin is not allowed: {origin}")


router = APIRouter(prefix="/api", dependencies=[Depends(check_origin)])


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address.")
        return value


class Registration(Credentials):
    name: str = Field(min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def strong_password(cls, value):
        if len(value) < 12:
            raise ValueError("Use a password with at least 12 characters.")
        return value

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value):
        if not value.strip():
            raise ValueError("Enter your name.")
        return value.strip()


class Profile(BaseModel):
    email: str
    name: str = Field(min_length=1, max_length=100)
    address: str = Field("", max_length=500)
    ageYears: Optional[float] = Field(None, ge=0, le=120, allow_inf_nan=False)
    medicalHistory: str = Field("", max_length=4000)
    pregnant: bool = False
    immunocompromised: bool = False

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value):
        return Registration.nonblank_name(value)


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=50000)
    patientContext: Optional[PatientContext] = None
    location: Optional[Location] = None
    result: Optional[TriageResponse] = None


class Chat(BaseModel):
    id: uuid.UUID
    revision: int = Field(0, ge=0)
    messages: List[Turn] = Field(default_factory=list, max_length=2000)
    patientContext: PatientContext
    recipient: Literal["self", "other"]
    emergency: bool
    result: Optional[TriageResponse] = None
    location: Optional[Location] = None
    selectedCaregiverId: Optional[str] = Field(None, max_length=100)


class LegacyImport(BaseModel):
    profile: Profile
    chats: List[Chat] = Field(default_factory=list, max_length=200)


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 600000)
    return "pbkdf2_sha256$600000$" + salt + "$" + digest.hex()


def fingerprint(value):
    return hashlib.sha256(value.encode()).hexdigest()


def current_user(request: Request):
    token = request.cookies.get(COOKIE, "")
    with connection() as db:
        row = db.execute(
            "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id "
            "WHERE token_hash = ? AND expires_at > ?",
            (fingerprint(token), int(time.time())),
        ).fetchone()
    if not row:
        raise HTTPException(401, "Please log in to access your account.")
    return dict(row)


def read_profile(db, user):
    row = db.execute("SELECT * FROM profiles WHERE user_id = ?", (user["id"],)).fetchone()
    return Profile(
        email=user["email"], name=row["name"], address=row["address"],
        ageYears=row["age_years"], medicalHistory=row["medical_history"],
        pregnant=bool(row["pregnant"]), immunocompromised=bool(row["immunocompromised"]),
    ).model_dump(exclude_none=True)


def write_profile(db, user, profile):
    if profile.email.strip().lower() != user["email"]:
        raise HTTPException(422, "Changing the account email is not supported.")
    db.execute(
        "UPDATE profiles SET name=?, address=?, age_years=?, medical_history=?, pregnant=?, immunocompromised=? WHERE user_id=?",
        (profile.name, profile.address.strip(), profile.ageYears, profile.medicalHistory.strip(),
         profile.pregnant, profile.immunocompromised, user["id"]),
    )


def read_chats(db, user):
    rows = db.execute("SELECT * FROM chats WHERE user_id=? ORDER BY updated_at DESC", (user["id"],)).fetchall()
    messages = db.execute(
        "SELECT chat_id, role, content, metadata_json FROM messages WHERE user_id=? ORDER BY chat_id, position", (user["id"],)
    ).fetchall()
    turns = {}
    for message in messages:
        turns.setdefault(message["chat_id"], []).append({
            "role": message["role"], "content": message["content"], **json.loads(message["metadata_json"]),
        })
    return [
        {**json.loads(row["snapshot_json"]), "id": row["id"], "revision": row["revision"],
         "title": row["title"], "updatedAt": row["updated_at"], "messages": turns.get(row["id"], [])}
        for row in rows
    ]


def write_chat(db, user, chat):
    chat_id = str(chat.id)
    previous = db.execute("SELECT revision FROM chats WHERE user_id=? AND id=?", (user["id"], chat_id)).fetchone()
    if (previous["revision"] if previous else 0) != chat.revision:
        raise HTTPException(409, "This chat changed in another tab. Reload before saving; no changes were overwritten.")
    snapshot = chat.model_dump(mode="json", exclude={"messages", "id", "revision"}, exclude_none=True)
    if chat.result is not None:
        snapshot["result"] = chat.result.model_dump(mode="json")
    title = next((turn.content.strip()[:60] for turn in chat.messages if turn.role == "user"), "Care conversation")
    updated = datetime.now(timezone.utc).isoformat()
    revision = chat.revision + 1
    db.execute(
        "INSERT INTO chats VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id,id) DO UPDATE SET "
        "title=excluded.title, updated_at=excluded.updated_at, revision=excluded.revision, snapshot_json=excluded.snapshot_json",
        (user["id"], chat_id, title, updated, revision, json.dumps(snapshot)),
    )
    db.execute("DELETE FROM messages WHERE user_id=? AND chat_id=?", (user["id"], chat_id))
    stored_turns = []
    for position, turn in enumerate(chat.messages):
        metadata = turn.model_dump(mode="json", exclude={"role", "content"}, exclude_none=True)
        if turn.result is not None:
            metadata["result"] = turn.result.model_dump(mode="json")
        stored_turns.append((user["id"], chat_id, position, turn.role, turn.content, json.dumps(metadata)))
    db.executemany("INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?)", stored_turns)
    return {**snapshot, "id": chat_id, "revision": revision, "title": title, "updatedAt": updated,
            "messages": [
                {"role": turn.role, "content": turn.content, **json.loads(stored_turns[index][5])}
                for index, turn in enumerate(chat.messages)
            ]}


def issue_session(db, response, user_id):
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    db.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
    db.execute("INSERT INTO sessions VALUES (?, ?, ?)", (fingerprint(token), user_id, now + SESSION_SECONDS))
    response.set_cookie(
        COOKIE, token, httponly=True, samesite="strict", max_age=SESSION_SECONDS,
        secure=os.environ.get("CARECOMPASS_SECURE_COOKIES") == "1", path="/api",
    )
    response.headers["Cache-Control"] = "no-store"


def throttle(request, email):
    now = int(time.time())
    ip = fingerprint(request.client.host if request.client else "unknown")
    email_hash = fingerprint(email)
    with connection() as db:
        db.execute("DELETE FROM login_attempts WHERE attempted_at < ?", (now - 900,))
        attempts = db.execute(
            "SELECT SUM(email_hash=?), SUM(ip_hash=?) FROM login_attempts", (email_hash, ip)
        ).fetchone()
        limited = (attempts[0] or 0) >= 10 or (attempts[1] or 0) >= 50
        if not limited:
            db.execute("INSERT INTO login_attempts VALUES (?, ?, ?)", (email_hash, ip, now))
    if limited:
        raise HTTPException(429, "Too many account attempts. Try again in 15 minutes.")


@router.post("/auth/register", status_code=201)
def register(body: Registration, request: Request, response: Response):
    throttle(request, body.email)
    user = {"id": str(uuid.uuid4()), "email": body.email}
    hashed = password_hash(body.password)
    try:
        with connection() as db:
            db.execute("INSERT INTO users VALUES (?, ?, ?, ?)", (
                user["id"], body.email, hashed, datetime.now(timezone.utc).isoformat(),
            ))
            db.execute("INSERT INTO profiles(user_id,name) VALUES (?, ?)", (user["id"], body.name))
            issue_session(db, response, user["id"])
            return {"profile": read_profile(db, user), "chats": []}
    except sqlite3.IntegrityError as failure:
        if "users.email" not in str(failure):
            raise
        raise HTTPException(409, "An account already exists for this email. Log in instead.")


@router.post("/auth/login")
def login(body: Credentials, request: Request, response: Response):
    throttle(request, body.email)
    with connection() as db:
        row = db.execute("SELECT * FROM users WHERE email=?", (body.email,)).fetchone()
        stored = row["password_hash"] if row else "pbkdf2_sha256$600000$" + "00" * 16 + "$" + "00" * 32
        candidate = password_hash(body.password, stored.split("$")[2])
        if not row or not hmac.compare_digest(stored, candidate):
            raise HTTPException(401, "Email or password is incorrect.")
        issue_session(db, response, row["id"])
        return {"profile": read_profile(db, row), "chats": read_chats(db, row)}


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response):
    with connection() as db:
        db.execute("DELETE FROM sessions WHERE token_hash=?", (fingerprint(request.cookies.get(COOKIE, "")),))
    response.delete_cookie(COOKIE, path="/api", httponly=True, samesite="strict")


@router.get("/account")
def account(response: Response, user=Depends(current_user)):
    response.headers["Cache-Control"] = "no-store"
    with connection() as db:
        return {"profile": read_profile(db, user), "chats": read_chats(db, user)}


@router.put("/account/profile")
def update_profile(body: Profile, user=Depends(current_user)):
    with connection() as db:
        write_profile(db, user, body)
        return read_profile(db, user)


@router.put("/account/chats/{chat_id}")
def save_chat(chat_id: uuid.UUID, body: Chat, user=Depends(current_user)):
    if chat_id != body.id:
        raise HTTPException(422, "Chat IDs do not match.")
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        return write_chat(db, user, body)


@router.post("/account/import-demo")
def import_demo(body: LegacyImport, user=Depends(current_user)):
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        write_profile(db, user, body.profile)
        for chat in body.chats:
            if not db.execute("SELECT 1 FROM chats WHERE user_id=? AND id=?", (user["id"], str(chat.id))).fetchone():
                write_chat(db, user, chat.model_copy(update={"revision": 0}))
        return {"profile": read_profile(db, user), "chats": read_chats(db, user)}

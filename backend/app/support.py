"""Support tickets. Tickets are stored for the account owner; there is no staff-side inbox yet."""
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.accounts import check_origin, current_user
from app.storage import connection

router = APIRouter(prefix="/api/account/tickets", dependencies=[Depends(check_origin)])
MAX_OPEN_TICKETS = 20


class TicketRequest(BaseModel):
    category: Literal["booking", "billing", "refund", "account", "other"] = "other"
    subject: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=1, max_length=2000)

    @field_validator("subject", "message")
    @classmethod
    def nonblank(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value


def serialize(row):
    return {key: row[key] for key in ("id", "category", "subject", "message", "status")} | {"createdAt": row["created_at"]}


@router.get("")
def list_tickets(user=Depends(current_user)):
    with connection() as db:
        rows = db.execute(
            "SELECT * FROM support_tickets WHERE user_id=? ORDER BY created_at DESC", (user["id"],)
        ).fetchall()
    return [serialize(row) for row in rows]


@router.post("", status_code=201)
def create_ticket(body: TicketRequest, user=Depends(current_user)):
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        open_count = db.execute(
            "SELECT COUNT(*) FROM support_tickets WHERE user_id=? AND status='open'", (user["id"],)
        ).fetchone()[0]
        if open_count >= MAX_OPEN_TICKETS:
            raise HTTPException(429, "You have too many open tickets. Wait for a reply before creating more.")
        ticket_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO support_tickets VALUES (?, ?, ?, ?, ?, 'open', ?)",
            (ticket_id, user["id"], body.category, body.subject, body.message, datetime.now(timezone.utc).isoformat()),
        )
        return serialize(db.execute("SELECT * FROM support_tickets WHERE id=?", (ticket_id,)).fetchone())

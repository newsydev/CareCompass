"""Simulated bookings. No caregiver is contacted; every record is clearly marked as a demo."""
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.accounts import check_origin, current_user
from app.modules.matching import CAREGIVER_RECORDS, IST, ROLE_MAP, _minutes
from app.storage import connection

router = APIRouter(prefix="/api/bookings", dependencies=[Depends(check_origin)])
CAREGIVERS = {record["caregiver_id"]: record for record in CAREGIVER_RECORDS}


class BookingRequest(BaseModel):
    caregiver_id: str = Field(min_length=1, max_length=20)
    care_type: str
    urgency: Optional[str] = None
    slot_start: datetime
    chat_id: Optional[str] = Field(None, max_length=64)


def serialize(row):
    caregiver = CAREGIVERS.get(row["caregiver_id"], {})
    return {
        "booking_id": row["id"], "chat_id": row["chat_id"], "caregiver_id": row["caregiver_id"],
        "caregiver_name": caregiver.get("name"), "care_type": row["care_type"], "urgency": row["urgency"],
        "slot_start": row["slot_start"], "status": row["status"], "created_at": row["created_at"], "is_demo": True,
    }


@router.post("", status_code=201)
def create_booking(body: BookingRequest, user=Depends(current_user)):
    caregiver = CAREGIVERS.get(body.caregiver_id)
    if not caregiver or not caregiver.get("active"):
        raise HTTPException(404, "This caregiver is not available for booking.")
    if ROLE_MAP.get(body.care_type) != str(caregiver.get("role", "")).lower():
        raise HTTPException(422, "This caregiver does not provide the recommended care type.")
    if body.slot_start.tzinfo is None:
        raise HTTPException(422, "Slot time must include a timezone.")
    slot = body.slot_start.astimezone(IST).replace(second=0, microsecond=0)
    now = datetime.now(IST)
    if slot < now - timedelta(minutes=5) or slot > now + timedelta(days=7):
        raise HTTPException(422, "Choose a slot within the next 7 days.")
    minute = slot.hour * 60 + slot.minute
    if not _minutes(caregiver["free_from"]) <= minute <= _minutes(caregiver["free_until"]) - 30:
        raise HTTPException(422, f"Choose a slot between {caregiver['free_from']} and {caregiver['free_until']} IST.")

    booking_id = f"CC-DEMO-{secrets.token_hex(3).upper()}"
    try:
        with connection() as db:
            db.execute(
                "INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed_demo', ?)",
                (booking_id, user["id"], body.chat_id, body.caregiver_id, body.care_type, body.urgency,
                 slot.isoformat(timespec="minutes"), datetime.now(timezone.utc).isoformat(timespec="seconds")),
            )
            row = db.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That slot was just taken. Choose another time.")
    return serialize(row)


@router.get("")
def list_bookings(user=Depends(current_user)):
    with connection() as db:
        rows = db.execute("SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", (user["id"],)).fetchall()
    return [serialize(row) for row in rows]


@router.post("/{booking_id}/cancel")
def cancel_booking(booking_id: str, user=Depends(current_user)):
    with connection() as db:
        updated = db.execute(
            "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'confirmed_demo'",
            (booking_id, user["id"]),
        ).rowcount
        row = db.execute("SELECT * FROM bookings WHERE id = ? AND user_id = ?", (booking_id, user["id"])).fetchone()
    if not row:
        raise HTTPException(404, "Booking not found.")
    if not updated and row["status"] != "cancelled":
        raise HTTPException(409, "This booking cannot be cancelled.")
    return serialize(row)

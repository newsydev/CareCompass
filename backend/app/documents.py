"""Patient-uploaded reports and prescriptions.

Upload is a raw request body (no multipart) so the file type is decided by its leading
bytes, never by the client's Content-Type. Files live in SQLite so they cascade with the account.
"""
import re
import uuid
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from app.accounts import check_origin, current_user
from app.storage import connection

router = APIRouter(prefix="/api/account/documents", dependencies=[Depends(check_origin)])
MAX_BYTES = 5 * 1024 * 1024
MAX_DOCUMENTS = 50
SIGNATURES = (
    (b"%PDF-", "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
)


def sniff(data: bytes):
    return next((kind for prefix, kind in SIGNATURES if data.startswith(prefix)), None)


def clean_filename(name: str):
    name = re.sub(r"[\x00-\x1f\x7f/\\]", "", name).strip().lstrip(".")
    return name[:120] or "document"


def serialize(row):
    return {
        "id": row["id"], "kind": row["kind"], "filename": row["filename"],
        "contentType": row["content_type"], "sizeBytes": row["size_bytes"], "createdAt": row["created_at"],
    }


@router.get("")
def list_documents(kind: Literal["report", "prescription"] | None = None, user=Depends(current_user)):
    query = "SELECT id, kind, filename, content_type, size_bytes, created_at FROM documents WHERE user_id=?"
    params = [user["id"]]
    if kind:
        query += " AND kind=?"
        params.append(kind)
    with connection() as db:
        return [serialize(row) for row in db.execute(query + " ORDER BY created_at DESC", params).fetchall()]


@router.post("", status_code=201)
async def upload_document(
    request: Request,
    kind: Literal["report", "prescription"],
    filename: str = Query(min_length=1, max_length=255),
    user=Depends(current_user),
):
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BYTES:
        raise HTTPException(413, "Files can be at most 5 MB.")
    data = b""
    async for chunk in request.stream():
        data += chunk
        if len(data) > MAX_BYTES:
            raise HTTPException(413, "Files can be at most 5 MB.")
    content_type = sniff(data)
    if not content_type:
        raise HTTPException(415, "Upload a PDF, PNG or JPEG file.")
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT COUNT(*) FROM documents WHERE user_id=?", (user["id"],)).fetchone()[0] >= MAX_DOCUMENTS:
            raise HTTPException(409, "Document limit reached. Delete an older file first.")
        document_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (document_id, user["id"], kind, clean_filename(filename), content_type, len(data),
             datetime.now(timezone.utc).isoformat(), data),
        )
        return serialize(db.execute(
            "SELECT id, kind, filename, content_type, size_bytes, created_at FROM documents WHERE id=?", (document_id,)
        ).fetchone())


@router.get("/{document_id}")
def download_document(document_id: uuid.UUID, user=Depends(current_user)):
    with connection() as db:
        row = db.execute("SELECT * FROM documents WHERE id=? AND user_id=?", (str(document_id), user["id"])).fetchone()
    if not row:
        raise HTTPException(404, "Document not found.")
    return Response(row["data"], media_type=row["content_type"], headers={
        "Content-Disposition": "attachment; filename*=UTF-8''" + quote(row["filename"]),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    })


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: uuid.UUID, user=Depends(current_user)):
    with connection() as db:
        deleted = db.execute("DELETE FROM documents WHERE id=? AND user_id=?", (str(document_id), user["id"])).rowcount
    if not deleted:
        raise HTTPException(404, "Document not found.")

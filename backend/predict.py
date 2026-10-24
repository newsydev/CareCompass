"""Generate a predictions CSV for a hidden test set.

Usage:
  .venv/bin/python predict.py INPUT.jsonl|INPUT.csv -o predictions.csv [--offline] [--now 2026-01-15T10:00+05:30]

Input JSONL rows may be dataset records ({"id", "request": {...}}) or bare requests.
Input CSV needs id,user_input and optional lat,lng,language columns.
Output columns mirror triage_dataset_flat.csv.
"""
import argparse
import asyncio
import csv
import json
import sys
from datetime import datetime
from functools import partial
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import app.main as main_module  # noqa: E402
from app.modules import intake, triage  # noqa: E402
from app.modules.matching import match_caregivers  # noqa: E402
from app.schemas import TriageRequest  # noqa: E402

COLUMNS = ["id", "detected_language", "user_input", "lat", "lng", "care_type", "urgency", "red_flags",
           "follow_up_question", "reasoning", "matched_caregiver_ids", "top_score"]


def configure(offline: bool, now: datetime = None):
    if offline:
        intake.get_groq_client = lambda: None
        triage.get_groq_client = lambda: None
        main_module.get_groq_client = lambda: None
    if now is not None:
        main_module.match_caregivers = partial(match_caregivers, now=now)


def load_requests(path: Path):
    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                location = {"lat": float(row["lat"]), "lng": float(row["lng"])} if row.get("lat") and row.get("lng") else None
                yield row["id"], {"user_input": row["user_input"], "language": row.get("language") or "auto", "location": location, "conversation_history": []}
        return
    for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            record = json.loads(line)
            yield record.get("id", f"ROW{index:04d}"), record.get("request", record)


async def predict(request: dict):
    return await main_module.process_triage(TriageRequest.model_validate(request))


def to_row(case_id, request, response):
    location = request.get("location") or {}
    matches = response.matched_caregivers
    return {
        "id": case_id, "detected_language": response.detected_language or "", "user_input": request["user_input"],
        "lat": location.get("lat", ""), "lng": location.get("lng", ""), "care_type": response.care_type or "",
        "urgency": response.urgency or "", "red_flags": ";".join(response.red_flags),
        "follow_up_question": response.follow_up_question or "", "reasoning": response.reasoning or "",
        "matched_caregiver_ids": ";".join(match.caregiver_id for match in matches),
        "top_score": matches[0].score if matches else "",
    }


async def run(input_path: Path, output_path: Path):
    rows = []
    for case_id, request in load_requests(input_path):
        rows.append(to_row(case_id, request, await predict(request)))
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    return rows


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path)
    parser.add_argument("-o", "--output", type=Path, default=Path("predictions.csv"))
    parser.add_argument("--offline", action="store_true", help="Disable Groq for deterministic, reproducible output.")
    parser.add_argument("--now", type=datetime.fromisoformat, help="Fixed IST clock for availability (ISO 8601 with offset).")
    args = parser.parse_args()
    configure(args.offline, args.now)
    written = asyncio.run(run(args.input, args.output))
    print(f"Wrote {len(written)} predictions to {args.output}")

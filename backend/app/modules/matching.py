import json
import math
import os
import re
from datetime import datetime, timedelta, timezone
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from app.schemas import CaregiverMatch, Location
from app.config import DATA_DIR

CSV_PATH = DATA_DIR / "caregivers.csv"

if not CSV_PATH.exists():
    raise FileNotFoundError(f"caregivers.csv not found at {CSV_PATH}!")

CAREGIVER_DF = pd.read_csv(CSV_PATH)

# Clean active flag
CAREGIVER_DF["active"] = CAREGIVER_DF["active"].astype(str).str.lower().isin(["true", "1"])
# Round-trip through pandas' own JSON serializer so numpy types (int64,
# float64, bool_) become plain Python types the stdlib json encoder can
# handle — FastAPI's response serialization otherwise 500s on this.
CAREGIVER_RECORDS: List[Dict[str, Any]] = json.loads(CAREGIVER_DF.to_json(orient="records"))
CAREGIVER_PROFILES = CAREGIVER_RECORDS

ROLE_MAP = {
    "paramedic_home_visit": "medic",
    "home_nursing": "medic",
    "lab_test_home": "phlebotomist",
    "teleconsultation": "doctor"
}

CARE_TYPE_SKILLS = {
    "home_nursing": ["wound_dressing", "injection_im", "injection_iv", "catheter_care", "vitals_monitoring", "post_surgical_care"],
    "paramedic_home_visit": ["vitals_monitoring", "nebulization", "elderly_care", "bp_sugar_check"],
    "lab_test_home": ["sample_collection", "home_phlebotomy"],
    "teleconsultation": ["teleconsultation", "prescription", "report_review"]
}

PROCEDURE_KEYWORD_SKILLS = [
    ("catheter_care", ["catheter", "nali", "कैथेटर"]),
    ("injection_iv", ["iv", "drip", "infusion", "ड्रिप"]),
    ("wound_dressing", ["dressing", "bedsore", "wound", "patti", "ड्रेसिंग", "घाव", "पट्टी"]),
    ("post_surgical_care", ["stitches", "surgery", "operation", "tanke", "टांके", "सर्जरी", "ऑपरेशन"]),
    ("injection_im", ["injection", "insulin", "sua", "इंजेक्शन", "इंसुलिन"]),
    ("nebulization", ["nebuliz", "nebuliser", "nebulizer", "bhaap"]),
    ("bp_sugar_check", ["bp", "blood pressure", "sugar", "बीपी", "शुगर"]),
    ("elderly_care", ["grandfather", "grandmother", "elderly", "dadaji", "dadi", "dada", "दादा", "दादी", "बुजुर्ग"]),
    ("report_review", ["report", "reports", "रिपोर्ट"]),
    ("prescription", ["prescription", "second opinion", "medicine", "दवा", "सेकंड ओपिनियन"]),
]
# Demo policy: complex procedures need a medic above the base tier.
COMPLEX_SKILLS = {"injection_iv", "catheter_care", "post_surgical_care"}
TIER_RANK = {"base": 0, "standard": 1, "advanced": 2, "expert": 3}
ACTIVE_RECORDS = [record for record in CAREGIVER_RECORDS if record.get("active")]
MIN_RATING = min(float(record["rating"]) for record in CAREGIVER_RECORDS)
MAX_RATING = max(float(record["rating"]) for record in CAREGIVER_RECORDS)
MAX_RADIUS_KM = max(float(record["max_radius_km"]) for record in CAREGIVER_RECORDS)
IST = timezone(timedelta(hours=5, minutes=30))


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _has_term(text: str, term: str) -> bool:
    if re.search(r"[\u0900-\u097F]", term):
        return term in text
    return re.search(r"(?<![a-z])" + re.escape(term), text) is not None


def extract_target_procedure_skill(user_input: str, care_type: Optional[str] = None) -> Optional[str]:
    text = (user_input or "").lower()
    allowed = set(CARE_TYPE_SKILLS.get(care_type, [])) if care_type else None
    for skill, keywords in PROCEDURE_KEYWORD_SKILLS:
        if allowed is not None and skill not in allowed:
            continue
        if any(_has_term(text, keyword) for keyword in keywords):
            return skill
    return None


def preferred_language(user_language: str) -> str:
    return "English" if (user_language or "").strip().lower() in {"english", "en"} else "Hindi"


def _minutes(value: str) -> int:
    hours, minutes = str(value).split(":")
    return int(hours) * 60 + int(minutes)


def next_slot(free_from: str, free_until: str, now: datetime, urgency: Optional[str]) -> Tuple[datetime, bool]:
    """Return the earliest start inside the caregiver's IST window and whether it is today."""
    start, end = _minutes(free_from), _minutes(free_until)
    current = now.hour * 60 + now.minute
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    earliest = max(start, current + 30)
    if earliest <= end - 30:
        return today + timedelta(minutes=earliest), True
    return today + timedelta(days=1, minutes=start), False


def match_caregivers(
    care_type: Optional[str],
    user_location: Optional[Location],
    user_language: str = "auto",
    user_input: str = "",
    urgency: Optional[str] = None,
    now: Optional[datetime] = None,
) -> Tuple[List[CaregiverMatch], Optional[str]]:
    """Filter to eligible caregivers, then rank: language 0.35, proximity 0.30, skill 0.20, rating 0.15."""
    if not care_type or care_type == "emergency_112":
        return [], None
    target_role = ROLE_MAP.get(care_type)
    if not target_role:
        return [], None

    now = (now or datetime.now(IST)).astimezone(IST)
    language = preferred_language(user_language)
    required_skill = extract_target_procedure_skill(user_input, care_type)
    hard_skill = required_skill if required_skill not in {"elderly_care", "report_review", "prescription"} else None
    care_skills = set(CARE_TYPE_SKILLS.get(care_type, []))
    virtual = target_role == "doctor"
    rejected = {"radius": 0, "skill": 0, "tier": 0}
    eligible = []

    for cg in CAREGIVER_RECORDS:
        if not cg.get("active", True) or str(cg.get("role", "")).lower() != target_role:
            continue
        skills = {s.strip() for s in str(cg.get("skills", "")).split(";") if s.strip()}
        languages = [l.strip() for l in str(cg.get("languages", "")).split(";") if l.strip()]
        if not skills & care_skills or (hard_skill and hard_skill not in skills):
            rejected["skill"] += 1
            continue
        tier = str(cg.get("tier") or "").lower()
        if hard_skill in COMPLEX_SKILLS and TIER_RANK.get(tier, 0) < TIER_RANK["standard"]:
            rejected["tier"] += 1
            continue
        radius = float(cg.get("max_radius_km") or 10.0)
        distance = None
        if user_location and not virtual:
            distance = haversine_distance(user_location.lat, user_location.lng, float(cg["base_lat"]), float(cg["base_lng"]))
            if distance > radius:
                rejected["radius"] += 1
                continue

        rating = float(cg.get("rating") or 4.0)
        # Hindi is the shared language across Delhi NCR; an exact preference match breaks ties.
        exact_language = language in languages
        language_score = 0.35 if exact_language or "Hindi" in languages else 0.0
        proximity_score = 0.30 if virtual else (0.30 * max(0.0, 1 - distance / MAX_RADIUS_KM) if distance is not None else 0.0)
        skill_score = 0.20 if (required_skill in skills if required_skill else True) else 0.10
        rating_score = 0.15 * (rating - MIN_RATING) / (MAX_RATING - MIN_RATING) if MAX_RATING > MIN_RATING else 0.15
        score = min(0.99, round(language_score + proximity_score + skill_score + rating_score, 2))
        slot, today = next_slot(cg.get("free_from", "09:00"), cg.get("free_until", "18:00"), now, urgency)

        spoken = language if language in languages else (languages[0] if languages else "Hindi")
        where = "virtual consult" if virtual else (f"{distance:.1f} km away" if distance is not None else "distance not verified (location not shared)")
        reason = f"{spoken}-speaking, {where}, free {cg.get('free_from')}–{cg.get('free_until')}"
        if virtual:
            reason += f", ★{rating:.1f}"
        if required_skill and required_skill in skills:
            reason += f", skilled in {required_skill.replace('_', ' ')}"
        if tier and not virtual:
            reason += f", {tier} tier"
        if not today:
            reason += " (next slot tomorrow)"
        eligible.append({"cg": cg, "score": score, "exact_language": exact_language, "reason": reason, "distance": distance if distance is not None else 0.0, "slot": slot, "today": today})

    same_day = urgency == "same_day"
    if same_day and any(c["today"] for c in eligible):
        eligible = [c for c in eligible if c["today"]]
    eligible.sort(key=lambda c: (-c["score"], not c["exact_language"], c["distance"], c["cg"]["caregiver_id"]))
    matches = [
        CaregiverMatch(caregiver_id=c["cg"]["caregiver_id"], score=c["score"], reason=c["reason"], next_available=c["slot"].isoformat(timespec="minutes"))
        for c in eligible[:3]
    ]

    note = None
    if not matches:
        parts = [f"{count} {label}" for label, count in (("outside service radius", rejected["radius"]), (f"without required skill ({(hard_skill or care_type).replace('_', ' ')})", rejected["skill"]), ("below required tier", rejected["tier"])) if count]
        note = f"No eligible {target_role} found for this request" + (f": {', '.join(parts)}." if parts else ".") + " Try a teleconsultation, or call 112 if symptoms worsen."
    elif same_day and not any(c["today"] for c in eligible):
        note = "No eligible caregiver is free later today; showing the earliest slots tomorrow. Seek urgent care if symptoms worsen."
    elif user_location is None and not virtual:
        note = "Location not shared, so service radius and distance could not be verified."
    return matches, note

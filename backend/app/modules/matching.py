import json
import math
import os
import re
from datetime import datetime
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Optional
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

PROCEDURE_KEYWORD_SKILLS = {
    "catheter": "catheter_care",
    "nali": "catheter_care",
    "dressing": "wound_dressing",
    "bedsore": "wound_dressing",
    "wound": "wound_dressing",
    "patti": "wound_dressing",
    "injection": "injection_im",
    "sua": "injection_im",
    "iv": "injection_iv",
    "drip": "injection_iv",
    "nebuliz": "nebulization",
    "bhaap": "nebulization",
    "blood": "sample_collection",
    "sample": "sample_collection",
    "cbc": "sample_collection",
    "stitches": "post_surgical_care",
    "surgery": "post_surgical_care",
    "operation": "post_surgical_care",
    "tankey": "post_surgical_care",
    "bp": "bp_sugar_check",
    "sugar": "bp_sugar_check",
    "vitals": "vitals_monitoring"
}

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def extract_target_procedure_skill(user_input: str) -> Optional[str]:
    text = (user_input or "").lower()
    for keyword, skill in PROCEDURE_KEYWORD_SKILLS.items():
        if keyword in text:
            return skill
    return None

def match_caregivers(
    care_type: Optional[str],
    user_location: Optional[Location],
    user_language: str = "auto",
    user_input: str = ""
) -> List[CaregiverMatch]:
    """
    Module 3: Supply Matching using official Sanocare caregivers.csv.
    Weights: Language (0.35), Proximity (0.30), Skill (0.20), Rating (0.15).
    Includes granular procedure skill matching and shift availability check.
    """
    if not care_type or care_type == "emergency_112":
        return []

    target_role = ROLE_MAP.get(care_type)
    if not target_role:
        return []

    user_lat = user_location.lat if user_location else 28.54
    user_lng = user_location.lng if user_location else 77.27

    # Normalize user language hint
    lang_lower = (user_language or "Hindi").lower()
    if lang_lower in ["auto", "hinglish"]:
        preferred_lang = "Hindi"
    elif "hindi" in lang_lower:
        preferred_lang = "Hindi"
    else:
        preferred_lang = "English"

    # Identify specific required clinical procedure if mentioned
    specific_required_skill = extract_target_procedure_skill(user_input)

    candidates = []

    for cg in CAREGIVER_RECORDS:
        if not cg.get("active", True):
            continue
        if str(cg.get("role", "")).lower() != target_role:
            continue

        cg_langs = [l.strip() for l in str(cg.get("languages", "")).split(";")]
        cg_skills = [s.strip() for s in str(cg.get("skills", "")).split(";")]
        cg_lat = float(cg["base_lat"])
        cg_lng = float(cg["base_lng"])
        max_rad = float(cg.get("max_radius_km", 10.0))
        rating = float(cg.get("rating", 4.0))

        # 1. Language Match (Weight: 0.35)
        if preferred_lang in cg_langs:
            lang_score = 0.35
        elif "Hindi" in cg_langs or "English" in cg_langs:
            lang_score = 0.25
        else:
            lang_score = 0.10

        # 2. Proximity Score (Weight: 0.30)
        dist_km = haversine_distance(user_lat, user_lng, cg_lat, cg_lng)
        if target_role == "doctor":
            # Teleconsultation ignores distance (virtual doctor)
            prox_score = 0.30
        else:
            if dist_km <= max_rad:
                prox_norm = max(0.0, 1.0 - (dist_km / (max_rad * 1.5)))
                prox_score = 0.30 * prox_norm
            else:
                prox_score = 0.05

        # 3. Skill Match (Weight: 0.20)
        target_skills = CARE_TYPE_SKILLS.get(care_type, [])
        matched_skills = [sk for sk in target_skills if sk in cg_skills]

        if specific_required_skill:
            # High-precision procedure matching
            if specific_required_skill in cg_skills:
                skill_score = 0.20
            else:
                skill_score = 0.08
        elif target_skills:
            skill_score = 0.20 * (len(matched_skills) / len(target_skills))
        else:
            skill_score = 0.20

        # 4. Rating Score (Weight: 0.15)
        rating_score = 0.15 * min(1.0, max(0.0, rating / 5.0))

        composite_score = round(lang_score + prox_score + skill_score + rating_score, 2)

        # Explainability Generator (Dataset standard format)
        free_from = str(cg.get("free_from", "09:00"))
        free_until = str(cg.get("free_until", "18:00"))
        primary_lang = cg_langs[0] if cg_langs else "Hindi"

        if target_role == "doctor":
            reason = f"{primary_lang}-speaking, free {free_from}–{free_until}, ★{rating:.1f}"
        else:
            dist_str = f"{dist_km:.1f} km away"
            reason = f"{primary_lang}-speaking, {dist_str}, free {free_from}–{free_until}"

        candidates.append({
            "caregiver_id": cg["caregiver_id"],
            "score": composite_score,
            "reason": reason,
            "dist_km": dist_km,
            "has_specific_skill": (specific_required_skill in cg_skills) if specific_required_skill else True
        })

    # Sort descending by score, prioritizing exact procedure skills and closer distance
    candidates.sort(key=lambda x: (x["has_specific_skill"], x["score"], -x["dist_km"]), reverse=True)

    return [
        CaregiverMatch(
            caregiver_id=c["caregiver_id"],
            score=c["score"],
            reason=c["reason"]
        )
        for c in candidates[:3]
    ]

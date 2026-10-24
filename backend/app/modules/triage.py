import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from groq import Groq
from app.schemas import ExtractedEntities
from app.config import GROQ_API_KEY, DATA_DIR

TAXONOMY_PATH = DATA_DIR / "taxonomy.json"

with open(TAXONOMY_PATH, "r", encoding="utf-8") as f:
    TAXONOMY_DATA = json.load(f)

RED_FLAG_TRIGGERS: Dict[str, List[str]] = {key: list(value) for key, value in TAXONOMY_DATA.get("red_flag_triggers", {}).items()}
# Common inflections missing from the provided taxonomy; safety favours recall.
SUPPLEMENTARY_TRIGGERS: Dict[str, List[str]] = {
    "breathlessness": ["breathless", "short of breath", "can't breathe", "cannot breathe", "trouble breathing",
                       "saans phool", "saans phul", "saans nahi le pa", "saans lene mein taklif", "सांस फूल", "सांस नहीं ले पा"],
    "chest_pain": ["chest tightness", "seene mein dard", "seene me dard", "सीने में तेज दर्द"],
    "unconsciousness": ["passed out", "hosh nahi", "होश नहीं"],
}
for _flag, _terms in SUPPLEMENTARY_TRIGGERS.items():
    RED_FLAG_TRIGGERS.setdefault(_flag, [])
    RED_FLAG_TRIGGERS[_flag].extend(term for term in _terms if term not in RED_FLAG_TRIGGERS[_flag])

POSITIVE_EMERGENCY_NEGATIONS = [
    "saans nahi", "jawab nahi", "response nahi", "ruk nahi", "nahi ruk", "nahi aa rahi",
    "nahi de rahe", "hosh nahi", "nahi ruk raha", "सांस नहीं", "जवाब नहीं", "नहीं रुक"
]

def get_groq_client() -> Optional[Groq]:
    if not GROQ_API_KEY:
        return None
    try:
        return Groq(api_key=GROQ_API_KEY)
    except Exception:
        return None

def is_negated_match(full_text: str, start_idx: int, end_idx: int) -> bool:
    """
    Checks if a detected red flag keyword is actually negated (e.g. 'no chest pain', 'chest pain nahi hai').
    Protects true emergency phrases that contain 'nahi' (e.g. 'saans nahi aa rahi', 'jawab nahi de rahe').
    """
    matched_text = full_text[start_idx:end_idx].lower()
    if any(p in matched_text for p in POSITIVE_EMERGENCY_NEGATIONS):
        return False

    preceding = full_text[max(0, start_idx - 60):start_idx].lower()
    following = full_text[end_idx:min(len(full_text), end_idx + 30)].lower()
    if re.search(r"\b(?:no|without|denies|denied|not having|not|do not have|does not have|negative for|bina|zero)\s+(?:(?:a|an|any|current|new|the|severe|significant)\s+)*$", preceding):
        return True
    if re.search(r"(?:बिना|कोई नहीं)\s*$", preceding):
        return True
    if re.search(r"^\s*(?:(?:is|was|are|hai|hain|bilkul)\s+)*(?:nahi|nahin|nhi|absent|negative)\b", following):
        return True
    if re.search(r"^\s*(?:नहीं है|नहीं था)", following):
        return True

    return False

def detect_red_flags(raw_input: str, symptoms: List[str]) -> List[str]:
    """
    Deterministic rule-based safety net against the controlled vocabulary.
    Includes smart negation detection (e.g. 'no chest pain' or 'chest pain nahi hai').
    Zero hallucination on critical red flags.
    """
    detected: List[str] = []
    combined_text = f"{raw_input.lower()} {' '.join(symptoms).lower()}"

    for flag_name, trigger_phrases in RED_FLAG_TRIGGERS.items():
        for trigger in trigger_phrases:
            trigger_lower = trigger.lower()

            if any(ord(c) > 127 for c in trigger_lower):
                idx = combined_text.find(trigger_lower)
                while idx != -1:
                    end_idx = idx + len(trigger_lower)
                    if not is_negated_match(combined_text, idx, end_idx):
                        if flag_name not in detected:
                            detected.append(flag_name)
                        break
                    idx = combined_text.find(trigger_lower, end_idx)
            else:
                pattern = r"\b" + re.escape(trigger_lower) + r"\b"
                for match in re.finditer(pattern, combined_text):
                    if not is_negated_match(combined_text, match.start(), match.end()):
                        if flag_name not in detected:
                            detected.append(flag_name)
                        break

    return detected

TRIAGE_SYSTEM_PROMPT = """
You are the Clinical Triage Engine for Sanocare CareCompass.
Analyze the extracted patient condition and map it strictly to the official Care Taxonomy.

Exact allowed care_type values:
- "emergency_112": Life threatening red flags (e.g. chest pain, breathing difficulty, severe bleeding, unconsciousness).
- "home_nursing": Nursing procedures at home (dressing, wound care, injection, IV, catheter, vitals monitoring).
- "lab_test_home": Diagnostic lab tests at home (blood test, sample collection, CBC, sugar test, phlebotomy).
- "teleconsultation": Virtual doctor consult for mild acidity, gas, rash, mild headache, general advice.
- "paramedic_home_visit": Physical home assessment by a Medic for acute symptoms (fever, weakness, elderly illness).

Exact allowed urgency values:
- "emergency" (For emergency_112)
- "same_day" (For acute needs)
- "scheduled" (For planned tests or non-urgent nursing)

Respond strictly in valid JSON matching this schema:
{
  "care_type": "paramedic_home_visit | home_nursing | lab_test_home | teleconsultation | emergency_112",
  "urgency": "emergency | same_day | scheduled",
  "reasoning": "Short justification string"
}
"""

async def evaluate_triage(
    raw_input: str,
    entities: ExtractedEntities
) -> Dict[str, Any]:
    """
    Module 2: Triage Engine.
    1. Deterministic safety net for red flags (with negation awareness).
    2. If red flag present -> care_type="emergency_112", urgency="emergency".
    3. If safe -> Groq LLM maps to official taxonomy, with robust deterministic fallback.
    """
    # 1. Deterministic Rule-Based Red Flags with Negation Check
    red_flags = detect_red_flags(raw_input, entities.symptoms)

    if red_flags:
        flags_formatted = ", ".join(red_flags)
        return {
            "care_type": "emergency_112",
            "urgency": "emergency",
            "red_flags": red_flags,
            "reasoning": f"Potential emergency warning signs detected ({flags_formatted}). Call 112 now; no service has been contacted by this app.",
            "is_emergency": True
        }

    # 2. Fast clinical checks for specific procedures
    raw_lower = raw_input.lower()
    if any(k in raw_lower for k in ["blood test", "cbc", "sample", "phlebotomy", "sugar test", "lipid profile"]):
        return {
            "care_type": "lab_test_home",
            "urgency": "scheduled",
            "red_flags": [],
            "reasoning": "Home diagnostic sample collection requested.",
            "is_emergency": False
        }

    if any(k in raw_lower for k in ["dressing", "injection", "wound", "catheter", "patti", "bedsore", "stitches", "sua"]):
        return {
            "care_type": "home_nursing",
            "urgency": "same_day",
            "red_flags": [],
            "reasoning": "Specific nursing procedure requested; Medic home visit; urgency assessed as same_day.",
            "is_emergency": False
        }

    # 3. LLM Triage using Groq (with zero-downtime fallback)
    client = get_groq_client()
    if client:
        user_prompt = f"""
Patient: {entities.patient}
Symptoms: {json.dumps(entities.symptoms)}
Duration: {entities.duration}
User Query: {raw_input}
"""
        models_to_try = [
            "openai/gpt-oss-120b",
            "qwen/qwen3.8-27b",
            "llama-3.3-70b-versatile"
        ]
        for model_name in models_to_try:
            try:
                completion = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    timeout=5.0
                )
                result = json.loads(completion.choices[0].message.content)
                care_type = result.get("care_type", "paramedic_home_visit")
                urgency = result.get("urgency", "same_day")
                reasoning = result.get("reasoning", f"{', '.join(entities.symptoms)} assessed as {urgency}")
                return {
                    "care_type": care_type,
                    "urgency": urgency,
                    "red_flags": [],
                    "reasoning": reasoning,
                    "is_emergency": False
                }
            except Exception:
                continue

    # 4. Deterministic clinical fallback (guarantees zero 500 errors)
    if any(k in raw_lower for k in ["acidity", "gas", "rash", "headache", "mild", "dawa", "consult", "doctor chahiye"]):
        return {
            "care_type": "teleconsultation",
            "urgency": "same_day",
            "red_flags": [],
            "reasoning": f"Non-urgent query suitable for a virtual doctor consult; urgency assessed as same_day.",
            "is_emergency": False
        }

    return {
        "care_type": "paramedic_home_visit",
        "urgency": "same_day",
        "red_flags": [],
        "reasoning": f"Acute presentation of {', '.join(entities.symptoms) or 'symptoms'} for {entities.duration or 'unspecified duration'}.",
        "is_emergency": False
    }

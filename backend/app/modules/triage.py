import json
import re
from pathlib import Path
from typing import List, Dict, Any
from groq import Groq
from app.schemas import ExtractedEntities
from app.config import GROQ_API_KEY

TAXONOMY_PATH = Path(__file__).resolve().parent.parent / "data" / "taxonomy.json"

with open(TAXONOMY_PATH, "r", encoding="utf-8") as f:
    TAXONOMY_DATA = json.load(f)

RED_FLAG_TRIGGERS: Dict[str, List[str]] = TAXONOMY_DATA.get("red_flag_triggers", {})

def get_groq_client() -> Groq:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set. Please set your key in backend/.env")
    return Groq(api_key=GROQ_API_KEY)

def detect_red_flags(raw_input: str, symptoms: List[str]) -> List[str]:
    """
    Deterministic rule-based safety net against the controlled vocabulary.
    Zero hallucination on critical red flags.
    """
    detected: List[str] = []
    combined_text = f"{raw_input.lower()} {' '.join(symptoms).lower()}"

    for flag_name, trigger_phrases in RED_FLAG_TRIGGERS.items():
        for trigger in trigger_phrases:
            pattern = r"\b" + re.escape(trigger.lower()) + r"\b"
            if re.search(pattern, combined_text):
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
    1. Deterministic safety net for red flags.
    2. If red flag present -> care_type="emergency_112", urgency="emergency".
    3. If safe -> Groq LLM maps to official taxonomy.
    """
    # 1. Deterministic Rule-Based Red Flags
    red_flags = detect_red_flags(raw_input, entities.symptoms)

    if red_flags:
        flags_formatted = ", ".join(red_flags)
        return {
            "care_type": "emergency_112",
            "urgency": "emergency",
            "red_flags": red_flags,
            "reasoning": f"Critical emergency red flags detected ({flags_formatted}). Escalated to 112 emergency services.",
            "is_emergency": True
        }

    # 2. Heuristic fast checks for known specific services
    raw_lower = raw_input.lower()
    if any(k in raw_lower for k in ["blood test", "cbc", "sample", "phlebotomy", "sugar test", "lipid profile"]):
        return {
            "care_type": "lab_test_home",
            "urgency": "scheduled",
            "red_flags": [],
            "reasoning": "Home diagnostic sample collection requested.",
            "is_emergency": False
        }

    if any(k in raw_lower for k in ["dressing", "injection", "wound", "catheter", "patti", "bedsore", "stitches"]):
        return {
            "care_type": "home_nursing",
            "urgency": "same_day",
            "red_flags": [],
            "reasoning": "Specific nursing procedure requested; Medic home visit; urgency assessed as same_day.",
            "is_emergency": False
        }

    # 3. LLM Triage using Groq
    client = get_groq_client()
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
                temperature=0.1
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

    # Deterministic clinical fallback
    return {
        "care_type": "paramedic_home_visit",
        "urgency": "same_day",
        "red_flags": [],
        "reasoning": f"Acute presentation of {', '.join(entities.symptoms)} for {entities.duration or 'unspecified duration'}.",
        "is_emergency": False
    }

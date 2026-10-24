import json
import re
from typing import Optional, List, Dict, Any
from groq import Groq
from app.schemas import ExtractedEntities
from app.config import GROQ_API_KEY

INTAKE_SYSTEM_PROMPT = """
You are the Smart Intake Engine for Sanocare CareCompass.
Your task is to analyze user requests (in Hinglish, Hindi, or English) and extract structured clinical information or ask ONE follow-up question if information is insufficient.

Services offered:
1. "emergency_112": Emergency red flags (chest pain, breathlessness, collapse, heavy bleeding).
2. "home_nursing": Nursing procedures (injection, dressing, catheter, wound, vitals).
3. "lab_test_home": Home diagnostic tests (blood test, CBC, sugar, sample collection).
4. "teleconsultation": Virtual doctor consultation (mild acidity, gas, rash, mild headache).
5. "paramedic_home_visit": Physical home checkup by a Medic (fever, weakness, acute illness).

Decision Criteria:
- IF the user request is vague, missing the core concern or who it is for (e.g., "doctor chahiye", "nurse bhej do", "I want to book something for my mother", "need medical help"):
  - "is_complete": false
  - "follow_up_question": Ask which care service is needed, with simple examples (e.g., "How can we help today? You can request a home checkup for fever, nursing for wound dressing, a lab test at home, or a doctor consultation. Tell us what you need and whether the care is for you or someone else."). Do not invent the user's identity, location, or address.
- IF the user mentions an emergency OR specifies their concern / symptoms / procedure (e.g. "chest pain ho raha hai", "doctor prescribed an injection, can someone come home", "Grandmother has a bedsore that needs dressing", "papa ko do din se bukhar hai aur khansi bhi"):
  - "is_complete": true
  - "follow_up_question": null

Respond strictly in valid JSON matching this schema:
{
  "patient": "string or null",
  "symptoms": ["string"],
  "duration": "string or null",
  "is_complete": true or false,
  "follow_up_question": "string or null"
}
"""

def get_groq_client() -> Optional[Groq]:
    if not GROQ_API_KEY:
        return None
    try:
        return Groq(api_key=GROQ_API_KEY)
    except Exception:
        return None

def fallback_heuristic_extraction(user_input: str) -> ExtractedEntities:
    """Zero-downtime offline heuristic extraction if Groq API is unreachable."""
    text = (user_input or "").lower().strip()

    # Vague query detection
    vague_phrases = ["doctor chahiye", "nurse bhej do", "help chahiye", "madad", "book something", "need help", "booking", "consult"]
    is_vague = any(p in text for p in vague_phrases) and len(text.split()) <= 4

    duration = re.search(r"\b(?:\d+|one|two|three|four|five|ek|do|teen)\s*(?:days?|hours?|weeks?|months?|din|ghante)\b", text)
    if is_vague or len(text.split()) <= 2:
        return ExtractedEntities(
            patient=None,
            symptoms=[],
            duration=duration.group(0) if duration else None,
            is_complete=False,
            follow_up_question="How can we help today? You can request a home checkup for fever, nursing for wound dressing, a lab test at home, or a doctor consultation. Tell us what you need and whether the care is for you or someone else."
        )

    # Detect patient
    patient = "patient"
    if any(k in text for k in ["papa", "father", "dad"]):
        patient = "father"
    elif any(k in text for k in ["mummy", "mother", "mom", "maa"]):
        patient = "mother"
    elif any(k in text for k in ["dada", "dadi", "grandmother", "grandfather"]):
        patient = "grandparent"
    elif any(k in text for k in ["mujhe", "mera", "meri", "i have", "my"]):
        patient = "self"

    # Detect symptoms
    symptoms = []
    for s_kw in ["fever", "bukhar", "cough", "khansi", "pain", "dard", "bedsore", "dressing", "injection", "vomiting", "weakness"]:
        if s_kw in text:
            symptoms.append(s_kw)

    return ExtractedEntities(
        patient=patient,
        symptoms=symptoms or ["general symptom"],
        duration=duration.group(0) if duration else None,
        is_complete=True,
        follow_up_question=None
    )

async def extract_intake(
    user_input: str,
    language: str = "auto",
    conversation_history: Optional[List[Dict[str, Any]]] = None
) -> ExtractedEntities:
    """
    Module 1: Smart Intake using Groq LLM with robust offline fallback.
    """
    client = get_groq_client()

    if client:
        messages = [
            {"role": "system", "content": INTAKE_SYSTEM_PROMPT}
        ]

        # Append multi-turn history if present
        if conversation_history:
            for turn in conversation_history:
                role = turn.get("role", "user")
                content = turn.get("content", turn.get("user_input", turn.get("text", "")))
                if content:
                    messages.append({"role": role, "content": str(content)})

        # Append current turn
        messages.append({
            "role": "user",
            "content": f"User Input: {user_input}\nLanguage Hint: {language}"
        })

        models_to_try = [
            "openai/gpt-oss-120b",
            "qwen/qwen3.8-27b",
            "llama-3.3-70b-versatile"
        ]

        for model_name in models_to_try:
            try:
                completion = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=400,
                    timeout=5.0
                )
                raw = completion.choices[0].message.content
                parsed = json.loads(raw)

                return ExtractedEntities(
                    patient=parsed.get("patient"),
                    symptoms=parsed.get("symptoms", []),
                    duration=parsed.get("duration"),
                    is_complete=bool(parsed.get("is_complete", False)),
                    follow_up_question=parsed.get("follow_up_question")
                )
            except Exception:
                continue

    # Graceful fallback (guarantees zero demo failures)
    return fallback_heuristic_extraction(user_input)

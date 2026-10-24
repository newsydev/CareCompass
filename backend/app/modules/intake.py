import json
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
  - "follow_up_question": Generate a polite question asking for the main concern/symptom and who it is for (e.g., "Happy to help — who is this for and what's the main concern (fever, injury, a lab test, or just a doctor consult)?")
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

def get_groq_client() -> Groq:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not set. Please set your key in backend/.env")
    return Groq(api_key=GROQ_API_KEY)

async def extract_intake(
    user_input: str,
    language: str = "auto",
    conversation_history: Optional[List[Dict[str, Any]]] = None
) -> ExtractedEntities:
    """
    Module 1: Smart Intake using Groq LLM with few-shot context from Sanocare dataset.
    """
    client = get_groq_client()

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
    last_err = None

    for model_name in models_to_try:
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=400
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
        except Exception as e:
            last_err = e
            continue

    raise RuntimeError(f"Groq LLM extraction failed: {last_err}")

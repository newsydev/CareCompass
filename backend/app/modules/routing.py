"""Deterministic multilingual care routing and targeted follow-up questions.

Care navigation only: this module chooses a service type and never diagnoses.
"""
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

CONTROLLED_RED_FLAGS = (
    "chest_pain", "breathlessness", "unconsciousness", "severe_bleeding", "stroke_symptoms",
    "seizure", "high_fever_infant", "suicidal_ideation", "severe_dehydration",
    "poisoning_or_overdose", "life_threatening_violence",
)
SAFETY_FLAG_TO_CONTRACT = {"low_reported_oxygen": "breathlessness"}
MAX_FOLLOW_UPS = 2

HINGLISH_MARKERS = {
    "hai", "hain", "ko", "ka", "ki", "ke", "chahiye", "ghar", "pe", "karna", "karni", "karwana",
    "mujhe", "mera", "meri", "nahi", "aur", "se", "din", "mummy", "papa", "bukhar", "khansi",
    "lagwana", "dikhana", "baat", "kuch", "subah", "kal", "bhi", "lekar", "baare", "wo", "raha", "rahi",
}

# Ordered: specific procedures first, then symptom-led and generic consult requests.
ROUTE_RULES = [
    ("lab_test_home", "scheduled", "Diagnostic test requested; home sample collection", [
        "blood test", "cbc", "thyroid", "sample", "full body", "sugar test", "lipid", "phlebotom",
        "home collection", "lab test", "khoon ki jaanch", "test ghar", "टेस्ट", "सैंपल", "सीबीसी",
        "थायराइड", "खून की जांच", "जांच घर",
    ]),
    ("home_nursing", "same_day", "Specific nursing procedure requested; Medic home visit", [
        "injection", "insulin", "dressing", "bedsore", "wound", "catheter", "patti", "stitches",
        "iv drip", "drip", "nebuliz", "suture", "इंजेक्शन", "इंसुलिन", "ड्रेसिंग", "घाव", "पट्टी",
        "कैथेटर", "टांके", "ड्रिप",
    ]),
    ("teleconsultation", "same_day", "Non-urgent query suitable for a virtual doctor consult", [
        "acidity", "gas", "rash", "second opinion", "report", "reports", "prescription", "medicine pe",
        "mild headache", "एसिडिटी", "गैस", "रिपोर्ट", "सेकंड ओपिनियन", "दवा पर", "रैश",
    ]),
    ("paramedic_home_visit", "same_day", "General complaint suitable for a Medic home visit with optional virtual doctor consult", [
        "fever", "bukhar", "cough", "khansi", "bp", "blood pressure", "check-up", "checkup",
        "check up", "weak", "not eating", "vomit", "ulti", "dikhana", "home visit", "dizzy",
        "chakkar", "pain", "dard", "diarrhea", "diarrhoea", "loose motion", "dast", "body ache", "sore throat", "cold", "swelling", "बुखार", "खांसी", "बीपी", "शुगर", "चेक", "कमजोर", "उल्टी",
        "दर्द", "चक्कर", "दिखाना",
    ]),
    ("teleconsultation", "same_day", "Non-urgent query suitable for a virtual doctor consult", [
        "consult", "salah", "talk to a doctor", "doctor se baat", "सलाह", "डॉक्टर से बात",
    ]),
]

PATIENT_TERMS = {
    "father": ["father", "papa", "dad", "पापा", "पिता"],
    "mother": ["mother", "mummy", "mom", "maa", "माँ", "मां", "मम्मी"],
    "grandparent": ["grandmother", "grandfather", "dadi", "dada", "nani", "nana", "दादी", "दादा", "नानी", "नाना"],
    "child": ["child", "baby", "bacche", "bachcha", "son", "daughter", "बच्चे", "बच्चा", "बेटा", "बेटी"],
    "spouse": ["wife", "husband", "patni", "pati", "पत्नी", "पति"],
    "self": ["i have", "i am", "mujhe", "my own", "mera", "meri", "मुझे", "मेरा", "मेरी"],
}


DURATION_PATTERN = re.compile(r"(\d+|one|two|three|ek|do|teen|दो|तीन|एक)\s*(days?|hours?|weeks?|din|ghante|दिन|घंटे)|since|kal se|subah se|सुबह से", re.I)
VAGUE_PATTERN = re.compile(r"book something|kuch book|कुछ बुक|need help|help chahiye|मदद चाहिए|anyone there", re.I)


@dataclass
class RouteDecision:
    care_type: Optional[str]
    urgency: Optional[str]
    reasoning: Optional[str]
    follow_up_question: Optional[str]
    language: str
    patient: Optional[str]
    matched_terms: List[str]
    concern_text: str


def detect_language(text: str, hint: Optional[str] = "auto") -> str:
    normalized_hint = (hint or "auto").strip().lower()
    if normalized_hint in {"hi", "hindi"}:
        return "Hindi"
    if normalized_hint in {"en", "english"}:
        return "English"
    if normalized_hint == "hinglish":
        return "Hinglish"
    if re.search(r"[\u0900-\u097F]", text or ""):
        return "Hindi"
    words = set(re.findall(r"[a-z]+", (text or "").lower()))
    return "Hinglish" if len(words & HINGLISH_MARKERS) >= 2 else "English"


def _contains(text: str, term: str) -> bool:
    if re.search(r"[\u0900-\u097F]", term):
        return term in text
    return re.search(r"(?<![a-z])" + re.escape(term) + r"(?![a-z])", text) is not None


def classify_text(text: str) -> Optional[tuple]:
    lowered = (text or "").lower().replace("\u2019", "'")
    for care_type, urgency, reason, terms in ROUTE_RULES:
        hits = [term for term in terms if _contains(lowered, term)]
        if hits:
            return care_type, urgency, reason, hits
    return None


def detect_patient(text: str) -> Optional[str]:
    lowered = (text or "").lower()
    for patient, terms in PATIENT_TERMS.items():
        if any(_contains(lowered, term) for term in terms):
            return patient
    return None


def follow_up_question(language: str, patient: Optional[str], attempt: int) -> str:
    if attempt >= 1:
        prompts = {
            "Hindi": "कृपया एक मुख्य ज़रूरत चुनें: बुखार/कमज़ोरी के लिए घर पर जांच, इंजेक्शन या ड्रेसिंग, घर से खून की जांच, या डॉक्टर से ऑनलाइन सलाह।",
            "Hinglish": "Bas ek main zaroorat batayein: bukhar/weakness ke liye ghar pe checkup, injection ya dressing, ghar se blood test, ya doctor se online consult.",
            "English": "Please pick the closest need: a home check-up for fever or weakness, an injection or dressing, a home blood test, or an online doctor consult.",
        }
        return prompts[language]
    if patient:
        prompts = {
            "Hindi": "ज़रूर मदद करेंगे। मुख्य परेशानी क्या है और कब से है? जैसे: 2 दिन से बुखार, घाव की ड्रेसिंग, घर से खून की जांच, या डॉक्टर से सलाह।",
            "Hinglish": "Zaroor madad karenge. Main problem kya hai aur kab se hai? Jaise: 2 din se bukhar, wound dressing, ghar se blood test, ya doctor se consult.",
            "English": "Happy to help. What is the main concern, and since when? For example: fever for 2 days, wound dressing, a home blood test, or a doctor consult.",
        }
        return prompts[language]
    prompts = {
        "Hindi": "नमस्ते! मदद किसके लिए चाहिए, और मुख्य परेशानी क्या है — बुखार, नर्सिंग (इंजेक्शन/ड्रेसिंग), लैब टेस्ट, या डॉक्टर से सलाह?",
        "Hinglish": "Namaste! Madad kiske liye chahiye, aur main concern kya hai — bukhar, nursing (injection/dressing), lab test, ya doctor consult?",
        "English": "Happy to help. Who is this for, and what's the main concern — fever, a nursing need (injection/dressing), a lab test, or a doctor consult?",
    }
    return prompts[language]


def _turn_text(turn: Dict[str, Any]) -> str:
    return str(turn.get("content") or turn.get("text") or turn.get("user_input") or "")


def route_request(user_input: str, history: Optional[List[Dict[str, Any]]] = None, language_hint: Optional[str] = "auto") -> RouteDecision:
    """Route the latest concern first so earlier vague turns cannot override it."""
    history = history or []
    prior_user = [_turn_text(turn) for turn in history if turn.get("role") == "user"]
    language = detect_language(user_input, language_hint)
    patient = detect_patient(user_input) or next((detect_patient(text) for text in reversed(prior_user) if detect_patient(text)), None)

    for text in [user_input, *reversed(prior_user)]:
        match = classify_text(text)
        if match:
            care_type, urgency, reason, hits = match
            return RouteDecision(care_type, urgency, f"{reason}; urgency assessed as {urgency}.", None, language, patient, hits, text)

    if DURATION_PATTERN.search(user_input) and not VAGUE_PATTERN.search(user_input):
        return RouteDecision(
            "paramedic_home_visit", "same_day",
            "Ongoing symptom described; a Medic home assessment is the safest non-emergency starting point; urgency assessed as same_day.",
            None, language, patient, [], user_input,
        )

    follow_ups = sum(
        1 for turn in history
        if turn.get("role") == "assistant" and (turn.get("follow_up_ids") or turn.get("follow_up_question"))
    )
    if follow_ups >= MAX_FOLLOW_UPS:
        return RouteDecision(
            "teleconsultation", "same_day",
            "The concern is still unclear after follow-up questions; a virtual doctor can clarify needs safely; urgency assessed as same_day.",
            None, language, patient, [], user_input,
        )
    return RouteDecision(None, None, None, follow_up_question(language, patient, follow_ups), language, patient, [], user_input)


def contract_red_flags(signs: List[str]) -> List[str]:
    flags: List[str] = []
    for sign in signs:
        mapped = SAFETY_FLAG_TO_CONTRACT.get(sign, sign)
        if mapped in CONTROLLED_RED_FLAGS and mapped not in flags:
            flags.append(mapped)
    return flags

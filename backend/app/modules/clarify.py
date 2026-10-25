"""Need-based clarification: answer directly, ask only what is missing, or hand over to routing.

Rules decide WHAT is missing and WHICH questions to ask (deterministic, testable and linked to the
safety rules). The LLM, when configured, is only used to answer general health-information
questions and to read unusual complaints; every LLM output is validated before it is used.

Care navigation only: nothing here diagnoses.
"""
import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, ValidationError

from app.modules.routing import classify_text, detect_language, detect_patient
from app.modules.safety import has_current_term
from app.modules.triage import get_groq_client
from app.schemas import FollowUpOption, FollowUpQuestion, PatientContext

MAX_ROUNDS = 2
MAX_QUESTIONS_PER_ROUND = 2
LLM_TIMEOUT_SECONDS = 8.0
MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "llama-3.3-70b-versatile"]

Lang = str  # "English" | "Hinglish" | "Hindi"


def L(en: str, hl: str, hi: str) -> Dict[str, str]:
    return {"English": en, "Hinglish": hl, "Hindi": hi}


# --------------------------------------------------------------------------- lexicons

SYMPTOMS: Dict[str, List[str]] = {
    "headache": ["headache", "head ache", "sar dard", "sir dard", "sardard", "sar me dard", "migraine",
                 "सिरदर्द", "सर दर्द", "सिर दर्द"],
    "fever": ["fever", "bukhar", "bukhaar", "temperature", "बुखार"],
    "cough": ["cough", "khansi", "khasi", "खांसी"],
    "cold": ["cold", "sardi", "zukam", "runny nose", "blocked nose", "सर्दी", "जुकाम"],
    "sore_throat": ["sore throat", "gala kharab", "gale me dard", "throat pain", "गले में दर्द"],
    "stomach_pain": ["stomach pain", "stomach ache", "pet dard", "pet me dard", "abdominal pain", "tummy ache",
                     "पेट दर्द", "पेट में दर्द"],
    "vomiting": ["vomiting", "vomit", "ulti", "nausea", "matli", "उल्टी"],
    "diarrhea": ["diarrhea", "diarrhoea", "loose motion", "loose motions", "dast", "दस्त"],
    "rash": ["rash", "khujli", "itching", "skin allergy", "रैश", "चकत्ते"],
    "body_pain": ["body pain", "body ache", "badan dard", "joint pain", "back pain", "kamar dard", "muscle pain",
                  "बदन दर्द", "जोड़ों में दर्द", "कमर दर्द"],
    "weakness": ["weakness", "weak", "kamzori", "kamzor", "tired", "tiredness", "थकान", "कमज़ोरी", "कमजोरी"],
    "dizziness": ["dizzy", "dizziness", "chakkar", "चक्कर"],
    "pain": ["pain", "dard", "दर्द"],  # generic: only used when nothing more specific matched
}
GENERIC_SYMPTOM = "pain"
PAIN_LIKE = {"headache", "stomach_pain", "body_pain", "pain", "sore_throat"}

SYMPTOM_NAMES: Dict[str, Dict[str, str]] = {
    "headache": L("headache", "sar dard", "सिरदर्द"),
    "fever": L("fever", "bukhar", "बुखार"),
    "cough": L("cough", "khansi", "खांसी"),
    "cold": L("cold", "sardi-zukam", "सर्दी-जुकाम"),
    "sore_throat": L("sore throat", "gale ka dard", "गले का दर्द"),
    "stomach_pain": L("stomach pain", "pet dard", "पेट दर्द"),
    "vomiting": L("vomiting", "ulti", "उल्टी"),
    "diarrhea": L("diarrhoea", "dast", "दस्त"),
    "rash": L("rash", "skin rash", "त्वचा पर चकत्ते"),
    "body_pain": L("body pain", "badan dard", "बदन दर्द"),
    "weakness": L("weakness", "kamzori", "कमज़ोरी"),
    "dizziness": L("dizziness", "chakkar", "चक्कर"),
    "pain": L("pain", "dard", "दर्द"),
}

SEVERITY_TERMS: Dict[str, List[str]] = {
    "severe": ["severe", "very bad", "unbearable", "intense", "terrible", "worst", "bahut tez", "bahut zyada",
               "bahut jyada", "बहुत तेज", "असहनीय"],
    "moderate": ["moderate", "medium"],
    "mild": ["mild", "slight", "halka", "halki", "हल्का", "हल्की"],
}

_NUM = r"(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|ek|do|teen|char|paanch|saat|एक|दो|तीन|चार|पांच)"
_UNIT = r"(?:hours?|hrs?|days?|weeks?|months?|ghante|ghanta|din|hafte|hafta|mahine|mahina|घंटे|घंटा|दिन|हफ्ते|हफ़्ते|महीने)"
DURATION_RES = [
    re.compile(rf"(?<!\w){_NUM}\s*{_UNIT}(?!\w)", re.I),
    re.compile(r"(?<!\w)(?:since|from)\s+(?:yesterday|today|morning|last night|last week|this morning|monday|tuesday|"
               r"wednesday|thursday|friday|saturday|sunday)(?!\w)", re.I),
    re.compile(r"(?<!\w)(?:kal|aaj|subah|raat|parso|kal raat)\s+se(?!\w)", re.I),
    re.compile(r"(?<!\w)(?:few|couple of)\s+(?:hours|days|weeks)(?!\w)", re.I),
    re.compile(r"(?:कल|आज|सुबह|रात|परसों)\s*से"),
    re.compile(r"(?<!\w)for\s+(?:a\s+)?(?:while|week|month|long time)(?!\w)", re.I),
    re.compile(r"(?<!\w)(?:yesterday|last night)(?!\w)", re.I),
    re.compile(r"(?<!\w)duration\s+not\s+sure(?!\w)", re.I),
]

SELF_TERMS = ["i have", "i am", "i feel", "i'm", "i've", "my head", "my stomach", "my chest", "mujhe", "mera", "meri",
              "mere", "main ", "मुझे", "मेरा", "मेरी", "मेरे", "मैं"]
CHILD_TERMS = ["baby", "infant", "newborn", "toddler", "bacha", "bachcha", "bacche", "child", "बच्चा", "बच्चे", "बेटा", "बेटी"]
AGE_RES = [
    re.compile(r"(?<!\w)(\d{1,3}(?:\.\d+)?)\s*[- ]?(?:years?|yrs?|saal|sal|साल)(?:\s*[- ]?old|\s+ka|\s+ki)?(?!\w)", re.I),
    re.compile(r"(?<!\w)(\d{1,2})\s*[- ]?(?:months?|mahine)(?:\s*[- ]?old)?(?!\w)", re.I),
]

INFO_STARTS = [
    r"what\s+(is|are|does|do)\b", r"what's\b", r"why\b", r"how\s+(to|do|does|can|long|many)\b", r"can\s+i\b",
    r"should\s+i\b", r"is\s+it\b", r"are\s+there\b", r"explain\b", r"define\b", r"tell\s+me\s+about\b",
    r"difference\s+between\b", r"causes?\s+of\b", r"symptoms?\s+of\b", r"(kya|kaise|kyun|kyu|kab)\b",
    r"क्या\b", r"कैसे\b", r"क्यों\b", r"कब\b",
]
INFO_RE = re.compile(r"^\s*(?:" + "|".join(INFO_STARTS) + r")", re.I)
INFO_ANYWHERE_RE = re.compile(r"\b(?:kya hai|kya hota hai|kya hota|kaise hota|kyun hota|kyu hota)\b|क्या है|क्या होता", re.I)
PERSONAL_RE = re.compile(
    r"\b(?:i have|i am|i'm|i feel|i've|my |mujhe|mera|meri|mere|main |papa|mummy|mother|father|wife|husband|son|daughter|"
    r"baby|bacha|bachcha|grandmother|grandfather|dadi|dada|nani|nana|patient|ko\s+\w+\s+(?:hai|ho raha|ho rahi))\b|"
    r"मुझे|मेरा|मेरी|मेरे|मैं|पापा|मम्मी|बच्चे|बच्चा",
    re.I,
)


# --------------------------------------------------------------------------- result / context

@dataclass
class ClarifyResult:
    action: str  # "proceed" | "info" | "ask"
    message: Optional[str] = None
    questions: List[FollowUpQuestion] = field(default_factory=list)
    answered_context: Dict[str, str] = field(default_factory=dict)


@dataclass
class Known:
    symptoms: List[str]
    duration: Optional[str]
    severity: Optional[str]
    patient: Optional[str]
    age_known: bool
    child_like: bool


def _turn_text(turn: Dict[str, Any]) -> str:
    return str(turn.get("content") or turn.get("text") or turn.get("user_input") or "")


def find_symptoms(text: str) -> List[str]:
    lowered = (text or "").lower()
    found = [key for key, terms in SYMPTOMS.items() if key != GENERIC_SYMPTOM and has_current_term(lowered, terms)]
    if not found and has_current_term(lowered, SYMPTOMS[GENERIC_SYMPTOM]):
        found = [GENERIC_SYMPTOM]
    return found


def find_duration(text: str) -> Optional[str]:
    for pattern in DURATION_RES:
        match = pattern.search(text or "")
        if match:
            return match.group(0).strip()
    return None


def find_severity(text: str) -> Optional[str]:
    lowered = (text or "").lower()
    ratio = re.search(r"(?<!\d)(\d{1,2})\s*/\s*10(?!\d)", lowered)
    if ratio:
        score = int(ratio.group(1))
        return "severe" if score >= 7 else "moderate" if score >= 4 else "mild"
    for level, terms in SEVERITY_TERMS.items():
        if has_current_term(lowered, terms):
            return level
    return None


def find_patient(text: str) -> Optional[str]:
    relationship = detect_patient(text)
    if relationship:
        return relationship
    lowered = (text or "").lower()
    return "self" if any(term in lowered for term in SELF_TERMS) else None


def find_age_in_text(text: str) -> bool:
    return any(pattern.search(text or "") for pattern in AGE_RES)


def is_info_question(text: str) -> bool:
    cleaned = (text or "").strip()
    if not cleaned or PERSONAL_RE.search(cleaned):
        return False
    return bool(INFO_RE.search(cleaned) or INFO_ANYWHERE_RE.search(cleaned))


def _history_user_turns(history: List[Dict[str, Any]]) -> List[Tuple[int, Dict[str, Any]]]:
    return [(index, turn) for index, turn in enumerate(history) if turn.get("role") == "user"]


def topic_start(history: List[Dict[str, Any]]) -> int:
    """Index of the first turn of the current topic: the last user turn that introduced a new symptom."""
    seen: set = set()
    start = 0
    for index, turn in _history_user_turns(history):
        if turn.get("answers"):
            continue  # answers to questions never start a new topic
        symptoms = set(find_symptoms(_turn_text(turn)))
        if symptoms - seen and seen:
            start = index
        seen |= symptoms
    return start


def _asked_ids(window: List[Dict[str, Any]]) -> Tuple[set, int]:
    asked: set = set()
    rounds = 0
    for turn in window:
        if turn.get("role") != "assistant":
            continue
        ids = turn.get("follow_up_ids") or []
        if ids:
            rounds += 1
            asked |= {str(item) for item in ids}
        elif turn.get("follow_up_question"):
            rounds += 1  # older clients: a plain-text follow-up counts as a round
    return asked, rounds


def _answered_ids(window: List[Dict[str, Any]], answers: Dict[str, Any]) -> set:
    answered = set(answers or {})
    for turn in window:
        if turn.get("role") == "user" and isinstance(turn.get("answers"), dict):
            answered |= set(turn["answers"])
    return answered


def gather_known(text: str, context: PatientContext, answered: set) -> Known:
    symptoms = find_symptoms(text)
    patient = find_patient(text)
    child_like = patient == "child" or any(has_current_term(text.lower(), [term]) for term in CHILD_TERMS)
    age_known = (
        context.age_years is not None
        or find_age_in_text(text)
        or "patient_age" in answered
        or "patient" in answered
    )
    return Known(
        symptoms=symptoms,
        duration=find_duration(text) or ("noted" if "duration" in answered else None),
        severity=find_severity(text) or ("noted" if "severity" in answered else None),
        patient="noted" if (patient is None and "patient" in answered) else patient,
        age_known=age_known,
        child_like=child_like,
    )


def describe_known(known: Known, context: PatientContext, text: str) -> Dict[str, str]:
    shown: Dict[str, str] = {}
    if known.patient and known.patient != "noted":
        shown["Patient"] = known.patient.replace("_", " ")
    if context.age_years is not None:
        shown["Age"] = f"{context.age_years:g} years"
    if known.symptoms:
        shown["Symptoms"] = ", ".join(SYMPTOM_NAMES.get(key, {}).get("English", key) for key in known.symptoms)
    duration = find_duration(text)
    if duration:
        shown["Duration"] = duration
    severity = find_severity(text)
    if severity:
        shown["Severity"] = severity
    return shown


# --------------------------------------------------------------------------- question templates

INTRO = L(
    "I can help you understand this better. I need a little more information.",
    "Main isse behtar samajhne mein madad kar sakta hoon. Mujhe thodi aur jaankari chahiye.",
    "मैं इसे बेहतर समझने में मदद कर सकता हूँ। मुझे थोड़ी और जानकारी चाहिए।",
)
INTRO_MORE = L(
    "Thanks, that helps. One more quick check.",
    "Shukriya, isse madad mili. Bas ek aur chhota sawaal.",
    "धन्यवाद, इससे मदद मिली। बस एक और छोटा सवाल।",
)
NONE_OF_THESE = L("None of these", "Inme se koi nahi", "इनमें से कोई नहीं")
NOT_SURE = L("Not sure", "Pata nahi", "पता नहीं")


def _opt(value: str, labels: Dict[str, str], text: Optional[str] = None, age: Optional[float] = None) -> Dict[str, Any]:
    return {"value": value, "labels": labels, "text": text, "age": age}


PATIENT_OPTIONS = [
    _opt("self", L("Myself", "Main khud", "मैं खुद"), "patient is myself"),
    _opt("adult", L("Another adult", "Koi aur adult", "कोई और वयस्क"), "patient is an adult"),
    _opt("older_adult", L("Older adult (65+)", "Buzurg (65+)", "बुज़ुर्ग (65+)"), "patient is an older adult over 65", 65),
    _opt("child", L("Child (1-12 years)", "Bachcha (1-12 saal)", "बच्चा (1-12 साल)"), "patient is a child"),
    _opt("infant", L("Baby under 1 year", "Shishu (1 saal se kam)", "शिशु (1 साल से कम)"), "patient is a baby under one year old", 0.5),
]
AGE_OPTIONS = [
    _opt("under_3m", L("Under 3 months", "3 mahine se kam", "3 महीने से कम"), "baby under 3 months old", 0.2),
    _opt("m3_11", L("3-11 months", "3-11 mahine", "3-11 महीने"), "baby aged 3 to 11 months", 0.5),
    _opt("y1_4", L("1-4 years", "1-4 saal", "1-4 साल"), "child aged 1 to 4 years", 2.5),
    _opt("y5_12", L("5-12 years", "5-12 saal", "5-12 साल"), "child aged 5 to 12 years", 8),
    _opt("teen_adult", L("13 years or older", "13 saal ya zyada", "13 साल या अधिक"), "patient aged 13 or older"),
]
DURATION_OPTIONS = [
    _opt("few_hours", L("A few hours", "Kuch ghante", "कुछ घंटे"), "for a few hours"),
    _opt("since_yesterday", L("Since yesterday", "Kal se", "कल से"), "since yesterday"),
    _opt("two_three_days", L("2-3 days", "2-3 din", "2-3 दिन"), "for 2 to 3 days"),
    _opt("over_three_days", L("More than 3 days", "3 din se zyada", "3 दिन से अधिक"), "for more than 3 days"),
    _opt("not_sure", NOT_SURE, "duration not sure"),
]


def severity_options(symptom: str) -> List[Dict[str, Any]]:
    sudden = {
        "headache": ("Sudden and very severe (worst ever)", "Achanak aur bahut tez (ab tak ka sabse zyada)",
                     "अचानक और बहुत तेज़ (अब तक का सबसे ज़्यादा)", "sudden severe headache"),
    }.get(symptom, ("Sudden and very severe", "Achanak aur bahut tez", "अचानक और बहुत तेज़", "sudden very severe pain"))
    return [
        _opt("mild", L("Mild", "Halka", "हल्का"), "mild"),
        _opt("moderate", L("Moderate", "Madhyam", "मध्यम"), "moderate"),
        _opt("severe", L("Severe", "Tez", "तेज़"), "severe"),
        _opt("sudden_severe", L(sudden[0], sudden[1], sudden[2]), sudden[3]),
    ]


# Option text uses phrases the safety rules already recognise, so a selected warning sign escalates.
ASSOCIATED: Dict[str, List[Dict[str, Any]]] = {
    "headache": [
        _opt("vomiting", L("Vomiting", "Ulti", "उल्टी"), "vomiting"),
        _opt("blurred_vision", L("Blurred vision", "Dhundhla dikhna", "धुंधला दिखना"), "blurred vision"),
        _opt("confusion", L("New confusion", "Achanak confusion", "अचानक भ्रम"), "new confusion"),
        _opt("weakness_one_side", L("Weakness on one side", "Ek taraf kamzori", "एक तरफ कमज़ोरी"), "one-sided weakness"),
        _opt("slurred", L("Slurred speech", "Bolne mein dikkat", "बोलने में दिक्कत"), "slurred speech"),
        _opt("stiff_neck", L("Stiff neck", "Gardan akad jana", "गर्दन अकड़ना"), "stiff neck"),
        _opt("fever", L("Fever", "Bukhar", "बुखार"), "fever"),
    ],
    "fever": [
        _opt("breathing", L("Trouble breathing", "Saans lene mein dikkat", "सांस लेने में दिक्कत"), "trouble breathing"),
        _opt("stiff_neck", L("Stiff neck", "Gardan akad jana", "गर्दन अकड़ना"), "stiff neck"),
        _opt("rash", L("Rash that does not fade when pressed", "Daba ne par bhi na jaane wale daane",
                        "दबाने पर भी न मिटने वाले चकत्ते"), "non-blanching rash"),
        _opt("vomiting", L("Repeated vomiting", "Baar baar ulti", "बार-बार उल्टी"), "repeated vomiting"),
        _opt("confusion", L("New confusion", "Achanak confusion", "अचानक भ्रम"), "new confusion"),
        _opt("seizure", L("Fits or seizure", "Daura", "दौरा"), "seizure"),
    ],
    "stomach_pain": [
        _opt("severe_pain", L("Very severe pain", "Bahut tez dard", "बहुत तेज़ दर्द"), "severe abdominal pain"),
        _opt("vomit_blood", L("Blood in vomit", "Ulti mein khoon", "उल्टी में खून"), "vomiting blood"),
        _opt("stool_blood", L("Black or bloody stool", "Kala ya khoon wala mal", "काला या खूनी मल"), "black or bloody stool"),
        _opt("fever", L("Fever", "Bukhar", "बुखार"), "fever"),
    ],
    "vomiting": [
        _opt("vomit_blood", L("Blood in vomit", "Ulti mein khoon", "उल्टी में खून"), "vomiting blood"),
        _opt("no_fluids", L("Cannot keep any fluids down", "Kuch bhi pani nahi tik raha", "कोई भी तरल नहीं टिक रहा"), "unable to keep fluids down"),
        _opt("confusion", L("Very drowsy or confused", "Bahut neend ya confusion", "बहुत नींद या भ्रम"), "new confusion"),
        _opt("fever", L("Fever", "Bukhar", "बुखार"), "fever"),
    ],
    "diarrhea": [
        _opt("stool_blood", L("Blood in stool", "Mal mein khoon", "मल में खून"), "blood in stool"),
        _opt("no_fluids", L("Cannot keep any fluids down", "Kuch bhi pani nahi tik raha", "कोई भी तरल नहीं टिक रहा"), "unable to keep fluids down"),
        _opt("confusion", L("Very drowsy or confused", "Bahut neend ya confusion", "बहुत नींद या भ्रम"), "new confusion"),
        _opt("fever", L("Fever", "Bukhar", "बुखार"), "fever"),
    ],
    "cough": [
        _opt("breathing", L("Trouble breathing", "Saans lene mein dikkat", "सांस लेने में दिक्कत"), "trouble breathing"),
        _opt("chest_tight", L("Chest tightness", "Seene mein jakdan", "सीने में जकड़न"), "chest tightness"),
        _opt("cough_blood", L("Coughing up blood", "Khansi mein khoon", "खांसी में खून"), "coughing blood"),
        _opt("fever", L("Fever", "Bukhar", "बुखार"), "fever"),
    ],
    "dizziness": [
        _opt("chest_pain", L("Chest pain", "Seene mein dard", "सीने में दर्द"), "chest pain"),
        _opt("fainting", L("Fainting or blackout", "Behoshi", "बेहोशी"), "fainted"),
        _opt("weakness_one_side", L("Weakness on one side", "Ek taraf kamzori", "एक तरफ कमज़ोरी"), "one-sided weakness"),
        _opt("slurred", L("Slurred speech", "Bolne mein dikkat", "बोलने में दिक्कत"), "slurred speech"),
        _opt("blurred_vision", L("Blurred vision", "Dhundhla dikhna", "धुंधला दिखना"), "blurred vision"),
    ],
    "weakness": [
        _opt("chest_pain", L("Chest pain", "Seene mein dard", "सीने में दर्द"), "chest pain"),
        _opt("fainting", L("Fainting or blackout", "Behoshi", "बेहोशी"), "fainted"),
        _opt("weakness_one_side", L("Weakness on one side", "Ek taraf kamzori", "एक तरफ कमज़ोरी"), "one-sided weakness"),
        _opt("fever", L("Fever", "Bukhar", "बुखार"), "fever"),
    ],
    "rash": [
        _opt("rash", L("Rash that does not fade when pressed", "Daba ne par bhi na jaane wale daane",
                        "दबाने पर भी न मिटने वाले चकत्ते"), "non-blanching rash"),
        _opt("swelling", L("Swelling of lips or tongue", "Hont ya jeebh mein sujan", "होंठ या जीभ में सूजन"), "swollen tongue"),
        _opt("breathing", L("Trouble breathing", "Saans lene mein dikkat", "सांस लेने में दिक्कत"), "trouble breathing"),
        _opt("fever", L("Fever", "Bukhar", "बुखार"), "fever"),
    ],
    "body_pain": [
        _opt("injury", L("Recent fall or injury", "Haal hi mein chot ya girna", "हाल ही में चोट या गिरना"), "recent injury"),
        _opt("numbness", L("Numbness or weakness in a limb", "Haath/pair mein sunnpan ya kamzori", "हाथ/पैर में सुन्नपन या कमज़ोरी"), "numbness or weakness"),
        _opt("fever", L("Fever", "Bukhar", "बुखार"), "fever"),
    ],
}
ASSOCIATED["pain"] = ASSOCIATED["body_pain"]

Q_TEXT: Dict[str, Dict[str, str]] = {
    "patient": L("Who is this for?", "Yeh kiske liye hai?", "यह किसके लिए है?"),
    "patient_age": L("What is the patient's age group?", "Mareez ki umar kitni hai?", "मरीज़ की उम्र का समूह क्या है?"),
    "main_concern": L("What do you need help with?", "Aapko kis cheez mein madad chahiye?", "आपको किस चीज़ में मदद चाहिए?"),
    "associated": L("Do you have any of these along with it? (select all that apply)",
                    "Iske saath inme se kuch hai? (jo laagu ho sab chunein)",
                    "इसके साथ इनमें से कुछ है? (जो लागू हो सब चुनें)"),
}
SUMMARY = {
    "patient": L("Patient", "Mareez", "मरीज़"),
    "patient_age": L("Age group", "Umar", "उम्र"),
    "duration": L("Duration", "Kitne samay se", "अवधि"),
    "severity": L("Severity", "Tivrata", "तीव्रता"),
    "associated": L("Associated symptoms", "Saath ke lakshan", "साथ के लक्षण"),
    "main_concern": L("Main concern", "Mukhya samasya", "मुख्य समस्या"),
}

MAIN_CONCERN_OPTIONS = [
    _opt("fever_weakness", L("Fever or weakness", "Bukhar ya kamzori", "बुखार या कमज़ोरी"), "fever or weakness"),
    _opt("pain_headache", L("Pain or headache", "Dard ya sar dard", "दर्द या सिरदर्द"), "pain or headache"),
    _opt("cough_cold", L("Cough, cold or sore throat", "Khansi, sardi ya gale mein dard", "खांसी, सर्दी या गले में दर्द"), "cough or cold"),
    _opt("stomach", L("Stomach upset or vomiting", "Pet kharab ya ulti", "पेट खराब या उल्टी"), "stomach upset or vomiting"),
    _opt("nursing", L("Injection or wound dressing at home", "Ghar par injection ya dressing", "घर पर इंजेक्शन या ड्रेसिंग"), "injection or dressing at home"),
    _opt("lab", L("Blood test at home", "Ghar par blood test", "घर पर ब्लड टेस्ट"), "blood test at home"),
    _opt("consult", L("Doctor consultation", "Doctor se salah", "डॉक्टर से सलाह"), "doctor consultation"),
]


def _build(question_id: str, language: Lang, input_type: str, options: List[Dict[str, Any]], text: Optional[str] = None,
           custom: bool = True) -> FollowUpQuestion:
    summary_key = question_id if question_id in SUMMARY else "associated"
    built = [
        FollowUpOption(value=o["value"], label=o["labels"][language], text=o["text"], age_years=o["age"])
        for o in options
    ]
    if input_type == "multi_choice":
        built.append(FollowUpOption(value="none", label=NONE_OF_THESE[language], text="none of the listed signs"))
    return FollowUpQuestion(
        question_id=question_id,
        question_text=text or Q_TEXT[question_id][language],
        summary_label=SUMMARY[summary_key][language],
        input_type=input_type,
        options=built,
        required=input_type != "multi_choice",
        allow_custom_input=custom,
    )


def _symptom_phrase(symptoms: List[str], language: Lang) -> str:
    if len(symptoms) == 1:
        return SYMPTOM_NAMES.get(symptoms[0], SYMPTOM_NAMES["pain"])[language]
    return {"English": "these symptoms", "Hinglish": "yeh takleef", "Hindi": "ये तकलीफ़ें"}[language]


def duration_question(symptoms: List[str], language: Lang) -> FollowUpQuestion:
    name = _symptom_phrase(symptoms, language)
    text = {
        "English": f"How long have you had {'this ' + name if len(symptoms) == 1 else name}?",
        "Hinglish": f"Yeh {name} kab se hai?" if len(symptoms) == 1 else f"{name.capitalize()} kab se hai?",
        "Hindi": f"यह {name} कब से है?" if len(symptoms) == 1 else f"{name} कब से हैं?",
    }[language]
    return _build("duration", language, "single_choice", DURATION_OPTIONS, text)


def severity_question(symptom: str, language: Lang) -> FollowUpQuestion:
    name = SYMPTOM_NAMES.get(symptom, SYMPTOM_NAMES["pain"])[language]
    text = {
        "English": f"How severe is the {name}?",
        "Hinglish": f"{name.capitalize()} kitna tez hai?",
        "Hindi": f"{name} कितना तेज़ है?",
    }[language]
    return _build("severity", language, "single_choice", severity_options(symptom), text)


def associated_symptom(symptoms: List[str]) -> Optional[str]:
    for key in symptoms:
        if key in ASSOCIATED:
            return key
    return None


def build_questions(known: Known, text: str, asked: set, answered: set, language: Lang, vague: bool) -> List[FollowUpQuestion]:
    """Ordered by how much the answer could change urgency; ids already asked or answered are skipped."""
    skip = asked | answered
    wanted: List[FollowUpQuestion] = []

    if vague:
        if "main_concern" not in skip:
            wanted.append(_build("main_concern", language, "single_choice", MAIN_CONCERN_OPTIONS))
        if known.patient is None and not known.age_known and "patient" not in skip:
            wanted.append(_build("patient", language, "single_choice", PATIENT_OPTIONS))
        return wanted

    if not known.age_known:
        if known.patient is None and "patient" not in skip:
            wanted.append(_build("patient", language, "single_choice", PATIENT_OPTIONS))
        elif known.child_like and "patient_age" not in skip:
            wanted.append(_build("patient_age", language, "single_choice", AGE_OPTIONS))
    if known.duration is None and "duration" not in skip:
        wanted.append(duration_question(known.symptoms, language))
    pain_symptom = next((s for s in known.symptoms if s in PAIN_LIKE), None)
    if pain_symptom and known.severity is None and "severity" not in skip:
        wanted.append(severity_question(pain_symptom, language))
    group = associated_symptom(known.symptoms)
    if group and "associated" not in skip:
        wanted.append(_build("associated", language, "multi_choice", ASSOCIATED[group]))
    return wanted


# --------------------------------------------------------------------------- LLM helpers (validated)

class _Understood(BaseModel):
    symptoms: List[str] = Field(default_factory=list, max_length=5)
    duration: Optional[str] = Field(None, max_length=60)
    patient: Optional[str] = Field(None, max_length=40)


UNDERSTAND_SYSTEM = """Read a patient message (English, Hindi or Hinglish) and extract only what it states.
Return strict JSON: {"symptoms": ["short symptom"], "duration": "string or null", "patient": "self|mother|father|child|other or null"}.
Do not guess. Use [] / null when the message does not say."""

INFO_UNAVAILABLE = L(
    "I can't look up general information right now. If you or someone else has symptoms, describe them and I will help with next steps.",
    "Abhi aam jaankari nahi de pa raha. Agar aapko ya kisi ko takleef hai to symptoms bataiye, main agle kadam mein madad karunga.",
    "अभी सामान्य जानकारी नहीं दे पा रहा। अगर आपको या किसी को तकलीफ़ है तो लक्षण बताइए, मैं अगले कदम में मदद करूँगा।",
)


def _llm_json(system: str, user: str) -> Optional[Dict[str, Any]]:
    client = get_groq_client()
    if client is None:
        return None
    for model in MODELS:
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.2,
                timeout=LLM_TIMEOUT_SECONDS,
            )
            parsed = json.loads(completion.choices[0].message.content)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            continue
    return None


async def understand_unusual(text: str) -> Optional[_Understood]:
    raw = await asyncio.to_thread(_llm_json, UNDERSTAND_SYSTEM, text[:800])
    if raw is None:
        return None
    try:
        return _Understood.model_validate(raw)
    except ValidationError:
        return None


# --------------------------------------------------------------------------- main entry

async def decide(
    user_input: str,
    history: List[Dict[str, Any]],
    answers: Dict[str, Any],
    context: PatientContext,
    language_hint: Optional[str],
) -> ClarifyResult:
    history = history or []
    answers = answers or {}
    language = detect_language(user_input, language_hint)
    is_answer_turn = bool(answers)

    # The latest message can itself start a new topic (a different symptom), which resets what is known.
    latest_turn: Dict[str, Any] = {"role": "user", "content": user_input}
    if is_answer_turn:
        latest_turn["answers"] = answers
    start = topic_start([*history, latest_turn])
    window = history[start:] if start < len(history) else []
    user_texts = [_turn_text(turn) for turn in window if turn.get("role") == "user"]
    text = "\n".join([*user_texts, user_input])
    asked, rounds = _asked_ids(window)
    answered = _answered_ids(window, answers)

    match = classify_text(text)
    if match and match[0] in {"lab_test_home", "home_nursing"}:
        return ClarifyResult("proceed")  # a specific service was requested; routing handles it

    known = gather_known(text, context, answered)
    if not known.symptoms and not is_answer_turn:
        understood = await understand_unusual(user_input)
        if understood and understood.symptoms:
            known.symptoms = [item.lower() for item in understood.symptoms]
            known.duration = known.duration or understood.duration
            if known.patient is None and understood.patient:
                known.patient = understood.patient

    vague = not known.symptoms and not match
    if vague and is_answer_turn:
        return ClarifyResult("proceed")
    if rounds >= MAX_ROUNDS:
        return ClarifyResult("proceed")

    questions = build_questions(known, text, asked, answered, language, vague)[:MAX_QUESTIONS_PER_ROUND]
    if not questions:
        return ClarifyResult("proceed")
    return ClarifyResult(
        "ask",
        message=(INTRO_MORE if rounds else INTRO)[language],
        questions=questions,
        answered_context=describe_known(known, context, text),
    )

from dotenv import load_dotenv
load_dotenv()

from typing import Optional, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import json
from app.accounts import router as accounts_router, allowed_origins
from app.storage import initialize_database

from app.schemas import TriageRequest, TriageResponse, Location, DemoHospital, PatientContext
from app.modules.safety import assess_safety
from app.modules.emergency import list_demo_hospitals
from app.modules.intake import extract_intake
from app.modules.triage import evaluate_triage, detect_red_flags, get_groq_client, TAXONOMY_DATA
from app.modules.routing import route_request, contract_red_flags
from app.bookings import router as bookings_router
from app.modules.matching import match_caregivers, CAREGIVER_PROFILES
from app.modules.stt import transcribe_audio_bytes

@asynccontextmanager
async def lifespan(application):
    initialize_database()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="CareCompass API (Groq Llama-3-70B & Whisper-v3)",
    description="Care navigation, safety triage, and caregiver matching powered by Groq",
    version="2.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(accounts_router)
app.include_router(bookings_router)

ROUTABLE_CARE_TYPES = {"paramedic_home_visit", "home_nursing", "lab_test_home", "teleconsultation"}
URGENT_CHECK = {
    "English": "The reported readings need urgent medical advice now; this app will not book routine home care for them. Is the person breathless, confused, very drowsy, or getting worse? If yes, call 112 now.",
    "Hinglish": "Bataye gaye readings ke liye abhi turant doctor ki salah zaroori hai; yeh app iske liye routine home care book nahi karega. Kya saans phool rahi hai, confusion, bahut neend, ya halat bigad rahi hai? Haan to abhi 112 call karein.",
    "Hindi": "बताई गई रीडिंग के लिए अभी तुरंत डॉक्टर की सलाह ज़रूरी है; यह ऐप इसके लिए सामान्य होम केयर बुक नहीं करेगा। क्या सांस फूल रही है, भ्रम, बहुत नींद, या हालत बिगड़ रही है? हाँ तो अभी 112 पर कॉल करें।",
}
EMERGENCY_STEPS = [
    "Call 112 now, or 102 for ambulance assistance in India. No service has been contacted by this app.",
    "Follow the emergency dispatcher's instructions and do not drive yourself if seriously unwell.",
]


def escalate(assessment, signs):
    return assessment.model_copy(update={
        "level": "emergency",
        "summary": "A possible emergency was detected. Call 112 now; do not wait for this app.",
        "critical_signs": list(dict.fromkeys([*assessment.critical_signs, *(signs or ["clinical_triage_emergency"])])),
        "requires_prompt_review": True,
        "supportive_steps": [],
        "next_steps": EMERGENCY_STEPS,
    })


def emergency_response(assessment, reasoning):
    return TriageResponse(
        care_type="emergency_112",
        urgency="emergency",
        red_flags=contract_red_flags(assessment.critical_signs),
        reasoning=reasoning,
        assessment=assessment,
    )

@app.get("/")
def read_root():
    return {
        "project": "CareCompass",
        "description": "AI-powered care navigation and caregiver matching system",
        "models": {
            "stt": "whisper-large-v3 (via Groq)",
            "intake_and_triage": "llama-3.3-70b-versatile / llama-3-70b-instruct (via Groq)"
        },
        "status": "operational",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/taxonomy")
def get_taxonomy():
    return TAXONOMY_DATA

@app.get("/api/caregivers")
def get_caregivers():
    return CAREGIVER_PROFILES

@app.get("/api/hospitals/demo", response_model=List[DemoHospital])
def get_demo_hospitals(lat: Optional[float] = None, lng: Optional[float] = None):
    if (lat is None) != (lng is None):
        raise HTTPException(status_code=422, detail="Supply both latitude and longitude, or neither.")
    try:
        location = Location(lat=lat, lng=lng) if lat is not None else None
    except ValueError as failure:
        raise HTTPException(status_code=422, detail=str(failure))
    return list_demo_hospitals(location)

@app.post("/api/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    language: Optional[str] = Form("auto")
):
    """
    Endpoint for Voice Transcription using Groq's whisper-large-v3.
    """
    try:
        audio_bytes = await file.read()
        transcription, detected_lang = await transcribe_audio_bytes(
            file_bytes=audio_bytes,
            filename=file.filename or "audio.wav",
            language_hint=language
        )
        return {
            "transcription": transcription,
            "language": detected_lang
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STT transcription failed: {str(e)}")

@app.post("/api/triage", response_model=TriageResponse)
async def process_triage(request: TriageRequest) -> TriageResponse:
    """
    Main Orchestration Pipeline:
    Module 1: Smart Intake (Llama-3-70B on Groq) -> Entity Extraction & Verification.
    Module 2: Triage Core (Rule-Based Red Flags + Llama-3-70B Triage) -> Emergency Bypass.
    Module 3: Caregiver Matching (Weighted Ranking + Explainability).
    """
    try:
        history = request.conversation_history or []
        prior_inputs = [str(turn.get("content") or turn.get("text") or "") for turn in history if turn.get("role") == "user"]
        clinical_input = "\n".join([*prior_inputs, request.user_input])
        assessment = assess_safety(clinical_input, request.patient_context)
        decision = route_request(request.user_input, history, request.language)

        # Safety runs on the whole conversation before routing, follow-ups, or any external AI call.
        if assessment.level == "emergency":
            return emergency_response(assessment, assessment.summary)

        red_flags = detect_red_flags(clinical_input, [])
        if red_flags:
            assessment = escalate(assessment, red_flags)
            return emergency_response(assessment, f"Red-flag symptoms detected ({', '.join(red_flags)}); routed to emergency services, not home care.")

        care_type, urgency, reasoning = decision.care_type, decision.urgency, decision.reasoning
        if care_type is None and get_groq_client() is not None:
            entities = await extract_intake(request.user_input, request.language or "auto", history)
            if entities.is_complete:
                llm = await evaluate_triage(raw_input=request.user_input, entities=entities, language=decision.language)
                if llm["is_emergency"] or llm["care_type"] == "emergency_112":
                    assessment = escalate(assessment, llm["red_flags"])
                    return emergency_response(assessment, llm["reasoning"])
                if llm["care_type"] in ROUTABLE_CARE_TYPES:
                    care_type, urgency, reasoning = llm["care_type"], llm["urgency"], llm["reasoning"]

        if assessment.blocks_home_booking:
            # Abnormal or uninterpretable vitals: do not offer a routine booking that could delay urgent care.
            return TriageResponse(
                follow_up_question=URGENT_CHECK[decision.language],
                detected_language=decision.language,
                reasoning=assessment.summary,
                assessment=assessment,
            )
        if assessment.requires_prompt_review:
            if care_type == "lab_test_home":
                care_type = "paramedic_home_visit"
            if care_type is not None:
                urgency = "same_day"
                reasoning = f"Reported risk factors need prompt clinician assessment; urgency assessed as same_day."

        if care_type is None:
            return TriageResponse(
                follow_up_question=decision.follow_up_question,
                detected_language=decision.language,
                assessment=assessment,
            )

        matched_caregivers, matching_note = match_caregivers(
            care_type=care_type,
            user_location=request.location,
            user_language=decision.language,
            user_input=decision.concern_text,
            urgency=urgency,
        )
        return TriageResponse(
            care_type=care_type,
            urgency=urgency,
            reasoning=reasoning,
            matched_caregivers=matched_caregivers,
            matching_note=matching_note,
            detected_language=decision.language,
            assessment=assessment,
        )

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/triage/voice", response_model=TriageResponse)
async def process_voice_triage(
    file: UploadFile = File(...),
    language: Optional[str] = Form("auto"),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    conversation_history: Optional[str] = Form("[]"),
    patient_context: Optional[str] = Form(None),
) -> TriageResponse:
    """
    Direct Voice-to-Triage Pipeline:
    1. Transcribes voice input using Whisper-large-v3.
    2. Passes transcription directly through the 3-module triage pipeline.
    """
    try:
        history_list = json.loads(conversation_history or "[]")
        if not isinstance(history_list, list) or not all(isinstance(turn, dict) for turn in history_list):
            raise ValueError("Conversation history must be an array of message objects.")
        context = PatientContext.model_validate_json(patient_context) if patient_context else PatientContext()
        if (lat is None) != (lng is None):
            raise ValueError("Supply both latitude and longitude, or neither.")
        location_obj = Location(lat=lat, lng=lng) if lat is not None else None
    except ValueError as failure:
        raise HTTPException(status_code=422, detail=str(failure))

    # 1. Transcribe audio with Whisper-large-v3
    audio_bytes = await file.read()
    transcription, detected_lang = await transcribe_audio_bytes(
        file_bytes=audio_bytes,
        filename=file.filename or "recording.wav",
        language_hint=language
    )

    # 3. Route to main triage
    request = TriageRequest(
        user_input=transcription,
        language=detected_lang or language or "auto",
        location=location_obj,
        conversation_history=history_list,
        patient_context=context,
    )
    return await process_triage(request)

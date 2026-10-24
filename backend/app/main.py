from typing import Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import json

from app.schemas import TriageRequest, TriageResponse, Location
from app.modules.intake import extract_intake
from app.modules.triage import evaluate_triage, TAXONOMY_DATA
from app.modules.matching import match_caregivers, CAREGIVER_PROFILES
from app.modules.stt import transcribe_audio_bytes

app = FastAPI(
    title="CareCompass API (Groq Llama-3-70B & Whisper-v3)",
    description="Care navigation, safety triage, and caregiver matching powered by Groq",
    version="2.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        # MODULE 1: SMART INTAKE
        entities = await extract_intake(
            user_input=request.user_input,
            language=request.language or "auto",
            conversation_history=request.conversation_history
        )

        # Short-Circuit: If missing Patient, Symptoms, or Duration
        if not entities.is_complete:
            return TriageResponse(
                follow_up_question=entities.follow_up_question or "Kripya aur jaankari dein.",
                care_type=None,
                urgency=None,
                red_flags=[],
                reasoning=None,
                matched_caregivers=[]
            )

        # MODULE 2: TRIAGE & SAFETY NET
        triage_result = await evaluate_triage(
            raw_input=request.user_input,
            entities=entities
        )

        # Emergency Bypass: Red flags skip matching immediately
        if triage_result["is_emergency"] or len(triage_result["red_flags"]) > 0:
            return TriageResponse(
                follow_up_question=None,
                care_type=triage_result["care_type"],
                urgency=triage_result["urgency"],
                red_flags=triage_result["red_flags"],
                reasoning=triage_result["reasoning"],
                matched_caregivers=[]
            )

        # MODULE 3: CAREGIVER MATCHING
        matched_caregivers = match_caregivers(
            care_type=triage_result["care_type"],
            user_location=request.location,
            user_language=request.language or "auto"
        )

        return TriageResponse(
            follow_up_question=None,
            care_type=triage_result["care_type"],
            urgency=triage_result["urgency"],
            red_flags=[],
            reasoning=triage_result["reasoning"],
            matched_caregivers=matched_caregivers
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
    conversation_history: Optional[str] = Form("[]")
) -> TriageResponse:
    """
    Direct Voice-to-Triage Pipeline:
    1. Transcribes voice input using Whisper-large-v3.
    2. Passes transcription directly through the 3-module triage pipeline.
    """
    # 1. Transcribe audio with Whisper-large-v3
    audio_bytes = await file.read()
    transcription, detected_lang = await transcribe_audio_bytes(
        file_bytes=audio_bytes,
        filename=file.filename or "recording.wav",
        language_hint=language
    )

    # 2. Parse history and location
    history_list = []
    try:
        history_list = json.loads(conversation_history or "[]")
    except Exception:
        history_list = []

    location_obj = None
    if lat is not None and lng is not None:
        location_obj = Location(lat=lat, lng=lng)

    # 3. Route to main triage
    request = TriageRequest(
        user_input=transcription,
        language=detected_lang or language or "auto",
        location=location_obj,
        conversation_history=history_list
    )
    return await process_triage(request)

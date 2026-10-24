# CareCompass Backend - AI Care Navigation & Safety Triage

CareCompass is an AI-powered care navigation and caregiver matching system engineered for Hack IIITD (CAI, IIIT-Delhi), powered by **Groq**.

### Powered by Groq:
* **Speech-to-Text (STT):** `whisper-large-v3` on Groq (high-speed transcription for Hindi, English, & Hinglish voice inputs).
* **Module 1 (Smart Intake) & Module 2 (Clinical Reasoning):** `Llama-3-70b-instruct` (`llama-3.3-70b-versatile` / `llama3-70b-8192`) on Groq with structured JSON mode.
* **Deterministic Safety Net:** Rule-based keyword matching for zero-hallucination emergency detection.
* **Module 3 (Caregiver Matching):** Haversine distance, language matching, rating scoring, and explainability reasoning.

---

## Architecture Overview

```
Voice / Text Request (Hinglish, Hindi, English)
        │
        ▼ (whisper-large-v3 if voice)
┌─────────────────────────────────────────────────────────────┐
│  Module 1: Smart Intake (Llama-3-70b-instruct on Groq)      │
│  - Extracts Patient (who), Symptoms (what), Duration (how)  │
│  - Incomplete? Short-circuits with a follow_up_question     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Complete
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Module 2: Triage Core & Safety Net                         │
│  - Rule-Based Red Flags (chest pain, breathing issues, etc.)│
│  - Emergency? Bypass Module 3 & immediate escalation        │
│  - Non-Emergency? Llama-3-70B maps taxonomy & reasoning     │
└──────────────────────────────┬──────────────────────────────┘
                               │ No Red Flags
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Module 3: Caregiver Matching & Ranking Algorithm           │
│  - Pre-Filter (care_type, available_slots > 0)              │
│  - Weighted Score: Distance (40%) + Lang (30%) + Rating (30)│
│  - Explainability Generator: Natural language reason string │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup & Configuration

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Your Groq API Key
Create a `.env` file inside `backend/`:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
PORT=8000
HOST=0.0.0.0
```

### 3. Run Server
```bash
python run.py
```
* **API Base:** `http://127.0.0.1:8000`
* **Swagger UI:** `http://127.0.0.1:8000/docs`

---

## API Endpoints

### 1. Speech-to-Text: `POST /api/stt`
Upload an audio file (wav, mp3, m4a, webm, ogg) to get fast transcription via `whisper-large-v3`.

### 2. Direct Voice Triage: `POST /api/triage/voice`
Accepts audio file + location coordinates directly and executes STT + 3-module triage in one call.

### 3. Text Triage: `POST /api/triage`
**Request:**
```json
{
  "user_input": "papa ko do din se bukhar hai aur khansi bhi",
  "language": "auto",
  "location": { "lat": 28.54, "lng": 77.27 },
  "conversation_history": []
}
```

**Response:**
```json
{
  "follow_up_question": null,
  "care_type": "paramedic_home_visit",
  "urgency": "same_day",
  "red_flags": [],
  "reasoning": "Fever with cough for 2 days, no breathing difficulty reported",
  "matched_caregivers": [
    {
      "caregiver_id": "CG_014",
      "score": 0.93,
      "reason": "Hindi-speaking, 3 km away, free at 4 pm"
    }
  ]
}
```

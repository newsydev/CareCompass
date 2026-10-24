# CareCompass Backend - AI Care Navigation & Safety Triage

## SQLite accounts and persistent data

The database is created automatically at `backend/data/carecompass.sqlite3` on
server startup. No separate database server or extra Python dependency is needed.
Set `CARECOMPASS_DB_PATH` to an absolute path to use another persistent location.
Schema version 2 (v1 plus `bookings`) is recorded with SQLite `user_version`; startup preserves existing
records and refuses databases from an unsupported newer schema.

| Table | Stored data |
| --- | --- |
| `users` | Account ID, normalized unique email, salted PBKDF2-SHA256 password hash (600,000 iterations), creation timestamp |
| `profiles` | Name, address, age, medical history/medicines/allergies, pregnancy and immunity flags |
| `sessions` | Hashed opaque session tokens and seven-day expiry; logout revokes the current token |
| `chats` | Owner, ID, title, timestamp, revision, patient context/vitals, shared coordinates, complete latest triage result, demo caregiver selection |
| `messages` | Ordered turns, per-request patient context/vitals and location, each full assessment result, and demo ambulance pickup/hospital-preference summaries |
| `bookings` | Simulated `CC-DEMO-…` bookings: owner, chat, caregiver, care type, urgency, IST slot, status (`confirmed_demo`/`cancelled`); a unique index blocks double-booking a caregiver slot |
| `login_attempts` | Hashed email/IP attempt counters for account endpoint rate limiting |

Register through `POST /api/auth/register` with `email`, `name`, and a password of
at least 12 characters. Login accepts `email` and `password` at
`POST /api/auth/login`. These establish an HttpOnly, SameSite=Strict session cookie.
`POST /api/auth/logout` revokes it. No plaintext password or raw session token is
stored in SQLite or frontend storage.

Authenticated account endpoints:

- `GET /api/account`: profile and saved conversations for the cookie's owner only.
- `PUT /api/account/profile`: update that owner's profile, not their email.
- `PUT /api/account/chats/{uuid}`: atomically save the snapshot and ordered messages.
  Send `revision: 0` for a new chat and the returned revision for subsequent writes.
  Stale writes return HTTP 409 rather than overwriting another tab's changes.
- `POST /api/account/import-demo`: explicit profile replacement and idempotent
  import of missing legacy browser chats, in one transaction.

Old email-only demo logins are not accounts and are not automatically imported.
Create an account, then optionally use the consent-based import on the profile page
in the original browser tab. Public stateless triage and demo catalogue endpoints
retain their previous behavior; they do not read account records.

Local development uses HTTP cookies. For deployment, use HTTPS and set
`CARECOMPASS_SECURE_COOKIES=1`. Set comma-separated `CARECOMPASS_ORIGINS` to the
frontend origins (the default allows localhost/127.0.0.1 on port 5174 only).
If running Vite on a different port, explicitly configure its trusted origin;
other local applications must not be implicitly granted access to account data.
Credentialed CORS and account mutation origin checks use this allowlist.
Use the same site for API/frontend; cross-site cookies are intentionally blocked.
Accounts do not yet include email verification or password reset.

The SQLite file is private local application storage, **not encrypted at rest,
clinically certified, or a production medical-record system**. Use fictional
health information. Keep database files/backups out of source control. The default
data folder and SQLite files are ignored by Git, and the main database file uses
owner-only permissions. For a consistent backup while running, use SQLite's backup
API or `.backup`; do not copy only the main file while WAL writes are active.
Deleting the database loses accounts and history.

Run `python -m unittest -q test_accounts test_safety` from `backend/` for account
isolation, hashed credentials, session expiry/revocation, persistent snapshots,
stale-write rejection, explicit import, rate limits, and safety regressions.

## Demo symptom safety and emergency preferences

This is **not a clinically validated diagnostic or dispatch system**. Do not use
it as medical decision support or enter sensitive real patient data. Call local
emergency services for actual emergencies (112 / 102 links are presented for India).
The app never contacts emergency services automatically.

`POST /api/triage` accepts optional `patient_context`:

```json
{
  "user_input": "I have a mild cough",
  "patient_context": {
    "age_years": 35,
    "medical_history": "Demo history only; unknown if blank",
    "pregnant": false,
    "immunocompromised": false,
    "vitals": {
      "temperature_c": 37,
      "oxygen_percent": 98,
      "heart_rate": 75,
      "systolic_bp": 120,
      "diastolic_bp": 80,
      "respiratory_rate": 16
    }
  }
}
```

`app/modules/safety.py` screens reported danger signs before incomplete intake or
external AI calls. It considers reported history, risk factors, structured vitals,
and explicit readings in prior/current **user** turns; assistant warnings are not
treated as patient symptoms. Conflicting readings do not cancel a dangerous one.
Unknown values remain unknown, and adult pulse/BP/breathing examples are not
applied to known children. Illness categories are broad symptom groups, never a
diagnosis or a viral/bacterial classification. The response adds `assessment`
with `level`, risk factors, unknown information, next steps, and a disclaimer.
`self_care_support` means comfort measures while monitoring, not clearance to
stay home. Urgent review can return no `care_type` and no caregiver matches.

Example thresholds are conservative **demo rules**, not a complete or validated
clinical protocol. NHS [fever guidance](https://www.nhs.uk/symptoms/fever-in-children/)
distinguishes urgent infant fever review from emergency danger signs; the demo
preserves that distinction for age/temperature readings. Oxygen, blood pressure,
pulse and breathing rules also need clinician review, local protocols, patient
baseline and calibration before any real deployment. A clinician must evaluate
serious illness; normal supplied readings do not rule it out. Do not delay
emergency care to collect measurements.

`POST /api/triage/voice` also accepts JSON `patient_context` and
`conversation_history` form fields. Invalid values are rejected before
transcription. The browser mic normally sends reviewed text to `/api/triage`.
The deterministic safety module does not send patient history/vitals to an
external AI service; existing Groq intake still uses the user's prompt when configured.

`GET /api/hospitals/demo?lat=28.54&lng=77.27` returns fictional examples, optionally
sorted by illustrative distance. All entries have `is_demo: true` and
`availability: "not_verified"`. Without coordinates, distances are null.
There is no live hospital directory, bed availability, ambulance dispatch or booking
endpoint. The frontend saves demo preference summaries to the account's chat;
this is a storage mutation, not an ambulance booking or dispatch.
Caregiver matching no longer substitutes Delhi coordinates when location is absent.

Run the deterministic regressions with
`python -m unittest -v test_safety` from `backend/`.

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

## Routing, matching, booking and evaluation

- `app/modules/routing.py`: deterministic English/Hindi/Hinglish router, language
  detection, bounded targeted follow-ups (max 2), contract red-flag vocabulary.
- `app/modules/matching.py`: hard eligibility filters (active, role, skill, tier,
  radius, open slot) and an explainable weighted score; `matching_note` explains
  empty results.
- `app/bookings.py`: `POST/GET /api/bookings`, `POST /api/bookings/{id}/cancel`
  (login required; slot must fall in the caregiver's IST window within 7 days).
- `predict.py`: batch predictions CSV. `benchmark_eval.py`: macro-F1, emergency
  recall, follow-up accuracy, per-language accuracy and matching top-k.

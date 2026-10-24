# CareCompass — multilingual home-care navigation (demo)

CareCompass turns a free-text request in English, Hindi or Hinglish into:
**care type → urgency → red flags → matched caregivers → simulated booking**, with
safety escalation to 112 for emergencies.

> **Demo only.** Synthetic caregivers and hospitals, no diagnosis or prescribing,
> no real booking and no ambulance dispatch. In an emergency in India call **112** (or **102**).

## Run it

### Docker (one command)

```bash
docker compose up --build        # then open http://localhost:8080
```

nginx serves the UI and proxies `/api` to FastAPI. SQLite lives in the
`carecompass-data` volume. Set `GROQ_API_KEY` (optional) in the shell or
`backend/.env` to enable the LLM fallback; without it the app runs fully offline.

### Local development

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001

cd frontend && npm install
BACKEND_URL=http://127.0.0.1:8001 npm run dev -- --host 127.0.0.1 --port 5174
```

Open http://127.0.0.1:5174 and sign up (password ≥ 12 characters).
The API docs are at http://127.0.0.1:8001/docs.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/triage` | Contract endpoint: `{user_input, language, location, conversation_history}` → `{follow_up_question, care_type, urgency, red_flags, reasoning, matched_caregivers}` plus `matching_note`, `detected_language`, `assessment` |
| POST | `/api/triage/voice` | Same, from an audio upload |
| GET | `/api/taxonomy`, `/api/caregivers` | Care taxonomy and synthetic roster |
| POST/GET | `/api/bookings`, `/api/bookings/{id}/cancel` | Simulated booking (login required, `CC-DEMO-…` IDs, double-booking → 409) |
| POST/GET/PUT | `/api/auth/*`, `/api/account/*` | Accounts, profile, chat history (SQLite) |

## Evaluation and predictions

```bash
cd backend
.venv/bin/python -m unittest -q test_routing test_accounts test_safety
.venv/bin/python benchmark_eval.py --now 2026-01-15T08:00+05:30            # offline
.venv/bin/python predict.py ../data/triage_dataset.jsonl -o predictions.csv --offline --now 2026-01-15T08:00+05:30
```

`predict.py` accepts the dataset JSONL, bare request JSONL, or CSV with a
`user_input` column, and writes the same columns as `triage_dataset_flat.csv`.
A sample is in [`docs/predictions.csv`](docs/predictions.csv).

Offline results on the provided 340 cases:

| Metric | Result |
| --- | --- |
| Care-type macro-F1 / urgency macro-F1 | 1.000 / 1.000 |
| Emergency recall | 56/56, 0 false emergencies |
| Follow-up decisions | 39 TP, 0 FP, 0 FN |
| Caregiver match vs reference | top-1 84.2%, top-3 91.4% |
| Contract violations | 0 |

**Caveat:** the dataset has only 66 unique phrasings and the rules were written
with them visible, so 1.000 overstates real-world accuracy. `test_routing.py`
includes 18 independently written paraphrases as a small held-out check.

More detail: [docs/WRITEUP.md](docs/WRITEUP.md) · [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)

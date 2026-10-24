# Handoff: Supabase/Postgres integration for backend

**From:** Yash (frontend)
**To:** Suryanah (backend)
**Why this is backend-only:** the DB connection string/password must never be bundled into frontend code — any secret shipped to the browser is readable by anyone via dev tools. The frontend only ever talks to the REST API (`/api/triage`, `/api/caregivers`, `/api/taxonomy`); it has no business holding DB credentials. This doc is just the proposed shape of the change so it slots into what's already in `backend/app/` — no code here has been applied, and nothing in `frontend/` changes as a result of this.

---

## Current state (read from the repo as of now)

Data is currently loaded from flat files, in-process, at import time:

- `backend/app/modules/matching.py` reads `backend/app/data/caregivers.csv` into a pandas DataFrame (`CAREGIVER_DF`) at module load, and `GET /api/caregivers` just returns that DataFrame as records.
- `backend/app/modules/triage.py` presumably reads `backend/app/data/taxonomy.json` (`TAXONOMY_DATA`) the same way.
- `backend/app/config.py` loads env vars from `backend/.env` via `python-dotenv` — currently just `GROQ_API_KEY`, `PORT`, `HOST`.

## Proposed change

Swap the CSV/JSON file reads for a Postgres-backed read, without changing the public API contract — `GET /api/caregivers` and `/api/triage` should return exactly the same JSON shape they do today, so the frontend needs zero changes.

### 1. New env var (server-side only, in `backend/.env`, already gitignored)

```env
DATABASE_URL=postgresql://postgres:<password>@db.jydmyhhbmpeiqprpfcad.supabase.co:5432/postgres
```

Add to `backend/.env.example` as a placeholder only (`postgresql://postgres:<YOUR-PASSWORD>@...`), never the real password.

### 2. New dependency

Add to `backend/requirements.txt`:
```
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.0
```
(or `asyncpg` + async SQLAlchemy if the rest of the app stays async — `main.py`'s route handlers are already `async def`.)

### 3. `backend/app/config.py` — add the DB URL alongside existing env loading

```python
DATABASE_URL = os.getenv("DATABASE_URL", "")
```

### 4. `backend/app/db.py` (new file) — connection/session setup

A single SQLAlchemy engine + session factory, created once at import time from `DATABASE_URL`.

### 5. `caregivers` table — mirror the existing CSV columns exactly

So `GET /api/caregivers` keeps returning the same shape:

```
caregiver_id, name, role, qualification, gender, languages, skills,
base_area, base_lat, base_lng, max_radius_km, tier, rating,
experience_years, free_from, free_until, active
```

### 6. `backend/app/modules/matching.py` — swap the data source

Replace the `pd.read_csv(...)` load with a query against the `caregivers` table (e.g. `SELECT * FROM caregivers`), keeping `CAREGIVER_RECORDS` / `CAREGIVER_PROFILES` as the same list-of-dicts shape the rest of the module already expects. The scoring/matching logic in `match_caregivers()` doesn't need to change at all — it only cares about the dict shape, not where it came from.

### 7. `taxonomy.json` — optional

Could stay as a static file (it's reference data, unlikely to change often) or move to a `taxonomy` table later. Lower priority than caregivers.

---

## What does NOT change

- The REST contract (`/api/triage`, `/api/caregivers`, `/api/taxonomy` request/response shapes) — frontend already built against the current `schemas.py` and should keep working unmodified.
- Nothing in `frontend/` needs any changes for this.
- `GROQ_API_KEY`-based intake/triage logic is unaffected — this is purely a data-source swap for caregiver records.

## Action needed from Suryanah

- Confirm she's set up the `caregivers` table in Supabase with the column shape above (or adjust `matching.py`'s field access if the schema differs).
- Add `DATABASE_URL` to her local `backend/.env` (not committed).
- Rotate the Supabase password shared in chat before using it anywhere, since it was pasted in plaintext.

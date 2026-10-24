# CareCompass — Frontend PRD

**Event:** HACK IIITD · CAI (Centre for Artificial Intelligence), IIIT-Delhi
**Track:** AI for Healthcare Access
**Scope of this document:** Frontend (demo interface) only. Backend/AI modules (Smart Intake, Triage, Caregiver Matching) are owned by the backend teammate and consumed strictly via REST API.

---

## 1. Problem Summary

Patients/families often can't tell what level of care they need (home visit, nurse, GP teleconsult, specialist, or emergency). CareCompass is a care-navigation app: a user types or speaks a request (English/Hindi/Hinglish), and the system must determine:

1. **What care fits** — paramedic, nurse, GP teleconsult, specialist, or emergency referral
2. **How urgent it is** — routine, same-day, or immediate
3. **Who should go** — best-matched caregiver by skill, distance, availability, language

The frontend's job: make this entire journey simple, fast, and usable by **elderly and low-literacy users**, while faithfully surfacing the backend's reasoning and safety decisions.

---

## 2. Goals

- Deliver a working **demo interface** (deliverable #2 in the problem statement) showing the full journey: symptom input → clarifying questions → routing decision → ranked caregivers → booking.
- Score well on **UX and demo (20%)** and **Explainability (10%)** — the two criteria fully owned by the frontend.
- Never block or obscure the **emergency path** — safety-critical UI must be impossible to miss.
- Work smoothly even before the real backend is ready, via a mocked API layer matching the contract.

## 3. Non-Goals

- No diagnosis or prescription UI — the system routes, it does not treat.
- No backend/model logic, no hosting of the AI pipeline.
- No real patient data — only synthetic/demo data flows through the UI at any point.

---

## 4. Users & Context

| Persona | Needs |
|---|---|
| Elderly patient / low-literacy user | Minimal typing, large tap targets, voice input/output, plain-language explanations, no jargon |
| Family member booking on someone's behalf | Fast flow, clarity on urgency, trust signals (ratings, distance, language match) |
| Hinglish/Hindi speaker | Input and responses must work in English, Hindi, and code-mixed Hinglish |

Design constraint: every screen must be understandable without reading the problem statement — no onboarding tutorial.

---

## 5. User Flow (maps to the 3 backend modules)

```
User describes need (text or voice, EN/HI/Hinglish)
        │
        ▼
[Module 1: Smart Intake]  ──► follow_up_question? ──yes──► ask (2–4 max), loop
        │ no
        ▼
[Module 2: Triage]  ──► red_flag? ──yes──► EMERGENCY PATH (call-for-help, skip matching)
        │ no
        ▼
[Module 3: Caregiver Matching]  ──► ranked list with reasons
        │
        ▼
User reviews recommendation + reasoning → one-tap booking → confirmation
```

### Screens required

1. **Home / Input screen** — text box + mic button, language auto-detect indicator, example prompt shown as placeholder.
2. **Conversation / Follow-up screen** — chat-like thread showing the assistant's follow-up questions (max 2–4), voice input per turn, progress indicator ("almost there").
3. **Emergency screen** (highest priority, distinct visual treatment — red/orange, large text) — clear call-for-help instructions, emergency contact/dial action, no caregiver matching shown.
4. **Recommendation screen** — care type, urgency badge (routine/same-day/immediate), plain-language reasoning text.
5. **Caregiver list screen** — ranked cards: name/role, distance, languages, rating, availability slot, **reason for match** (from API, shown verbatim/paraphrased).
6. **Booking confirmation screen** — one-tap confirm, summary, what happens next.
7. **Error / offline state** — API unreachable, timeout, retry affordance.

---

## 6. API Contract (consumed, not owned)

Frontend integrates strictly against the schema below (indicative; final version comes with the dataset — treat as a living doc, update `docs/api-contract.md` once backend/organizers finalize it).

**Request**
```json
{
  "user_input": "papa ko do din se bukhar hai aur khansi bhi",
  "language": "auto",
  "location": { "lat": 28.54, "lng": 77.27 },
  "conversation_history": []
}
```

**Response**
```json
{
  "follow_up_question": null,
  "care_type": "paramedic_home_visit",
  "urgency": "same_day",
  "red_flags": [],
  "reasoning": "Fever with cough for 2 days, no breathing difficulty reported",
  "matched_caregivers": [
    { "caregiver_id": "CG_014", "score": 0.92, "reason": "Hindi-speaking, 3 km away, free at 4 pm" }
  ]
}
```

**Frontend logic:**
- If `follow_up_question` is non-null → render it as the next chat turn, append the user's answer to `conversation_history`, re-call the API. Do **not** show care_type/urgency/caregivers yet.
- If `red_flags` is non-empty → route straight to Emergency screen. Suppress caregiver matching UI entirely, regardless of what else is in the payload.
- Otherwise → show Recommendation screen, then Caregiver list from `matched_caregivers` (already ranked by `score`; render in given order).

---

## 7. Best-Practice Integration Plan (frontend ↔ backend)

1. **Shared contract file in repo** — `docs/api-contract.md` / `openapi.yaml`, updated jointly whenever the schema changes. Never hand-sync verbally.
2. **API layer, not scattered fetches** — single `frontend/src/api/` module:
   - `client.ts` — base axios/fetch instance, `VITE_API_BASE_URL` from env, timeout + error interceptor
   - `careNavigation.ts` — `submitIntake(payload)` → typed response
3. **Mock-first development** — use MSW or a local `json-server` seeded with sample vignettes from the dataset so frontend isn't blocked waiting on backend. Toggle via `VITE_USE_MOCK=true`.
4. **Env-based base URL** — `.env.local` (gitignored) for local backend port, `.env.production` for deployed URL.
5. **CORS** — confirm early with backend teammate that `http://localhost:5173` (or chosen dev port) is allowed.
6. **Data fetching library** — React Query/TanStack Query for loading/error/retry states instead of manual `useEffect`.
7. **Versioning** — assume `/api/v1/...`; don't hardcode unversioned paths.
8. **Type safety** — derive TypeScript types from the JSON schema (zod or manually mirrored interfaces) so a backend field rename fails at compile time, not demo time.

---

## 8. Non-Functional Requirements

- **Accessibility:** large touch targets (≥44px), high contrast, screen-reader labels, works at 200% zoom.
- **Multilingual UI:** at minimum English + Hindi UI strings; Hinglish is handled by backend NLU, not frontend translation.
- **Voice:** Web Speech API (or equivalent) for both input (STT) and reading responses aloud (TTS) — critical for low-literacy users.
- **Performance:** perceived response within 2–3s; show a "thinking" state, never a blank screen, while the API call is in flight (ties to tie-break criterion: response time).
- **Resilience:** graceful handling of API timeout/5xx — retry button, never a silent failure.

---

## 9. Success Metrics (tied to judging rubric)

| Rubric item | Weight | Frontend responsibility |
|---|---|---|
| UX and demo | 20% | Clean flow, voice + multilingual support, no dead ends |
| Explainability | 10% | Every routing/matching decision visibly shows its `reasoning` / `reason` field, in plain language |
| Safety (partial) | 20% | Emergency path is unmissable, zero extra clicks to see call-for-help steps |
| Tie-break: response time | — | Fast perceived load, optimistic UI where safe |

---

## 10. Tech Stack (proposed — open choice per rules)

- **Framework:** React + Vite + TypeScript
- **Styling:** Tailwind CSS (fast iteration for hackathon timeline)
- **Data fetching:** TanStack Query
- **Mocking:** MSW
- **Voice:** Web Speech API (STT + TTS), fallback to text-only if unsupported
- **i18n:** `react-i18next` for UI string translation (EN/HI)

---

## 11. Open Items / Dependencies on Backend Team

- Final confirmed API schema (currently "indicative" per problem statement) — adopt once published with dataset.
- Caregiver profile fields available for display (confirm exact shape of `matched_caregivers[].reason` and whether more fields like `photo`, `role`, `phone` are returned).
- Auth requirements, if any, between frontend and backend for the hackathon demo (likely none — single deployed instance).
- Deployed backend base URL for the demo environment.

---

## 12. Deliverables Owned by Frontend

- Demo interface (web) — deliverable #2 in problem statement.
- Contribution to the 2-page write-up: UX approach, accessibility/voice/multilingual decisions, known UI limitations.
- Contribution to the 3-minute demo video: full user journey walkthrough.

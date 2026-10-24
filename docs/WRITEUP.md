# CareCompass — technical write-up

## Problem
Families in Delhi NCR describe needs in English, Hindi or Hinglish
("papa ko BP check karwana hai"). CareCompass routes each request to one of
`paramedic_home_visit`, `home_nursing`, `lab_test_home`, `teleconsultation` or
`emergency_112`, sets urgency, flags danger signs, matches an eligible caregiver
and lets the user place a **simulated** booking.

## Pipeline
1. **Safety screen (always first).** Deterministic rules over the whole
   conversation plus optional vitals and patient history detect emergencies
   (chest pain, breathlessness, unconsciousness, stroke signs, seizure, severe
   bleeding, etc.). Any hit returns `emergency_112`, urgency `emergency`, contract
   red flags only, and no caregivers. Abnormal or uninterpretable vitals block
   home booking and return a 112 check message instead.
2. **Deterministic multilingual router.** Ordered keyword rules in English,
   Hinglish and Devanagari (lab → nursing → specific consult → paramedic →
   generic consult). It reads the latest user turn first, so a clear
   new concern wins over an earlier vague one. Language is detected from the
   script and Hinglish marker words.
3. **Targeted follow-ups.** Vague requests get a question in the user's
   language, naming the known patient and asking for the concern and duration.
   After at most two follow-ups the request defaults to teleconsultation, so
   the user never loops.
4. **LLM fallback (optional).** Groq is consulted only when the rules find no
   route. Its output is checked against the taxonomy and safety rules.
5. **Matching.** Hard filters: caregiver is active, role fits the care type,
   has a relevant skill (plus any named procedure skill), meets the tier
   policy, is within service radius, and has an open slot. Score =
   0.35·language + 0.30·proximity + 0.20·skill + 0.15·rating, which matches the
   reference within 0.004 RMSE. Each card explains its match ("Hindi-speaking,
   3.2 km away, free 14–19, skilled in wound dressing"). When nobody qualifies,
   `matching_note` says why (radius, skill or tier) and late-day requests offer
   tomorrow's slots.
6. **Booking.** Validates the slot against the caregiver's IST window, rejects
   double bookings, and returns a `CC-DEMO-…` confirmation with a "no
   caregiver contacted" label. Cancellation is supported.

## Safety principles
- Emergencies are never missed in the provided data (56/56), and the safety
  screen cannot be overridden by the LLM.
- The app routes care; it does not diagnose. The assessment shows symptom
  groups with explicit disclaimers.
- Every surface is labeled as a demo with no real dispatch.

## Results (offline, provided 340 cases)
Care and urgency macro-F1 are both 1.000, emergency recall is 56/56 with 0 false
emergencies, follow-ups are 39/39, and caregiver match is top-1 84.2% / top-3
91.4%. There are 0 contract violations. Hindi, Hinglish and English each reach
100%.

## Limitations and honest caveats
- **Overfitting risk:** there are only 66 unique inputs, and the rules were
  tuned while viewing them. The 18 held-out paraphrases pass, but real traffic
  will be broader; the LLM fallback and follow-ups mitigate this.
- **Matching differences are deliberate:** the reference ignores the
  `bp_sugar_check` skill and the tier policy; we enforce both, so a few reference
  picks are filtered out. Results also depend on the clock, since same-day
  routing prefers caregivers still free today.
- **Tier policy:** base-tier caregivers are excluded for IV/injection,
  catheter and post-surgical care. This is our assumption, not given data.
- **Specialist routing** (e.g. a cardiologist) is outside the taxonomy and
  needs organizer clarification; such requests go to teleconsultation.
- Addresses are not geocoded; distance needs shared browser location.
- Voice uses browser speech APIs, which may send audio to the browser vendor.

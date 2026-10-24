# React + TypeScript + Vite

## CareCompass demo workspace

A fixed logo header keeps profile and login/logout controls visible while the
conversation scrolls independently. The desktop left sidebar lists conversations;
on small screens, use "Chat history". Every login and "New chat" creates a fresh
conversation ID. Logging out hides the profile and chats; logging back in with
the same account starts empty but lets you reopen its SQLite-backed history.
Signup creates a real password-protected account; use a password with at least
12 characters. Login verifies it, and logout revokes the server session.
Passwords are not saved in browser storage; only salted password hashes are
stored on the server. Authentication uses an HttpOnly SameSite=Strict cookie.
Closing the tab or restarting the app does not delete saved records.
Sent messages are saved to the API before triage runs. If you leave during a request
or it fails, reopen the chat and review/Send the unfinished message again.
Retrying the same unanswered message does not duplicate it in the saved history.
Each account can access only its own profile and chats. Saving failures are visible
and offer a retry; stale edits from another tab are rejected instead of overwritten.
Recommended caregivers can be booked (demo): pick an IST slot, confirm, and
cancel. Bookings are stored in SQLite and labeled "no caregiver contacted".
The EN/हिं toggle switches the interface, examples and voice language.
Care guidance remains a demo: do not enter real sensitive health information.
SQLite is not encrypted at rest or a certified medical record.

Profile contains optional age, reported medical history/medicines/allergies,
pregnancy and reduced-immunity flags, and a care address. Chat saves a patient
context snapshot separately for each conversation. Selecting "Someone else"
clears the account holder's history and vitals; a new chat is required to change
the patient after messages have been sent. New chats use the latest saved profile.
Saved conversations also retain the latest full assessment/recommendation, optional
shared coordinates, and demo caregiver selection. Reopened chats reuse their saved
coordinates until the user explicitly shares an updated location.

The Emergency example and chat toolbar immediately expose India call links for
112 and 102 without waiting for the API. Hospital examples from
`GET /api/hospitals/demo` are fictional, with unverified availability. Coordinates
only sort distances to fictional points; these are not real nearby hospitals.
Users may enter a preferred hospital or leave the choice to a dispatcher.
"Create demo ambulance request" saves a summary in the account's conversation. It does not send
a booking, contact a hospital, dispatch an ambulance, or confirm any ETA or beds.
Caregiver selection is likewise explicitly a demo, not a booking.

Symptoms and optional vitals/history are sent to the CareCompass API for a
non-diagnostic, rule-based safety screen. It flags reported danger signs before
AI intake, identifies broad symptom groups, explains unknown information, and
offers cautious comfort measures only alongside care-seeking advice. It cannot
diagnose an illness, confirm viral infection, or establish that staying home is safe.
Urgent cases do not offer home-caregiver booking. Saved replies retain those limits.

Run `npm test` for session, patient context, history, response text, and voice
regressions, `npm run build` for type checking/build, and `npm run lint` for lint.

## Demo profile and care greeting

The account's saved name, email, and care address personalize the greeting.
The previous browser-only mock accounts do not have real passwords and must sign
up first. On the profile page, optionally consent to importing earlier demo data
for the same email from the original browser tab. Import replaces the saved profile,
adds missing chats without overwriting database chats, and leaves legacy browser
data untouched. There is no automatic email-based migration, email verification,
or password reset.

The backend creates `backend/data/carecompass.sqlite3` on startup. See
`backend/README.md` for schema, APIs, backups, origins, and HTTPS cookie settings.
The Vite proxy uses same-origin cookies; an explicitly configured API base URL
must remain same-site and use an allowed origin.

Location is requested only after selecting "Use my current location". Permission
errors are displayed, and no demo coordinates are substituted. Care requests send
coordinates only when shared. Addresses are saved through the profile API but are
not geocoded or included in triage requests. Service example cards fill the message
box for review before sending.

If location fails, the page distinguishes denied permission, an unavailable
position, and a timeout. On macOS, check System Settings > Privacy & Security >
Location Services for the hosting browser or Copilot app, as well as the site's
location permission. Embedded previews may not support location; open the URL in
Safari or Chrome if needed. Log in there to access your database-backed profile
and history. Location requests accept a recent position and do not require GPS-grade
accuracy; no IP lookup or external address-geocoding service is used.

## Conversational voice controls

The care chat adapts Coderva's browser Web Speech approach: microphone dictation
with a live transcript, and speech synthesis with per-reply Listen/Stop controls.
Select English/Hinglish or Hindi, press Mic, speak, and press Stop mic. Review and
edit the captured text before Send; recording never automatically submits a request.
Existing typed text is preserved when dictation begins. Enable "Read replies aloud"
to hear new follow-up questions and care or emergency guidance automatically.
The greeting and prior replies can also be played on demand.

Voice controls require browser support and microphone/speech recognition permission.
Use localhost or HTTPS, and try Chrome or Safari outside an embedded preview if
recognition is unavailable. Browser recognition may use a remote speech service;
its network, microphone, and permission errors are shown in the chat. This browser
voice path does not use the backend Groq transcription endpoint or need a Groq key,
though clinical AI requests retain their existing backend configuration.
Playback stops before recording, and both microphone and audio stop on reset or
leaving the page. Local speech synthesis voices are preferred when available.
Run `npm run test:voice` for mocked speech lifecycle and transcript regression checks.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

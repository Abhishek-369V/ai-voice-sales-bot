# VoicePilot: AI Voice Sales Bot

Sankar Group 48-hour intern assignment. VoicePilot is a browser-based AI sales assistant for the fictional SaaS product **LeadPilot CRM**.

## Current milestone: Phase 4 - Call intelligence

### Implemented
- React + Vite frontend and FastAPI backend.
- Gemini responses through FastAPI; the API key stays server-side.
- Browser speech recognition, live transcript, interim speech text, language selection, and start/end call controls.
- Browser speech synthesis for English/Hindi; Telugu replies use a backend `gTTS` endpoint because a Telugu browser voice may not be installed.
- Explicit recording-consent checkbox. Audio recording starts only when the user opts in; calls can proceed without recording.
- SQLite persistence for completed call transcripts, duration, summary, requirements, objections, next steps, and one validated sales status.
- Playback of recordings saved with consent.
- Call-history list with transcript, summary, recording availability, and final sales status.
- Six allowed sales statuses: `Converted`, `Interested`, `Follow-up Required`, `Not Interested`, `Demo Requested`, and `No Response`.
- Mocked API regression tests and GitHub Actions checks for backend tests and frontend production build.

### Known limitations
- `gTTS` uses an unofficial Google Translate speech endpoint; it requires internet access and can be rate-limited or change without notice. It is a no-key, best-effort demo fallback, not a production SLA-backed TTS provider.
- Browser speech recognition availability and language quality depend on desktop browser support.
- The frontend currently sends each latest customer message to Gemini separately. Post-call analysis uses the complete saved transcript, but the live assistant is not yet given the full conversation history as model context.
- SQLite is intended for the demo/single-instance deployment. For multi-instance hosting, move call history and recordings to durable shared storage.
- The app stores recordings in the local SQLite database. Keep the database out of Git and consider retention/deletion controls before real customer use.
- The fictional LeadPilot CRM product facts are intentionally limited. Pricing, integrations, automated email campaigns, reminders, and analytics are unconfirmed and must not be represented as supported or unsupported without verified product information.

## Stack
- **Frontend:** React, Vite, CSS, Lucide icons.
- **Backend:** FastAPI, Uvicorn, Pydantic, Python `sqlite3`.
- **LLM:** Google Gen AI Python SDK with Gemini.
- **Voice input:** Browser Web Speech API.
- **English/Hindi voice output:** Browser SpeechSynthesis.
- **Telugu voice output:** Python `gTTS` best-effort backend fallback.
- **Recording:** Browser `getUserMedia` + `MediaRecorder`.

## Run locally

### 1. Backend

From the repository root:

```powershell
cd backend
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Set your real `GEMINI_API_KEY` in `backend/.env` without sharing or committing it, then run:

```powershell
uvicorn app.main:app --reload --port 8000
```

Swagger: `http://127.0.0.1:8000/docs`

### 2. Frontend

In a separate terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`). If needed, set `VITE_API_BASE_URL` to the backend base URL. This variable is public configuration; **never put the Gemini API key in the frontend**.

## Validate

Backend tests:

```powershell
cd backend
python -m pytest -q
```

Frontend production build:

```powershell
cd frontend
npm run build
```

## Browser and recording notes

- Use desktop Chrome or Edge for the best chance of speech-recognition support.
- Grant microphone permission when prompted.
- Recording is off by default. The user must explicitly check the recording-consent box before starting a call to capture and save audio.
- Audio playback requires the backend and the call-history database to remain available.
- Do not commit `.env`, recordings, or the SQLite database.

## Product guardrails

LeadPilot CRM is a fictional demo product. The assistant may state only confirmed capabilities: organizing leads, tracking sales opportunities, and managing follow-up activities. An unconfirmed feature is not necessarily unavailable; the bot should say it cannot confirm support and avoid inventing product facts.

## Project decisions

See [`decision_log.md`](./decision_log.md) for consequential architecture decisions and trade-offs.
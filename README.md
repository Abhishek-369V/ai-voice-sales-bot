# VoicePilot: AI Voice Sales Bot

Sankar Group 48-hour intern assignment. This project demonstrates a browser-based AI sales assistant for the fictional SaaS product **LeadPilot CRM**.

## Current milestone: Phase 2 - Browser voice MVP

### Implemented
- React + Vite frontend and FastAPI backend.
- Gemini responses requested through the backend; the API key remains server-side.
- Backend health check and text-based AI test.
- Browser speech recognition for customer input (where supported).
- Spoken Gemini replies using browser speech synthesis.
- Live customer/assistant transcript, interim speech text, and start/end voice-session controls.
- Language selection for English (India), Hindi, Telugu, and English (US), subject to browser speech support.
- Recognition pauses during AI response generation/playback to reduce feedback from the assistant's own voice.

### Not implemented yet
- Explicit recording-consent workflow and saved audio recordings.
- Persistent call history/database.
- Post-call AI summary, requirements, objections, and next steps.
- Automatic assignment of the required six sales statuses.
- Deployment and final demo recording.

## Stack
- **Frontend:** React, Vite, CSS, Lucide icons.
- **Backend:** FastAPI, Uvicorn, Pydantic.
- **LLM:** Google Gen AI Python SDK with Gemini.
- **Browser voice:** Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition` and `SpeechSynthesis`).

## Run locally

### 1. Backend

From the `backend` directory, activate your virtual environment and install dependencies if needed:

```powershell
python -m pip install -r requirements.txt
```

Create `backend/.env` from `.env.example` and set your actual API key and configured model. Keep `.env` out of Git. Then start the server from `backend`:

```powershell
uvicorn app.main:app --reload --port 8000
```

Swagger: `http://127.0.0.1:8000/docs`

### 2. Frontend

From the `frontend` directory:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`). If needed, set `VITE_API_BASE_URL` to the backend base URL. This variable is public configuration; **never put the Gemini API key in the frontend**.

## Browser notes

- Use desktop Chrome or Edge for the best chance of browser speech-recognition support.
- Grant microphone permission when prompted.
- Speech recognition availability and language support depend on the browser and environment.
- Voice sessions and transcripts are currently held in page memory only; they are not persisted after a reload.

## Product guardrails

LeadPilot CRM is a fictional demo product. The assistant must not invent prices, integrations, automated email-drip features, guarantees, or other product capabilities that have not been defined. It should say when a detail is unknown and answer customer questions directly rather than repeating internal instructions.

## Project decisions

See [`decision_log.md`](./decision_log.md) for the consequential architecture decisions, trade-offs, and validation criteria.

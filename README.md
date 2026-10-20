# AI Voice Sales Bot

Starter foundation for the Sankar Group 48-hour assignment.

## Work in Progress
## Current Status: Phase 1

## Included
- React + Vite frontend
- FastAPI backend
- Gemini API connectivity test
- Fictional demo product: LeadPilot CRM

Phase 1 does not yet implement live voice, recording, summaries, sales statuses, or call history.

## Requirements
Node.js 20+ and Python 3.11+ recommended. A Gemini API key is needed to test AI.

## Backend setup (Windows PowerShell)
```powershell
cd backend
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```
Edit `backend/.env` and set `GEMINI_API_KEY=your_key_here`.

Run:
```powershell
uvicorn app.main:app --reload --port 8000
```

macOS/Linux:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000
```

Check `http://127.0.0.1:8000/health` and `http://127.0.0.1:8000/docs`.

## Frontend setup
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the URL Vite prints, normally `http://localhost:5173`.

## Test the AI endpoint
With the backend running:
```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/ai-test -ContentType "application/json" -Body '{"message":"Can this CRM help track sales follow-ups?"}'
```
Or use `/docs` and try `POST /api/ai-test`.

## Security
Keep the API key in `backend/.env`. Never put it in React/Vite code or commit `.env`. The API is a local development starter; add rate limiting and production CORS restrictions before public deployment.

## Demo product
LeadPilot CRM is fictional and used only to demonstrate sales conversations. It is not represented as an actual Sankar Group product.
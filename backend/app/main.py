from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types

from app.config import settings
from app.schemas import AITestRequest, AITestResponse

import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Voice Sales Bot API",
    version="0.1.0",
    description="Phase 1 foundation for the Sankar Group AI Voice Sales Bot assignment.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

PRODUCT_CONTEXT = """
You are the sales assistant for LeadPilot CRM, a fictional SaaS demo product.
Product facts:
- Intended for small businesses.
- Helps organize leads, track sales opportunities, and manage follow-up activities.
- Do not invent prices, integrations, guarantees, customer counts, or unsupported features.
- Be friendly, concise, consultative, and ask one useful question when appropriate.
- If a detail is not specified, say so clearly.
- Never claim to be a human.
"""

@app.get("/")
def root():
    return {"name": "AI Voice Sales Bot API", "phase": 1, "docs": "/docs", "health": "/health"}

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-voice-sales-bot-api", "phase": 1}

@app.post("/api/ai-test", response_model=AITestResponse)
def ai_test(payload: AITestRequest):
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is missing. Copy backend/.env.example to backend/.env and set your key.",
        )
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=f"Customer message: {payload.message}",
            config=types.GenerateContentConfig(
                system_instruction=PRODUCT_CONTEXT,
                temperature=0.4,
                max_output_tokens=250,
            ),
        )
        reply = (response.text or "").strip()
        if not reply:
            raise RuntimeError("The model returned an empty response.")
        return AITestResponse(
            product="LeadPilot CRM (fictional demo product)",
            model=settings.gemini_model,
            reply=reply,
        )
    except Exception as exc:
        logger.exception("Gemini request failed")
        raise HTTPException(
            status_code=502,
            detail=(
                f"AI provider request failed ({type(exc).__name__}). Check the backend logs for details."
            ),
        ) from exc
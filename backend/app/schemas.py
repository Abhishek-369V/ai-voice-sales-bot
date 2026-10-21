from typing import Literal

from pydantic import BaseModel, Field


SalesStatus = Literal[
    "Converted",
    "Interested",
    "Follow-up Required",
    "Not Interested",
    "Demo Requested",
    "No Response",
]


class AITestRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class AITestResponse(BaseModel):
    product: str
    model: str
    reply: str


class TranscriptMessage(BaseModel):
    speaker: Literal["customer", "assistant"]
    text: str = Field(min_length=1, max_length=3000)
    time: str = Field(default="", max_length=40)


class CallFinalizeRequest(BaseModel):
    transcript: list[TranscriptMessage] = Field(default_factory=list, max_length=100)
    duration_seconds: int = Field(ge=0, le=86400)
    recording_consent: bool = False
    recording_base64: str | None = Field(default=None, max_length=15_000_000)
    recording_mime_type: str | None = Field(default=None, max_length=100)


class CallSummary(BaseModel):
    summary: str = Field(min_length=1, max_length=1200)
    customer_requirements: list[str] = Field(default_factory=list, max_length=12)
    objections: list[str] = Field(default_factory=list, max_length=12)
    next_steps: list[str] = Field(default_factory=list, max_length=12)
    sales_status: SalesStatus


class CallHistoryItem(BaseModel):
    id: int
    created_at: str
    duration_seconds: int
    transcript: list[TranscriptMessage]
    summary: str
    customer_requirements: list[str]
    objections: list[str]
    next_steps: list[str]
    sales_status: SalesStatus
    has_recording: bool
    recording_mime_type: str | None = None


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    language: Literal["te"] = "te"
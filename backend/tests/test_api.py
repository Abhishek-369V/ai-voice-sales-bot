"""Fast, deterministic API tests; no live Gemini request or API key required."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main


class FakeModels:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.last_kwargs = None

    def generate_content(self, **kwargs):
        self.last_kwargs = kwargs
        if self.error is not None:
            raise self.error
        return self.response


class FakeGenAIClient:
    def __init__(self, response=None, error=None):
        self.models = FakeModels(response=response, error=error)


def fake_response(text="Thanks for sharing that. How are you managing follow-ups today?"):
    return SimpleNamespace(
        text=text,
        candidates=[SimpleNamespace(finish_reason="STOP")],
        usage_metadata=SimpleNamespace(candidates_token_count=18),
    )


@pytest.fixture
def api_client(monkeypatch, tmp_path):
    """Use fake settings so tests do not need a local .env or real API key."""
    monkeypatch.setattr(
        main,
        "settings",
        SimpleNamespace(
            gemini_api_key="test-key-not-a-real-secret",
            gemini_model="test-model",
            frontend_origin="http://localhost:5173",
        ),
    )
    monkeypatch.setattr(main, "DB_PATH", tmp_path / "call-history.sqlite3")
    return TestClient(main.app)


def test_root_returns_service_information(api_client):
    response = api_client.get("/")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "AI Voice Sales Bot API"
    assert body["health"] == "/health"


def test_health_endpoint_returns_ok(api_client):
    response = api_client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ai_test_rejects_empty_message(api_client):
    response = api_client.post("/api/ai-test", json={"message": ""})

    assert response.status_code == 422


def test_ai_test_returns_503_when_api_key_is_missing(api_client, monkeypatch):
    monkeypatch.setattr(
        main,
        "settings",
        SimpleNamespace(
            gemini_api_key="",
            gemini_model="test-model",
            frontend_origin="http://localhost:5173",
        ),
    )

    response = api_client.post("/api/ai-test", json={"message": "Hello"})

    assert response.status_code == 503
    assert "GEMINI_API_KEY is missing" in response.json()["detail"]


def test_ai_test_returns_mocked_gemini_reply(api_client, monkeypatch):
    fake_client = FakeGenAIClient(response=fake_response())
    monkeypatch.setattr(main, "client", fake_client)

    response = api_client.post(
        "/api/ai-test",
        json={"message": "Can LeadPilot help with lead follow-ups?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["product"] == "LeadPilot CRM (fictional demo product)"
    assert body["model"] == "test-model"
    assert body["reply"] == "Thanks for sharing that. How are you managing follow-ups today?"
    assert fake_client.models.last_kwargs["model"] == "test-model"
    assert "Can LeadPilot help with lead follow-ups?" in fake_client.models.last_kwargs["contents"]


def test_ai_test_returns_502_when_model_reply_is_empty(api_client, monkeypatch):
    monkeypatch.setattr(main, "client", FakeGenAIClient(response=fake_response(text="  ")))

    response = api_client.post("/api/ai-test", json={"message": "Hello"})

    assert response.status_code == 502
    assert "RuntimeError" in response.json()["detail"]


def test_ai_test_returns_502_when_provider_raises(api_client, monkeypatch):
    monkeypatch.setattr(main, "client", FakeGenAIClient(error=ValueError("simulated provider failure")))

    response = api_client.post("/api/ai-test", json={"message": "Hello"})

    assert response.status_code == 502
    assert "ValueError" in response.json()["detail"]


def test_call_history_saves_no_response_status(api_client):
    response = api_client.post(
        "/api/calls",
        json={"transcript": [], "duration_seconds": 8, "recording_consent": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["sales_status"] == "No Response"
    assert body["has_recording"] is False
    assert body["summary"] == "No customer response was captured during this call."

    history = api_client.get("/api/calls")
    assert history.status_code == 200
    assert len(history.json()) == 1
    assert history.json()[0]["id"] == body["id"]


def test_call_history_rejects_recording_without_consent(api_client):
    response = api_client.post(
        "/api/calls",
        json={
            "transcript": [],
            "duration_seconds": 5,
            "recording_consent": False,
            "recording_base64": "dGVzdA==",
            "recording_mime_type": "audio/webm",
        },
    )

    assert response.status_code == 400
    assert "explicit recording consent" in response.json()["detail"]


def test_consented_recording_is_saved_and_playable(api_client):
    response = api_client.post(
        "/api/calls",
        json={
            "transcript": [],
            "duration_seconds": 5,
            "recording_consent": True,
            "recording_base64": "dGVzdCBhdWRpbw==",
            "recording_mime_type": "audio/webm",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["has_recording"] is True

    playback = api_client.get(f"/api/calls/{body['id']}/recording")
    assert playback.status_code == 200
    assert playback.content == b"test audio"
    assert playback.headers["content-type"].startswith("audio/webm")


@pytest.mark.parametrize("language", ["te", "hi", "en"])
def test_tts_returns_audio_bytes_for_supported_languages(
    api_client, monkeypatch, language
):
    calls = []

    class FakeTTS:
        def __init__(self, text, lang, slow):
            calls.append((text, lang, slow))

        def write_to_fp(self, file_obj):
            file_obj.write(b"fake-mp3-audio")

    # Patch the exact symbol used by app.main.
    monkeypatch.setattr(main, "gTTS", FakeTTS)

    response = api_client.post(
        "/api/tts",
        json={"text": "నమస్కారం", "language": language},
    )

    assert response.status_code == 200
    assert response.content == b"fake-mp3-audio"
    assert response.headers["content-type"].startswith("audio/mpeg")
    assert calls == [("నమస్కారం", language, False)]


def test_tts_rejects_unsupported_language(api_client):
    response = api_client.post("/api/tts", json={"text": "Hello", "language": "fr"})

    assert response.status_code == 422


def test_call_summary_uses_only_allowed_sales_statuses(api_client, monkeypatch):
    summary_json = (
        '{"summary":"Customer wants help tracking leads.",'
        '"customer_requirements":["Track leads"],"objections":[],'
        '"next_steps":["Offer a demo"],"sales_status":"Interested"}'
    )
    fake_client = FakeGenAIClient(response=fake_response(text=summary_json))
    monkeypatch.setattr(main, "client", fake_client)

    response = api_client.post(
        "/api/calls",
        json={
            "transcript": [
                {"speaker": "customer", "text": "I want to track my leads."},
                {"speaker": "assistant", "text": "LeadPilot helps organize leads."},
            ],
            "duration_seconds": 22,
            "recording_consent": False,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["sales_status"] == "Interested"
    assert body["customer_requirements"] == ["Track leads"]
    assert body["has_recording"] is False
    assert fake_client.models.last_kwargs["config"].response_mime_type == "application/json"
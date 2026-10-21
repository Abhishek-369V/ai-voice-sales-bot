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
def api_client(monkeypatch):
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
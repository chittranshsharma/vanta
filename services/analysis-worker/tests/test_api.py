import os

from fastapi.testclient import TestClient

from app.main import app

WS = "11111111-2222-3333-4444-555555555555"


def _req(csv_text: str, column_map: dict | None = None) -> dict:
    return {
        "job_id": "job-1",
        "workspace_id": WS,
        "correlation_id": "corr-1",
        "payload": {"csv_text": csv_text, "source_id": WS, "column_map": column_map or {}},
    }


def test_healthz_needs_no_token():
    with TestClient(app) as c:
        r = c.get("/healthz")
        assert r.status_code == 200
        assert r.json()["service"] == "vanta-analysis-service"


def test_unconfigured_service_fails_closed(monkeypatch):
    monkeypatch.delenv("ANALYSIS_SERVICE_TOKEN", raising=False)
    with TestClient(app) as c:
        r = c.post("/jobs/campaign-csv-normalize", json=_req("Date,Clicks\n2026-01-01,1\n"), headers={"Authorization": "Bearer x"})
        assert r.status_code == 503


def test_token_required_and_checked(monkeypatch):
    monkeypatch.setenv("ANALYSIS_SERVICE_TOKEN", "secret")
    with TestClient(app) as c:
        assert c.post("/jobs/campaign-csv-normalize", json=_req("Date,Clicks\n2026-01-01,1\n")).status_code == 401
        r = c.post("/jobs/campaign-csv-normalize", json=_req("Date,Clicks\n2026-01-01,1\n"), headers={"Authorization": "Bearer wrong"})
        assert r.status_code == 403


def test_normalize_returns_typed_rows_and_provenance(monkeypatch):
    monkeypatch.setenv("ANALYSIS_SERVICE_TOKEN", "secret")
    with TestClient(app) as c:
        r = c.post(
            "/jobs/campaign-csv-normalize",
            json=_req("Date,Platform,Impressions\n2026-03-01,ig,1000\n03/04/2026,ig,5\n"),
            headers={"Authorization": "Bearer secret"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["job_id"] == "job-1"
        assert body["provenance"]["schema_version"] == "1.0.0"
        assert body["provenance"]["coverage"] == "complete"
        assert body["provenance"]["header_map"]["Impressions"] == "metric:impressions"
        assert body["rows"][0]["evidence_class"] == "observed"
        assert body["rows"][1]["date_ambiguous"] is True


def test_no_metric_columns_is_422_not_prose(monkeypatch):
    monkeypatch.setenv("ANALYSIS_SERVICE_TOKEN", "secret")
    with TestClient(app) as c:
        r = c.post("/jobs/campaign-csv-normalize", json=_req("Date,Notes\n2026-01-01,hi\n"), headers={"Authorization": "Bearer secret"})
        assert r.status_code == 422
        assert r.json()["error"] == "no_metric_columns"


def test_oversized_csv_rejected_by_contract(monkeypatch):
    monkeypatch.setenv("ANALYSIS_SERVICE_TOKEN", "secret")
    big = "Date,Clicks\n" + ("2026-01-01,1\n" * 200_000)
    with TestClient(app) as c:
        r = c.post("/jobs/campaign-csv-normalize", json=_req(big), headers={"Authorization": "Bearer secret"})
        assert r.status_code == 422

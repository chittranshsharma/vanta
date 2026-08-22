# Vanta Analysis Service (Upgrade B)

Status: authored, not deployed.

Small FastAPI worker with explicit job contracts. Receives typed inputs from the Node job worker, returns typed rows with provenance (service version, schema version, header map, skipped rows with reasons, coverage, evidence class). Never reads the database, never returns prose.

## Jobs

| Endpoint | Contract | Output evidence class |
|---|---|---|
| `POST /jobs/campaign-csv-normalize` | `CampaignCsvNormalizeRequest` -> `CampaignCsvNormalizeResult` | `observed` per row |

Ambiguous dates (`03/04/2026`) are parsed as month/day and flagged `date_ambiguous = true`; they are never silently guessed. Rows that cannot be parsed are listed in `skipped` with a reason, and `coverage` becomes `partial`.

## Run locally

```bash
cd services/analysis-worker
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
pytest
ANALYSIS_SERVICE_TOKEN=dev uvicorn app.main:app --port 8000
```

## Security

- Bearer token shared with the job worker only (`ANALYSIS_SERVICE_TOKEN`). Unconfigured token = every request refused (503).
- No database credentials. Results flow back through the job worker into Postgres with the job's provenance.
- Input caps: 2 MB CSV, 50 000 rows.

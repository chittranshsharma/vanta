"""Vanta analysis service (Upgrade B): FastAPI worker with explicit job contracts.

Authentication: a shared bearer token (ANALYSIS_SERVICE_TOKEN) presented by
the Node job worker. This service is never exposed to browsers and never
reads the database; it receives typed inputs and returns typed results with
provenance. It is not a second source of truth.

Not deployed. Run locally:
    ANALYSIS_SERVICE_TOKEN=dev uvicorn app.main:app --port 8000
"""

from __future__ import annotations

import hmac
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import JSONResponse

from .contracts import (
    SERVICE_VERSION,
    CampaignCsvNormalizeRequest,
    CampaignCsvNormalizeResult,
    NormalizedMetricRow,
    Provenance,
    ServiceError,
    SkippedRow,
)
from .normalize import normalize_campaign_csv

app = FastAPI(title="Vanta Analysis Service", version=SERVICE_VERSION, docs_url=None, redoc_url=None)


def require_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("ANALYSIS_SERVICE_TOKEN")
    if not expected:
        # Fail closed: an unconfigured service accepts nothing.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="service token not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="bearer token required")
    presented = authorization[len("Bearer ") :]
    if not hmac.compare_digest(presented, expected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid token")


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "service": "vanta-analysis-service", "version": SERVICE_VERSION}


@app.post(
    "/jobs/campaign-csv-normalize",
    response_model=CampaignCsvNormalizeResult,
    responses={422: {"model": ServiceError}},
    dependencies=[Depends(require_token)],
)
def campaign_csv_normalize(req: CampaignCsvNormalizeRequest):
    outcome = normalize_campaign_csv(req.payload.csv_text, req.payload.column_map)

    if not outcome.header_map.metrics:
        return JSONResponse(
            status_code=422,
            content=ServiceError(
                error="no_metric_columns",
                message="; ".join(outcome.notes) or "no metric columns recognized",
                correlation_id=req.correlation_id,
            ).model_dump(),
        )

    rows = [NormalizedMetricRow(**r) for r in outcome.rows]
    skipped = [SkippedRow(source_row=n, reason=reason) for n, reason in outcome.skipped]
    provenance = Provenance(
        processed_at=datetime.now(timezone.utc),
        source_id=req.payload.source_id,
        header_map=outcome.header_map.as_dict(),
        row_count_in=outcome.row_count_in,
        row_count_out=len(rows),
        coverage=outcome.coverage,  # type: ignore[arg-type]
        notes=outcome.notes,
    )
    return CampaignCsvNormalizeResult(
        job_id=req.job_id,
        correlation_id=req.correlation_id,
        rows=rows,
        skipped=skipped,
        provenance=provenance,
    )

"""Typed job contracts for the Vanta analysis service (Upgrade B).

Every response carries provenance: service version, schema version,
processing timestamp, coverage, skipped rows with reasons, and the evidence
class of the rows it returns. The service never returns prose.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

SERVICE_VERSION = "0.1.0"
CAMPAIGN_CSV_SCHEMA_VERSION = "1.0.0"

MAX_CSV_BYTES = 2 * 1024 * 1024
MAX_ROWS = 50_000

EvidenceClass = Literal["observed", "sourced_claim", "inference", "simulation", "unknown"]
Coverage = Literal["complete", "partial", "unknown"]


class JobEnvelope(BaseModel):
    """Common fields the Node worker forwards for every job."""

    job_id: str = Field(min_length=1, max_length=64)
    workspace_id: str = Field(min_length=36, max_length=36)
    correlation_id: str = Field(min_length=1, max_length=64)


class CampaignCsvNormalizeRequest(JobEnvelope):
    payload: "CampaignCsvPayload"


class CampaignCsvPayload(BaseModel):
    """CSV text is passed inline in this first version. Storage references
    (signed URLs) arrive with Upgrade D."""

    csv_text: str = Field(min_length=1)
    source_id: str = Field(min_length=36, max_length=36, description="source_registry row the import belongs to")
    declared_platform: str | None = Field(default=None, max_length=64)
    # Optional explicit header mapping supplied by the user; wins over heuristics.
    column_map: dict[str, str] = Field(default_factory=dict)

    @field_validator("csv_text")
    @classmethod
    def _size(cls, v: str) -> str:
        if len(v.encode("utf-8")) > MAX_CSV_BYTES:
            raise ValueError(f"csv_text exceeds {MAX_CSV_BYTES} bytes")
        return v


class NormalizedMetricRow(BaseModel):
    """One observed metric value. Every field is traceable to a source row."""

    observed_date: str | None = Field(description="ISO date or null when the row had no parseable date")
    date_ambiguous: bool = False
    channel: str | None = None
    campaign: str | None = None
    metric_key: str
    value: float
    unit: str | None = None
    source_row: int = Field(ge=1, description="1-based data row index in the original CSV")
    evidence_class: EvidenceClass = "observed"


class SkippedRow(BaseModel):
    source_row: int
    reason: str


class Provenance(BaseModel):
    service_version: str = SERVICE_VERSION
    schema_version: str = CAMPAIGN_CSV_SCHEMA_VERSION
    processed_at: datetime
    source_id: str
    header_map: dict[str, str]
    row_count_in: int
    row_count_out: int
    coverage: Coverage
    notes: list[str] = Field(default_factory=list)


class CampaignCsvNormalizeResult(BaseModel):
    job_id: str
    correlation_id: str
    rows: list[NormalizedMetricRow]
    skipped: list[SkippedRow]
    provenance: Provenance


class ServiceError(BaseModel):
    error: str
    message: str
    correlation_id: str | None = None

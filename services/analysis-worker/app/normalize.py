"""Deterministic campaign CSV normalization.

Pure functions. No I/O. Every decision (header mapping, date parsing,
numeric parsing, skipped rows) is recorded so the result can be audited.
Ambiguous dates are flagged, never guessed silently.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date

# Canonical column roles the normalizer understands.
ROLE_DATE = "date"
ROLE_CHANNEL = "channel"
ROLE_CAMPAIGN = "campaign"
ROLES_META = (ROLE_DATE, ROLE_CHANNEL, ROLE_CAMPAIGN)

# Metric synonyms -> (metric_key, unit). Keys match the workspace metric dictionary conventions.
METRIC_SYNONYMS: dict[str, tuple[str, str | None]] = {
    "impressions": ("impressions", "count"),
    "impr": ("impressions", "count"),
    "views": ("views", "count"),
    "reach": ("reach", "count"),
    "clicks": ("clicks", "count"),
    "link clicks": ("clicks", "count"),
    "ctr": ("ctr", "ratio"),
    "spend": ("spend", "currency"),
    "cost": ("spend", "currency"),
    "amount spent": ("spend", "currency"),
    "conversions": ("conversions", "count"),
    "purchases": ("conversions", "count"),
    "results": ("conversions", "count"),
    "cpc": ("cpc", "currency"),
    "cpm": ("cpm", "currency"),
    "engagements": ("engagements", "count"),
    "likes": ("likes", "count"),
    "comments": ("comments", "count"),
    "shares": ("shares", "count"),
    "saves": ("saves", "count"),
    "video views": ("video_views", "count"),
    "watch time": ("watch_time_seconds", "seconds"),
}

META_SYNONYMS: dict[str, str] = {
    "date": ROLE_DATE,
    "day": ROLE_DATE,
    "reporting date": ROLE_DATE,
    "channel": ROLE_CHANNEL,
    "platform": ROLE_CHANNEL,
    "source": ROLE_CHANNEL,
    "campaign": ROLE_CAMPAIGN,
    "campaign name": ROLE_CAMPAIGN,
    "ad set": ROLE_CAMPAIGN,
}


def _norm_header(h: str) -> str:
    return re.sub(r"[\s_\-]+", " ", h.strip().lower())


@dataclass
class HeaderMap:
    meta: dict[str, str] = field(default_factory=dict)  # original header -> role
    metrics: dict[str, tuple[str, str | None]] = field(default_factory=dict)  # original header -> (metric_key, unit)
    unmapped: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, str]:
        out = {h: role for h, role in self.meta.items()}
        out.update({h: f"metric:{k}" for h, (k, _) in self.metrics.items()})
        out.update({h: "unmapped" for h in self.unmapped})
        return out


def map_headers(headers: list[str], explicit: dict[str, str] | None = None) -> HeaderMap:
    """Explicit map values: 'date' | 'channel' | 'campaign' | 'metric:<key>' | 'metric:<key>:<unit>' | 'ignore'."""
    hm = HeaderMap()
    explicit = explicit or {}
    for h in headers:
        if h in explicit:
            target = explicit[h]
            if target == "ignore":
                hm.unmapped.append(h)
            elif target in ROLES_META:
                hm.meta[h] = target
            elif target.startswith("metric:"):
                parts = target.split(":")
                key = parts[1].strip()
                unit = parts[2].strip() if len(parts) > 2 else None
                if key:
                    hm.metrics[h] = (key, unit)
                else:
                    hm.unmapped.append(h)
            else:
                hm.unmapped.append(h)
            continue
        n = _norm_header(h)
        if n in META_SYNONYMS:
            hm.meta[h] = META_SYNONYMS[n]
        elif n in METRIC_SYNONYMS:
            hm.metrics[h] = METRIC_SYNONYMS[n]
        else:
            hm.unmapped.append(h)
    return hm


_ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
_SLASH = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")


def parse_date(raw: str) -> tuple[str | None, bool]:
    """Returns (iso_date, ambiguous). Slash dates where both parts <= 12 are ambiguous
    (could be D/M or M/D); they are parsed as M/D and flagged so the UI can say so."""
    s = raw.strip()
    m = _ISO.match(s)
    if m:
        y, mo, d = (int(x) for x in m.groups())
        try:
            return date(y, mo, d).isoformat(), False
        except ValueError:
            return None, False
    m = _SLASH.match(s)
    if m:
        a, b, y = (int(x) for x in m.groups())
        ambiguous = a <= 12 and b <= 12 and a != b
        mo, d = (a, b) if a <= 12 else (b, a)
        try:
            return date(y, mo, d).isoformat(), ambiguous
        except ValueError:
            return None, False
    return None, False


_NUM = re.compile(r"^-?\d+(\.\d+)?$")


def parse_number(raw: str) -> float | None:
    s = raw.strip().replace(",", "")
    if s.endswith("%"):
        s = s[:-1]
        if _NUM.match(s):
            return float(s) / 100.0
        return None
    s = re.sub(r"^[^\d\-]+", "", s)  # strip currency symbols
    if _NUM.match(s):
        return float(s)
    return None


@dataclass
class NormalizeOutcome:
    header_map: HeaderMap
    rows: list[dict] = field(default_factory=list)
    skipped: list[tuple[int, str]] = field(default_factory=list)
    row_count_in: int = 0
    notes: list[str] = field(default_factory=list)

    @property
    def coverage(self) -> str:
        if self.row_count_in == 0:
            return "unknown"
        if self.skipped:
            return "partial"
        if self.header_map.unmapped:
            return "partial"
        return "complete"


def normalize_campaign_csv(csv_text: str, explicit_map: dict[str, str] | None = None, max_rows: int = 50_000) -> NormalizeOutcome:
    reader = csv.reader(io.StringIO(csv_text))
    try:
        headers = next(reader)
    except StopIteration:
        hm = HeaderMap()
        out = NormalizeOutcome(header_map=hm)
        out.notes.append("empty file")
        return out

    headers = [h.strip() for h in headers]
    hm = map_headers(headers, explicit_map)
    out = NormalizeOutcome(header_map=hm)

    if not hm.metrics:
        out.notes.append("no metric columns recognized; supply column_map")
        return out
    if ROLE_DATE not in hm.meta.values():
        out.notes.append("no date column recognized; rows carry observed_date = null")

    idx = {h: i for i, h in enumerate(headers)}
    seen: set[tuple] = set()

    for row_num, row in enumerate(reader, start=1):
        out.row_count_in += 1
        if out.row_count_in > max_rows:
            out.notes.append(f"stopped after {max_rows} rows")
            break
        if len(row) != len(headers):
            out.skipped.append((row_num, "column count mismatch"))
            continue
        if all(not c.strip() for c in row):
            out.skipped.append((row_num, "blank row"))
            continue

        observed_date: str | None = None
        ambiguous = False
        channel = None
        campaign = None
        for h, role in hm.meta.items():
            val = row[idx[h]]
            if role == ROLE_DATE:
                observed_date, ambiguous = parse_date(val)
                if observed_date is None and val.strip():
                    out.skipped.append((row_num, f"unparseable date '{val.strip()[:32]}'"))
                    break
            elif role == ROLE_CHANNEL:
                channel = val.strip() or None
            elif role == ROLE_CAMPAIGN:
                campaign = val.strip() or None
        else:
            emitted = 0
            for h, (metric_key, unit) in hm.metrics.items():
                raw = row[idx[h]]
                if not raw.strip():
                    continue
                value = parse_number(raw)
                if value is None:
                    out.skipped.append((row_num, f"non-numeric value for {metric_key}"))
                    continue
                key = (observed_date, channel, campaign, metric_key)
                if key in seen:
                    out.skipped.append((row_num, f"duplicate {metric_key} for same date/channel/campaign"))
                    continue
                seen.add(key)
                out.rows.append(
                    {
                        "observed_date": observed_date,
                        "date_ambiguous": ambiguous,
                        "channel": channel,
                        "campaign": campaign,
                        "metric_key": metric_key,
                        "value": value,
                        "unit": unit,
                        "source_row": row_num,
                        "evidence_class": "observed",
                    }
                )
                emitted += 1
            if emitted == 0:
                out.skipped.append((row_num, "no metric values"))
    return out

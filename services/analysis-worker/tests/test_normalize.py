from app.normalize import map_headers, normalize_campaign_csv, parse_date, parse_number


def test_map_headers_recognizes_synonyms_and_flags_unknown():
    hm = map_headers(["Date", "Platform", "Campaign Name", "Impressions", "Amount Spent", "Mystery"])
    assert hm.meta == {"Date": "date", "Platform": "channel", "Campaign Name": "campaign"}
    assert hm.metrics["Impressions"] == ("impressions", "count")
    assert hm.metrics["Amount Spent"] == ("spend", "currency")
    assert hm.unmapped == ["Mystery"]


def test_explicit_map_overrides_heuristics():
    hm = map_headers(["Mystery", "Impressions"], {"Mystery": "metric:leads:count", "Impressions": "ignore"})
    assert hm.metrics == {"Mystery": ("leads", "count")}
    assert hm.unmapped == ["Impressions"]


def test_parse_date_iso_and_ambiguity():
    assert parse_date("2026-03-04") == ("2026-03-04", False)
    assert parse_date("03/04/2026") == ("2026-03-04", True)  # could be 3 Apr or 4 Mar
    assert parse_date("13/04/2026") == ("2026-04-13", False)  # unambiguous: 13 cannot be a month
    assert parse_date("2026-02-30") == (None, False)
    assert parse_date("yesterday") == (None, False)


def test_parse_number_handles_commas_currency_percent():
    assert parse_number("1,234") == 1234.0
    assert parse_number("$12.50") == 12.5
    assert parse_number("3.5%") == 0.035
    assert parse_number("n/a") is None


def test_normalize_happy_path_is_observed_and_traceable():
    csv_text = "Date,Platform,Impressions,Clicks\n2026-03-01,instagram,1000,50\n2026-03-02,instagram,1200,61\n"
    out = normalize_campaign_csv(csv_text)
    assert out.row_count_in == 2
    assert len(out.rows) == 4
    assert out.skipped == []
    assert out.coverage == "complete"
    first = out.rows[0]
    assert first["metric_key"] == "impressions" and first["value"] == 1000.0
    assert first["source_row"] == 1 and first["evidence_class"] == "observed"
    assert first["observed_date"] == "2026-03-01"


def test_normalize_skips_bad_rows_with_reasons_and_reports_partial():
    csv_text = (
        "Date,Channel,Impressions\n"
        "2026-03-01,x,100\n"
        "not-a-date,x,100\n"
        "2026-03-02,x,abc\n"
        "2026-03-03,x\n"
        ",,\n"
        "2026-03-01,x,999\n"
    )
    out = normalize_campaign_csv(csv_text)
    reasons = [r for _, r in out.skipped]
    assert any("unparseable date" in r for r in reasons)
    assert any("non-numeric" in r for r in reasons)
    assert any("column count mismatch" in r for r in reasons)
    assert any("blank row" in r for r in reasons)
    assert any("duplicate impressions" in r for r in reasons)
    assert out.coverage == "partial"
    assert len(out.rows) == 1


def test_normalize_without_metrics_returns_note_and_no_rows():
    out = normalize_campaign_csv("Date,Notes\n2026-01-01,hello\n")
    assert out.rows == []
    assert "no metric columns recognized; supply column_map" in out.notes


def test_normalize_without_date_column_keeps_rows_with_null_date():
    out = normalize_campaign_csv("Channel,Clicks\nig,5\n")
    assert out.rows[0]["observed_date"] is None
    assert any("no date column" in n for n in out.notes)


def test_row_cap_is_honest():
    body = "\n".join(f"2026-01-01,c{i},{i}" for i in range(10))
    out = normalize_campaign_csv("Date,Campaign,Clicks\n" + body + "\n", max_rows=3)
    assert any("stopped after 3 rows" in n for n in out.notes)
    assert len(out.rows) == 3

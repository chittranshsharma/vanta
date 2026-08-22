import { describe, expect, it } from "vitest";
import { buildImportPlan, parseCsv, parseMetricValue, parseObservedAt, suggestColumnMap, type ColumnMap, type VariantRef } from "./outcomeImport";

const variants: VariantRef[] = [{ id: "11111111-1111-1111-1111-111111111111", label: "Hook A" }, { id: "22222222-2222-2222-2222-222222222222", label: "Hook B" }];
const map: ColumnMap = { variant: "variant", value: "value", observedAt: "date" };

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, and CRLF", () => {
    const p = parseCsv('a,b\r\n"x,1","he said ""hi"""\r\n');
    expect(p.headers).toEqual(["a", "b"]);
    expect(p.rows).toEqual([{ a: "x,1", b: 'he said "hi"' }]);
  });
  it("records rows with the wrong field count instead of padding them", () => {
    const p = parseCsv("a,b\n1\n2,3\n");
    expect(p.rows).toEqual([{ a: "2", b: "3" }]);
    expect(p.malformedLines).toEqual([{ line: 2, reason: "Expected 2 fields, found 1." }]);
  });
  it("truncates beyond the row cap and says so", () => {
    const p = parseCsv(["a", ...Array.from({ length: 5 }, (_, i) => String(i))].join("\n"), 3);
    expect(p.rows).toHaveLength(3);
    expect(p.truncated).toBe(true);
  });
});

describe("parseObservedAt", () => {
  it("accepts ISO dates and timestamps without ambiguity", () => {
    expect(parseObservedAt("2026-08-01")).toEqual({ iso: "2026-08-01T00:00:00.000Z", ambiguous: false });
    expect(parseObservedAt("2026-08-01T12:30:00Z").iso).toBe("2026-08-01T12:30:00.000Z");
  });
  it("flags slash dates where both parts could be the month", () => {
    expect(parseObservedAt("03/04/2026").ambiguous).toBe(true);
    expect(parseObservedAt("13/04/2026")).toEqual({ iso: "2026-04-13T00:00:00.000Z", ambiguous: false });
  });
  it("returns null for anything it cannot read", () => {
    expect(parseObservedAt("last tuesday").iso).toBeNull();
    expect(parseObservedAt("").iso).toBeNull();
  });
});

describe("parseMetricValue", () => {
  it("reads plain, separated, and percent numbers and rejects the rest", () => {
    expect(parseMetricValue("1,234.5").value).toBe(1234.5);
    expect(parseMetricValue("42%")).toEqual({ value: 0.42, note: "percent converted to ratio" });
    expect(parseMetricValue("about 12").value).toBeNull();
    expect(parseMetricValue("1e5").value).toBeNull();
  });
});

describe("buildImportPlan", () => {
  it("accepts matched rows by label or id and counts coverage per variant", () => {
    const csv = [
      "variant,value,date",
      "Hook A,100,2026-08-01",
      "22222222-2222-2222-2222-222222222222,0.5,2026-08-02",
      "Hook A,110,2026-08-03"
    ].join("\n");
    const plan = buildImportPlan({ csvText: csv, columnMap: map, variants, metricKey: "views" });
    expect(plan.accepted).toHaveLength(3);
    expect(plan.perVariant).toEqual([
      { variant_twin_id: variants[0].id, label: "Hook A", rows: 2 },
      { variant_twin_id: variants[1].id, label: "Hook B", rows: 1 }
    ]);
  });

  it("rejects unknown variants, unreadable numbers, and unparseable dates with reasons", () => {
    const csv = ["variant,value,date", "Hook Z,1,2026-08-01", "Hook A,n/a,2026-08-01", "Hook A,1,someday", ",1,2026-08-01"].join("\n");
    const plan = buildImportPlan({ csvText: csv, columnMap: map, variants, metricKey: "views" });
    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected.map((r) => r.reason)).toEqual([
      expect.stringMatching(/not one of this experiment's variants/),
      expect.stringMatching(/never guessed/),
      expect.stringMatching(/could not be parsed/),
      "Variant cell is empty."
    ]);
  });

  it("carries the ambiguity flag through to the plan", () => {
    const plan = buildImportPlan({ csvText: "variant,value,date\nHook A,1,03/04/2026", columnMap: map, variants, metricKey: "views" });
    expect(plan.ambiguousDates).toBe(1);
    expect(plan.accepted[0].notes).toEqual([expect.stringMatching(/ambiguous/)]);
  });

  it("rejects everything when the mapping names headers the file does not have", () => {
    const plan = buildImportPlan({ csvText: "a,b,c\n1,2,3", columnMap: map, variants, metricKey: "views" });
    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected[0].reason).toMatch(/headers not in the file/);
  });
});

describe("suggestColumnMap", () => {
  it("suggests only confident matches and leaves the rest empty", () => {
    expect(suggestColumnMap(["Variant", "Value", "Date"])).toEqual({ variant: "Variant", value: "Value", observedAt: "Date" });
    expect(suggestColumnMap(["col1", "col2"])).toEqual({ variant: "", value: "", observedAt: "" });
  });
});

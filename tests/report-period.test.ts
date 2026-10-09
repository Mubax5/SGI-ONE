import { describe, expect, it } from "vitest";
import {
  defaultReportPeriod,
  parseReportDay,
  recentReportPeriod,
  reportDay,
} from "@/lib/report-period";
describe("report dates in WIB", () => {
  it("uses the Jakarta day across UTC midnight and year boundaries", () => {
    expect(reportDay(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
    expect(defaultReportPeriod(new Date("2026-12-31T17:00:00Z"))).toEqual({
      from: "2027-01-01",
      to: "2027-01-01",
    });
  });
  it("parses midnight WIB independently of the host time zone", () => {
    expect(parseReportDay("2026-10-09")?.toISOString()).toBe(
      "2026-10-08T17:00:00.000Z",
    );
  });
  it("accepts a real leap day and rejects normalization of invalid days", () => {
    expect(parseReportDay("2028-02-29")).toBeDefined();
    for (const value of [
      "2026-02-29",
      "2026-02-31",
      "2026-13-01",
      "2026-10-00",
      "2026-1-9",
      "2026-10-09T00:00:00Z",
      "",
    ])
      expect(parseReportDay(value)).toBeUndefined();
  });
  it("includes today in recent ranges across month boundaries", () => {
    expect(recentReportPeriod(7, new Date("2026-03-01T10:00:00Z"))).toEqual({
      from: "2026-02-23",
      to: "2026-03-01",
    });
    expect(recentReportPeriod(30, new Date("2026-01-01T00:00:00Z"))).toEqual({
      from: "2025-12-03",
      to: "2026-01-01",
    });
  });
});

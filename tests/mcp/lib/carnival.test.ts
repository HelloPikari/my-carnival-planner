import { describe, it, expect } from "vitest";
import {
  easterSunday,
  carnivalMonday,
  carnivalMondayISO,
  daysFromCarnivalMonday,
} from "@/src/mcp/lib/carnival.js";

describe("easterSunday", () => {
  // Reference dates from Western (Gregorian) Easter tables.
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
  ])("year %i → %s", (year, iso) => {
    expect(easterSunday(year).toISOString().slice(0, 10)).toBe(iso);
  });
});

describe("carnivalMonday", () => {
  // 2025 and 2026 anchors match seedStatic's hardcoded startDate values.
  it.each([
    [2024, "2024-02-12"],
    [2025, "2025-03-03"],
    [2026, "2026-02-16"],
    [2027, "2027-02-08"],
  ])("year %i → %s", (year, iso) => {
    expect(carnivalMondayISO(year)).toBe(iso);
  });

  it("returns a UTC Date", () => {
    const d = carnivalMonday(2026);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(1); // Feb
    expect(d.getUTCDate()).toBe(16);
  });
});

describe("daysFromCarnivalMonday", () => {
  it("returns 0 for Carnival Monday itself", () => {
    expect(daysFromCarnivalMonday("2026-02-16", 2026)).toBe(0);
  });

  it("returns negative for dates before", () => {
    expect(daysFromCarnivalMonday("2026-02-10", 2026)).toBe(-6);
  });

  it("returns positive for dates after", () => {
    expect(daysFromCarnivalMonday("2026-02-18", 2026)).toBe(2);
  });

  it("accepts Date objects too", () => {
    expect(daysFromCarnivalMonday(new Date("2026-02-15"), 2026)).toBe(-1);
  });
});

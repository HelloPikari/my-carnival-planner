import { describe, it, expect } from "vitest";
import "dotenv/config";
import { queryFetes, queryFeteById } from "@/src/mcp/tools/fetes.js";

describe("queryFetes", () => {
  it("returns a non-empty list", async () => {
    const result = await queryFetes({ limit: 5 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
  });

  it("filters by search term", async () => {
    const all = await queryFetes({ limit: 50 });
    const term = all[0].name.split(" ")[0];
    const filtered = await queryFetes({ search: term, limit: 50 });
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every((f: { name: string }) =>
        f.name.toLowerCase().includes(term.toLowerCase())
      )
    ).toBe(true);
  });
});

describe("queryFeteById", () => {
  it("returns null for unknown id", async () => {
    const result = await queryFeteById("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });

  it("returns fete with editions for a known id", async () => {
    const list = await queryFetes({ limit: 1 });
    const fete = await queryFeteById(list[0].id);
    expect(fete).not.toBeNull();
    expect(Array.isArray(fete!.editions)).toBe(true);
  });
});

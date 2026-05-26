import { describe, it, expect } from "vitest";
import "dotenv/config";
import { isAdmin, buildFeteInput } from "@/src/mcp/tools/admin.js";

const adminEmails = ["steve@pikari.io", "nicole@example.com"];

describe("isAdmin", () => {
  it("returns true for admin email", () => {
    expect(isAdmin("steve@pikari.io", adminEmails)).toBe(true);
  });

  it("returns false for non-admin email", () => {
    expect(isAdmin("user@example.com", adminEmails)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isAdmin("STEVE@PIKARI.IO", adminEmails)).toBe(true);
  });
});

describe("buildFeteInput", () => {
  it("maps valid input to schema shape", () => {
    const result = buildFeteInput({ name: "Test Fete", category: "Fete" });
    expect(result.name).toBe("Test Fete");
    expect(result.category).toBe("Fete");
  });

  it("throws for invalid category", () => {
    expect(() => buildFeteInput({ name: "X", category: "Invalid" })).toThrow(
      /Invalid category/
    );
  });
});

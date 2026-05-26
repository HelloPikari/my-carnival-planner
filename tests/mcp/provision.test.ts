import { describe, it, expect, afterAll } from "vitest";
import "dotenv/config";
import { findOrProvisionUser } from "@/src/mcp/provision.js";
import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { eq } from "drizzle-orm";

const testWorkosId = `user_test_provision_${Date.now()}`;
const testEmail = `provision-test-${Date.now()}@pikari.io`;
const noNameId = `user_noname_${Date.now()}`;
const noNameEmail = `noname-${Date.now()}@pikari.io`;

describe("findOrProvisionUser", () => {
  afterAll(async () => {
    await db.delete(users).where(eq(users.email, testEmail));
    await db.delete(users).where(eq(users.email, noNameEmail));
  });

  it("creates a new user on first login", async () => {
    const user = await findOrProvisionUser({
      id: testWorkosId,
      email: testEmail,
      firstName: "Test",
      lastName: "User",
    });
    expect(user.workosId).toBe(testWorkosId);
    expect(user.email).toBe(testEmail);
    expect(user.displayName).toBe("Test User");
    expect(user.subscriptionPlan).toBe("free");
  });

  it("returns the same user on subsequent calls", async () => {
    const first = await findOrProvisionUser({ id: testWorkosId, email: testEmail });
    const second = await findOrProvisionUser({ id: testWorkosId, email: testEmail });
    expect(first.id).toBe(second.id);
  });

  it("uses email prefix as displayName when no name provided", async () => {
    const user = await findOrProvisionUser({ id: noNameId, email: noNameEmail });
    expect(user.displayName).toMatch(/^noname-/);
  });
});

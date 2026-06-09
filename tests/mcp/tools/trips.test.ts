import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { trips, tripMembers } from "@/src/db/schema/trips.js";
import { carnivalSeasons } from "@/src/db/schema/core.js";
import { eq, inArray } from "drizzle-orm";
import {
  queryCarnivalSeasons,
  createTripForUser,
  updateTripContext,
} from "@/src/mcp/tools/trips.js";
import { resolveActiveTrip } from "@/src/mcp/lib/context.js";

const TEST_TAG = `trips_test_${Date.now()}`;
const userEmail = `${TEST_TAG}@pikari.io`;
let userId: string;
let season2026Id: string;
const createdTripIds: string[] = [];

beforeAll(async () => {
  const [u] = await db
    .insert(users)
    .values({
      workosId: `user_${TEST_TAG}`,
      email: userEmail,
      displayName: "Trips Test",
      subscriptionPlan: "premium",
      subscriptionStatus: "active",
    })
    .returning();
  userId = u.id;

  const [s2026] = await db
    .select()
    .from(carnivalSeasons)
    .where(eq(carnivalSeasons.year, 2026));
  season2026Id = s2026.id;
});

afterAll(async () => {
  if (createdTripIds.length) {
    await db.delete(tripMembers).where(inArray(tripMembers.tripId, createdTripIds));
    await db.delete(trips).where(inArray(trips.id, createdTripIds));
  }
  await db.delete(users).where(eq(users.email, userEmail));
});

describe("queryCarnivalSeasons", () => {
  it("returns at least the 2026 season with computed Carnival Monday", async () => {
    const rows = await queryCarnivalSeasons();
    const s2026 = rows.find((r) => r.year === 2026);
    expect(s2026).toBeDefined();
    expect(s2026!.carnivalMonday).toBe("2026-02-16");
    expect(s2026!.carnivalName).toBe("Trinidad Carnival");
  });

  it("excludes archived seasons", async () => {
    const rows = await queryCarnivalSeasons();
    expect(rows.every((r) => r.status !== "archived")).toBe(true);
  });
});

describe("createTripForUser", () => {
  it("creates a trip and a tripMembers row in one transaction", async () => {
    const trip = await createTripForUser({
      userId,
      carnivalSeasonId: season2026Id,
      name: "Test Trip A",
      arrivalDate: "2026-02-12",
      departureDate: "2026-02-19",
      partySize: 4,
      budgetUsd: 5000,
    });
    createdTripIds.push(trip.id);

    expect(trip.name).toBe("Test Trip A");
    expect(trip.arrivalDate).toBe("2026-02-12");
    expect(trip.partySize).toBe(4);
    expect(trip.budgetUsd).toBe("5000.00"); // decimal returns as string

    const [membership] = await db
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.tripId, trip.id));
    expect(membership).toBeDefined();
    expect(membership.userId).toBe(userId);
    expect(membership.role).toBe("organizer");
  });
});

describe("resolveActiveTrip", () => {
  it("returns no_active_trip when user has no trips", async () => {
    // Create a fresh user with no trips
    const [other] = await db
      .insert(users)
      .values({
        workosId: `user_no_trips_${Date.now()}`,
        email: `no-trips-${Date.now()}@pikari.io`,
        displayName: "No Trips",
        subscriptionPlan: "free",
        subscriptionStatus: "active",
      })
      .returning();
    try {
      const result = await resolveActiveTrip(other.id);
      expect(result.status).toBe("no_active_trip");
    } finally {
      await db.delete(users).where(eq(users.id, other.id));
    }
  });

  it("returns ok with the user's trip when there is exactly one", async () => {
    const result = await resolveActiveTrip(userId);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.trip.name).toBe("Test Trip A");
    }
  });

  it("picks soonest by arrival_date when user has multiple unambiguous trips", async () => {
    // Add a later trip
    const later = await createTripForUser({
      userId,
      carnivalSeasonId: season2026Id,
      name: "Test Trip B (later)",
      arrivalDate: "2026-02-14",
      departureDate: "2026-02-20",
      partySize: 2,
      budgetUsd: 3000,
    });
    createdTripIds.push(later.id);

    const result = await resolveActiveTrip(userId);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      // Test Trip A has arrivalDate 2026-02-12 (earlier) — should win
      expect(result.trip.name).toBe("Test Trip A");
    }
  });
});

describe("updateTripContext", () => {
  it("updates typed fields and merges soft preferences", async () => {
    const trip = await createTripForUser({
      userId,
      carnivalSeasonId: season2026Id,
      name: "Test Trip C",
      arrivalDate: "2026-02-13",
      departureDate: "2026-02-19",
      partySize: 3,
      budgetUsd: 4000,
    });
    createdTripIds.push(trip.id);

    const updated = await updateTripContext({
      userId,
      tripId: trip.id,
      partySize: 5,
      softPreferences: { vibeQ: "bougie", experienceLevel: "first_time" },
    });

    expect(updated.partySize).toBe(5);
    expect(updated.arrivalDate).toBe("2026-02-13"); // unchanged
    expect(updated.metadata).toMatchObject({
      vibeQ: "bougie",
      experienceLevel: "first_time",
    });

    // Second update merges, doesn't overwrite
    const updated2 = await updateTripContext({
      userId,
      tripId: trip.id,
      softPreferences: { vibeQ: "dirty" },
    });
    expect(updated2.metadata).toMatchObject({
      vibeQ: "dirty",
      experienceLevel: "first_time",
    });
  });
});

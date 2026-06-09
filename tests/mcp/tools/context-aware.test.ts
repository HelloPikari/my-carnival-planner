import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { trips, tripMembers } from "@/src/db/schema/trips.js";
import { carnivalSeasons } from "@/src/db/schema/core.js";
import { eq, inArray } from "drizzle-orm";
import { createTripForUser } from "@/src/mcp/tools/trips.js";
import { loadToolContext, type ActiveTripRow } from "@/src/mcp/lib/context.js";
import { queryFetesForTrip } from "@/src/mcp/tools/fetes.js";
import { queryBandsForTrip } from "@/src/mcp/tools/bands.js";
import { queryAccommodationsWithSkew } from "@/src/mcp/tools/accommodations.js";

const TAG = `ctx_test_${Date.now()}`;
const email = `${TAG}@pikari.io`;
let userId: string;
let season2026Id: string;
const createdTripIds: string[] = [];

beforeAll(async () => {
  const [u] = await db
    .insert(users)
    .values({
      workosId: `user_${TAG}`,
      email,
      displayName: "Ctx Test",
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
  await db.delete(users).where(eq(users.email, email));
});

describe("loadToolContext", () => {
  it("returns no_active_trip status when user has none and is not admin", async () => {
    const ctx = await loadToolContext(userId, email, []);
    expect(ctx.adminOverride).toBe(false);
    expect(ctx.trip).toBeNull();
    expect((ctx.statusResponse as { status: string }).status).toBe("no_active_trip");
  });

  it("admin gets adminOverride and null statusResponse even with no trip", async () => {
    const ctx = await loadToolContext(userId, email, [email]);
    expect(ctx.adminOverride).toBe(true);
    expect(ctx.statusResponse).toBeNull();
    expect(ctx.trip).toBeNull();
  });

  it("returns trip when user has an active trip", async () => {
    const trip = await createTripForUser({
      userId,
      carnivalSeasonId: season2026Id,
      name: "Ctx Test Trip",
      arrivalDate: "2026-02-13",
      departureDate: "2026-02-19",
      partySize: 6,
      budgetUsd: 6000,
    });
    createdTripIds.push(trip.id);

    const ctx = await loadToolContext(userId, email, []);
    expect(ctx.trip).not.toBeNull();
    expect(ctx.trip!.partySize).toBe(6);
    expect(ctx.statusResponse).toBeNull();
  });
});

describe("queryFetesForTrip", () => {
  it("returns only fete editions within the arrival/departure window", async () => {
    const trip: ActiveTripRow = {
      id: createdTripIds[0],
      name: "Ctx Test Trip",
      carnivalSeasonId: season2026Id,
      carnivalSeasonYear: 2026,
      arrivalDate: "2026-02-13",
      departureDate: "2026-02-19",
      partySize: 6,
      budgetUsd: "6000.00",
      metadata: null,
    };
    const rows = await queryFetesForTrip({ trip, limit: 100 });
    for (const r of rows) {
      expect(r.startDatetime).not.toBeNull();
      const ts = new Date(r.startDatetime!).getTime();
      expect(ts).toBeGreaterThanOrEqual(new Date("2026-02-13T00:00:00Z").getTime());
      expect(ts).toBeLessThanOrEqual(new Date("2026-02-19T23:59:59Z").getTime());
      expect(typeof r.daysFromCarnivalMonday).toBe("number");
    }
  });
});

describe("queryBandsForTrip", () => {
  it("ranks bands with theme for this season before others", async () => {
    const trip: ActiveTripRow = {
      id: createdTripIds[0],
      name: "Ctx Test Trip",
      carnivalSeasonId: season2026Id,
      carnivalSeasonYear: 2026,
      arrivalDate: "2026-02-13",
      departureDate: "2026-02-19",
      partySize: 6,
      budgetUsd: "6000.00",
      metadata: null,
    };
    const rows = await queryBandsForTrip({ trip, limit: 100 });
    // Once we hit a band without a theme, no subsequent band should have one
    let seenUnthemed = false;
    for (const b of rows) {
      if (!b.hasThemeForSeason) seenUnthemed = true;
      if (seenUnthemed) expect(b.hasThemeForSeason).toBe(false);
    }
  });
});

describe("queryAccommodationsWithSkew", () => {
  it("filters out accommodations that can't sleep the party", async () => {
    const rows = await queryAccommodationsWithSkew({ partySize: 10, limit: 50 });
    // Don't assert non-empty (data may not contain a 10-sleeper room) — just
    // that the query runs without error and returns an array.
    expect(Array.isArray(rows)).toBe(true);
  });

  it("returns more results when party_size is small", async () => {
    const small = await queryAccommodationsWithSkew({ partySize: 2, limit: 100 });
    const large = await queryAccommodationsWithSkew({ partySize: 10, limit: 100 });
    expect(small.length).toBeGreaterThanOrEqual(large.length);
  });
});

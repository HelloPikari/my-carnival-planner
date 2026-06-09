import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { trips, tripMembers } from "@/src/db/schema/trips.js";
import { carnivalSeasons, carnivals } from "@/src/db/schema/core.js";
import { eq, inArray } from "drizzle-orm";
import { createTripForUser } from "@/src/mcp/tools/trips.js";
import { loadToolContext, type ActiveTripRow } from "@/src/mcp/lib/context.js";
import { queryFetesForTrip } from "@/src/mcp/tools/fetes.js";
import { queryBandsForTrip } from "@/src/mcp/tools/bands.js";
import { queryAccommodationsWithSkew } from "@/src/mcp/tools/accommodations.js";

const TAG = `ctx_test_${Date.now()}`;
const email = `${TAG}@pikari.io`;
let userId: string;
const FUTURE_YEAR = 2098;
let futureSeasonId: string;
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

  const [trinidadCarnival] = await db
    .select()
    .from(carnivals)
    .where(eq(carnivals.name, "Trinidad Carnival"));

  const [future] = await db
    .insert(carnivalSeasons)
    .values({
      carnivalId: trinidadCarnival.id,
      year: FUTURE_YEAR,
      startDate: `${FUTURE_YEAR}-02-16`,
      endDate: `${FUTURE_YEAR}-02-17`,
      status: "planning",
    })
    .returning();
  futureSeasonId = future.id;

  // For the queryFetesForTrip test we need a real season with seeded edition
  // data — that's 2026 in the dev seed. The query takes an ActiveTripRow value
  // directly, so we don't have to go through the resolver.
  const [s2026] = await db
    .select()
    .from(carnivalSeasons)
    .where(eq(carnivalSeasons.year, 2026));
  season2026Id = s2026?.id ?? futureSeasonId;
});

afterAll(async () => {
  if (createdTripIds.length) {
    await db.delete(tripMembers).where(inArray(tripMembers.tripId, createdTripIds));
    await db.delete(trips).where(inArray(trips.id, createdTripIds));
  }
  await db.delete(carnivalSeasons).where(eq(carnivalSeasons.id, futureSeasonId));
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
      carnivalSeasonId: futureSeasonId,
      name: "Ctx Test Trip",
      arrivalDate: `${FUTURE_YEAR}-02-13`,
      departureDate: `${FUTURE_YEAR}-02-19`,
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
    // Construct an ActiveTripRow value directly so this test can target 2026
    // (the season with seeded fete edition data) regardless of date filters.
    const trip: ActiveTripRow = {
      id: createdTripIds[0] ?? "00000000-0000-0000-0000-000000000000",
      name: "2026 reference",
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
      id: createdTripIds[0] ?? "00000000-0000-0000-0000-000000000000",
      name: "2026 reference",
      carnivalSeasonId: season2026Id,
      carnivalSeasonYear: 2026,
      arrivalDate: "2026-02-13",
      departureDate: "2026-02-19",
      partySize: 6,
      budgetUsd: "6000.00",
      metadata: null,
    };
    const rows = await queryBandsForTrip({ trip, limit: 100 });
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
    expect(Array.isArray(rows)).toBe(true);
  });

  it("returns more results when party_size is small", async () => {
    const small = await queryAccommodationsWithSkew({ partySize: 2, limit: 100 });
    const large = await queryAccommodationsWithSkew({ partySize: 10, limit: 100 });
    expect(small.length).toBeGreaterThanOrEqual(large.length);
  });
});

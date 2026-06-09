import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "dotenv/config";
import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { trips, tripMembers } from "@/src/db/schema/trips.js";
import { carnivalSeasons, carnivals } from "@/src/db/schema/core.js";
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
// Use a far-future season so seed data state can't affect tests as time passes.
const FUTURE_YEAR = 2099;
let futureSeasonId: string;
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

  const [trinidadCarnival] = await db
    .select()
    .from(carnivals)
    .where(eq(carnivals.name, "Trinidad Carnival"));

  const [futureSeason] = await db
    .insert(carnivalSeasons)
    .values({
      carnivalId: trinidadCarnival.id,
      year: FUTURE_YEAR,
      startDate: `${FUTURE_YEAR}-02-16`,
      endDate: `${FUTURE_YEAR}-02-17`,
      status: "planning",
    })
    .returning();
  futureSeasonId = futureSeason.id;
});

afterAll(async () => {
  if (createdTripIds.length) {
    await db.delete(tripMembers).where(inArray(tripMembers.tripId, createdTripIds));
    await db.delete(trips).where(inArray(trips.id, createdTripIds));
  }
  await db.delete(carnivalSeasons).where(eq(carnivalSeasons.id, futureSeasonId));
  await db.delete(users).where(eq(users.email, userEmail));
});

describe("queryCarnivalSeasons", () => {
  it("includes the future season", async () => {
    const rows = await queryCarnivalSeasons();
    const future = rows.find((r) => r.year === FUTURE_YEAR);
    expect(future).toBeDefined();
    expect(future!.carnivalName).toBe("Trinidad Carnival");
    expect(future!.carnivalMonday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("excludes seasons whose endDate is in the past", async () => {
    const rows = await queryCarnivalSeasons();
    const today = new Date().toISOString().slice(0, 10);
    for (const r of rows) {
      if (r.endDate) expect(r.endDate >= today).toBe(true);
    }
  });
});

describe("createTripForUser", () => {
  it("creates a trip and a tripMembers row in one transaction", async () => {
    const trip = await createTripForUser({
      userId,
      carnivalSeasonId: futureSeasonId,
      name: "Test Trip A",
      arrivalDate: `${FUTURE_YEAR}-02-12`,
      departureDate: `${FUTURE_YEAR}-02-19`,
      partySize: 4,
      budgetUsd: 5000,
    });
    createdTripIds.push(trip.id);

    expect(trip.name).toBe("Test Trip A");
    expect(trip.arrivalDate).toBe(`${FUTURE_YEAR}-02-12`);
    expect(trip.partySize).toBe(4);
    expect(trip.budgetUsd).toBe("5000.00");

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
    const later = await createTripForUser({
      userId,
      carnivalSeasonId: futureSeasonId,
      name: "Test Trip B (later)",
      arrivalDate: `${FUTURE_YEAR}-02-14`,
      departureDate: `${FUTURE_YEAR}-02-20`,
      partySize: 2,
      budgetUsd: 3000,
    });
    createdTripIds.push(later.id);

    const result = await resolveActiveTrip(userId);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.trip.name).toBe("Test Trip A");
    }
  });

  it("excludes trips for seasons whose endDate is in the past", async () => {
    const [past] = await db
      .select()
      .from(carnivalSeasons)
      .where(eq(carnivalSeasons.year, 2025));
    if (!past) return; // skip if seed wasn't run

    const [strandedUser] = await db
      .insert(users)
      .values({
        workosId: `user_past_${Date.now()}`,
        email: `past-${Date.now()}@pikari.io`,
        displayName: "Past Trip",
        subscriptionPlan: "free",
        subscriptionStatus: "active",
      })
      .returning();
    try {
      const trip = await createTripForUser({
        userId: strandedUser.id,
        carnivalSeasonId: past.id,
        name: "Past Trip",
        arrivalDate: "2025-02-28",
        departureDate: "2025-03-05",
        partySize: 1,
        budgetUsd: 1000,
      });
      try {
        const result = await resolveActiveTrip(strandedUser.id);
        expect(result.status).toBe("no_active_trip");
      } finally {
        await db.delete(tripMembers).where(eq(tripMembers.tripId, trip.id));
        await db.delete(trips).where(eq(trips.id, trip.id));
      }
    } finally {
      await db.delete(users).where(eq(users.id, strandedUser.id));
    }
  });
});

describe("updateTripContext", () => {
  it("updates typed fields and merges soft preferences", async () => {
    const trip = await createTripForUser({
      userId,
      carnivalSeasonId: futureSeasonId,
      name: "Test Trip C",
      arrivalDate: `${FUTURE_YEAR}-02-13`,
      departureDate: `${FUTURE_YEAR}-02-19`,
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
    expect(updated.arrivalDate).toBe(`${FUTURE_YEAR}-02-13`);
    expect(updated.metadata).toMatchObject({
      vibeQ: "bougie",
      experienceLevel: "first_time",
    });

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

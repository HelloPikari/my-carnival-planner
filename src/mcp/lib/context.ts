/**
 * Active-trip resolution and per-tool context loading.
 *
 * Most MCP tools that gate or skew responses on trip context call
 * `resolveActiveTrip(userId)` first to find the trip the user is "currently
 * planning". Multiple candidate trips with the same priority → ambiguous.
 */

import { db } from "@/src/db/index.js";
import { trips, tripMembers } from "@/src/db/schema/trips.js";
import { carnivalSeasons } from "@/src/db/schema/core.js";
import { and, asc, eq, gte, isNull, or, sql } from "drizzle-orm";

export type ActiveTripRow = {
  id: string;
  name: string;
  carnivalSeasonId: string;
  carnivalSeasonYear: number;
  arrivalDate: string | null;
  departureDate: string | null;
  partySize: number | null;
  budgetUsd: string | null;
  metadata: Record<string, unknown> | null;
};

export type ResolveActiveTripResult =
  | { status: "ok"; trip: ActiveTripRow }
  | { status: "no_active_trip" }
  | {
      status: "ambiguous";
      candidates: Array<{
        id: string;
        name: string;
        year: number;
        arrivalDate: string | null;
        departureDate: string | null;
      }>;
    };

const NOW_YEAR = sql<number>`EXTRACT(YEAR FROM CURRENT_DATE)::int`;

/**
 * Find the active trip for a user. "Active" = current or future season,
 * soonest arrival_date first (nulls last so brand-new trips without dates
 * still appear, just lower priority).
 *
 * Ambiguous when the top two candidates tie on (season year, arrival_date) —
 * usually means two unfilled trips for the same season.
 */
export async function resolveActiveTrip(userId: string): Promise<ResolveActiveTripResult> {
  const rows = await db
    .select({
      id: trips.id,
      name: trips.name,
      carnivalSeasonId: trips.carnivalSeasonId,
      carnivalSeasonYear: carnivalSeasons.year,
      arrivalDate: trips.arrivalDate,
      departureDate: trips.departureDate,
      partySize: trips.partySize,
      budgetUsd: trips.budgetUsd,
      metadata: trips.metadata,
    })
    .from(trips)
    .innerJoin(tripMembers, eq(tripMembers.tripId, trips.id))
    .innerJoin(carnivalSeasons, eq(carnivalSeasons.id, trips.carnivalSeasonId))
    .where(
      and(
        eq(tripMembers.userId, userId),
        isNull(trips.deletedAt),
        gte(carnivalSeasons.year, NOW_YEAR),
      ),
    )
    .orderBy(
      asc(carnivalSeasons.year),
      sql`${trips.arrivalDate} ASC NULLS LAST`,
    );

  if (rows.length === 0) return { status: "no_active_trip" };

  const top = rows[0] as ActiveTripRow;
  if (rows.length === 1) return { status: "ok", trip: top };

  const next = rows[1] as ActiveTripRow;
  const tied =
    top.carnivalSeasonYear === next.carnivalSeasonYear &&
    top.arrivalDate === next.arrivalDate;

  if (!tied) return { status: "ok", trip: top };

  return {
    status: "ambiguous",
    candidates: rows.map((r) => ({
      id: r.id,
      name: r.name,
      year: r.carnivalSeasonYear,
      arrivalDate: r.arrivalDate,
      departureDate: r.departureDate,
    })),
  };
}

export type MissingContextField = "arrival_date" | "departure_date" | "party_size" | "budget_usd";

/**
 * Which server-gated fields are missing on a trip. Currently only
 * arrival_date and departure_date gate response data; party_size and
 * budget_usd are LLM-gathered and used for ranking only.
 */
export function missingGatedFields(trip: ActiveTripRow): MissingContextField[] {
  const missing: MissingContextField[] = [];
  if (!trip.arrivalDate) missing.push("arrival_date");
  if (!trip.departureDate) missing.push("departure_date");
  return missing;
}

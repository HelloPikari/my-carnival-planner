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
import { and, asc, eq, isNull, or, gte, sql } from "drizzle-orm";

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

/**
 * Find the active trip for a user. "Active" = trip whose carnival season hasn't
 * ended yet (endDate >= today, or endDate is null/unknown), soonest arrival_date
 * first (nulls last so brand-new trips without dates still appear).
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
        or(
          isNull(carnivalSeasons.endDate),
          gte(carnivalSeasons.endDate, sql`CURRENT_DATE`),
        ),
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

/**
 * Envelope returned by loadToolContext: tools decide what to do with it.
 * - adminOverride=true → caller is an admin; statusResponse will be null even
 *   when no active trip exists.
 * - trip is present whenever the user has an unambiguous active trip.
 * - statusResponse is the JSON the tool should return immediately if it wants
 *   to gate on missing context (callers may also choose to ignore it).
 */
export type ToolContext = {
  adminOverride: boolean;
  trip: ActiveTripRow | null;
  statusResponse: object | null;
};

export async function loadToolContext(
  userId: string,
  email: string,
  adminEmails: string[],
): Promise<ToolContext> {
  const adminOverride = adminEmails.map((e) => e.toLowerCase()).includes(email.toLowerCase());

  const resolved = await resolveActiveTrip(userId);

  if (resolved.status === "ok") {
    return { adminOverride, trip: resolved.trip, statusResponse: null };
  }

  if (adminOverride) {
    return { adminOverride, trip: null, statusResponse: null };
  }

  return { adminOverride, trip: null, statusResponse: resolved };
}

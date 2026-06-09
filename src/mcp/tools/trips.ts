import { db } from "@/src/db/index.js";
import { trips, tripMembers } from "@/src/db/schema/trips.js";
import { carnivalSeasons, carnivals } from "@/src/db/schema/core.js";
import { and, eq, gte, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { carnivalMondayISO } from "@/src/mcp/lib/carnival.js";
import { resolveActiveTrip, missingGatedFields } from "@/src/mcp/lib/context.js";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

function getUserId(extra: Extra): string | null {
  const id = extra?.authInfo?.extra?.["userId"];
  return typeof id === "string" ? id : null;
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

const ISO_DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

// ─── get_carnival_seasons ────────────────────────────────────────────────────

async function queryCarnivalSeasons() {
  const rows = await db
    .select({
      id: carnivalSeasons.id,
      carnivalName: carnivals.name,
      year: carnivalSeasons.year,
      startDate: carnivalSeasons.startDate,
      endDate: carnivalSeasons.endDate,
      status: carnivalSeasons.status,
    })
    .from(carnivalSeasons)
    .innerJoin(carnivals, eq(carnivals.id, carnivalSeasons.carnivalId))
    .where(
      or(
        isNull(carnivalSeasons.endDate),
        gte(carnivalSeasons.endDate, sql`CURRENT_DATE`),
      ),
    )
    .orderBy(carnivalSeasons.year);

  return rows.map((r) => ({
    ...r,
    carnivalMonday: carnivalMondayISO(r.year),
  }));
}

// ─── create_trip ─────────────────────────────────────────────────────────────

async function createTripForUser(input: {
  userId: string;
  carnivalSeasonId: string;
  name: string;
  arrivalDate: string;
  departureDate: string;
  partySize: number;
  budgetUsd: number;
}) {
  return db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({
        name: input.name,
        carnivalSeasonId: input.carnivalSeasonId,
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        partySize: input.partySize,
        budgetUsd: String(input.budgetUsd),
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .returning();

    await tx.insert(tripMembers).values({
      tripId: trip.id,
      userId: input.userId,
      role: "organizer",
      createdBy: input.userId,
      updatedBy: input.userId,
    });

    return trip;
  });
}

// ─── update_trip_context ─────────────────────────────────────────────────────

async function updateTripContext(input: {
  userId: string;
  tripId: string;
  arrivalDate?: string;
  departureDate?: string;
  partySize?: number;
  budgetUsd?: number;
  softPreferences?: Record<string, unknown>;
}) {
  const patch: Record<string, unknown> = { updatedBy: input.userId };
  if (input.arrivalDate !== undefined) patch.arrivalDate = input.arrivalDate;
  if (input.departureDate !== undefined) patch.departureDate = input.departureDate;
  if (input.partySize !== undefined) patch.partySize = input.partySize;
  if (input.budgetUsd !== undefined) patch.budgetUsd = String(input.budgetUsd);

  if (input.softPreferences) {
    const [current] = await db
      .select({ metadata: trips.metadata })
      .from(trips)
      .where(eq(trips.id, input.tripId));
    const prev = (current?.metadata as Record<string, unknown> | null) ?? {};
    patch.metadata = { ...prev, ...input.softPreferences };
  }

  const [updated] = await db
    .update(trips)
    .set(patch)
    .where(eq(trips.id, input.tripId))
    .returning();

  return updated;
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerTripTools(server: McpServer) {
  server.registerTool(
    "get_carnival_seasons",
    {
      title: "Get Carnival Seasons",
      description:
        "List upcoming carnival seasons (endDate today or later) so the user can pick which one their trip is for. " +
        "Returns a status envelope: status='ok' with a populated seasons array, or status='no_upcoming_seasons' " +
        "with an empty array and explicit guidance when nothing is configured. " +
        "Call this when starting trip planning before calling create_trip.",
      inputSchema: {},
    },
    async () => {
      try {
        const seasons = await queryCarnivalSeasons();
        if (seasons.length === 0) {
          return jsonResult({
            status: "no_upcoming_seasons",
            seasons: [],
            message:
              "No upcoming carnival seasons are currently configured in the system. " +
              "Past seasons (e.g. Trinidad Carnival 2026, which took place Feb 16-17) are intentionally excluded; " +
              "future seasons have not yet been seeded.",
            guidance:
              "Tell the user that planning for the next carnival season is not yet available in the system, " +
              "and that data will be added closer to the next event. " +
              "Do NOT invent carnival dates, season ids, or proceed to call create_trip. " +
              "Do NOT fall back to general knowledge about Trinidad Carnival schedules — only data returned " +
              "by this tool is authoritative for trip planning.",
          });
        }
        return jsonResult({ status: "ok", seasons });
      } catch (e) {
        console.error("[get_carnival_seasons] error:", e);
        return errorResult("Error fetching carnival seasons");
      }
    },
  );

  server.registerTool(
    "create_trip",
    {
      title: "Create Trip",
      description:
        "Create a new trip for the authenticated user. Before calling, gather ALL of these from the user " +
        "in conversation: arrival_date, departure_date, party_size, budget_usd (total trip budget in USD). " +
        "Also confirm which carnival season (call get_carnival_seasons if you don't know the id). " +
        "Creates the trip and registers the user as its organizer in one transaction.",
      inputSchema: {
        carnivalSeasonId: z
          .string()
          .uuid()
          .describe("Carnival season id from get_carnival_seasons"),
        name: z
          .string()
          .min(1)
          .describe("Short trip name, e.g. 'Trinidad 2026' or 'Bachelorette Carnival'"),
        arrivalDate: ISO_DATE.describe(
          "Arrival in Trinidad, YYYY-MM-DD. Typically a few days before Carnival Monday.",
        ),
        departureDate: ISO_DATE.describe(
          "Departure from Trinidad, YYYY-MM-DD. Typically Ash Wednesday or later.",
        ),
        partySize: z
          .number()
          .int()
          .min(1)
          .describe("Total number of people in the travel party (including the user)"),
        budgetUsd: z
          .number()
          .positive()
          .describe("Total trip budget in USD (covers flights, accommodation, fetes, costumes, food)"),
      },
    },
    async (input, extra) => {
      const userId = getUserId(extra);
      if (!userId) return errorResult("Authentication required");
      try {
        const trip = await createTripForUser({ ...input, userId });
        return jsonResult({ status: "created", trip });
      } catch (e) {
        console.error("[create_trip] error:", e);
        return errorResult("Error creating trip");
      }
    },
  );

  server.registerTool(
    "get_my_context",
    {
      title: "Get My Trip Context",
      description:
        "Return the authenticated user's active trip context (profile fields + remaining budget). " +
        "Use this at the start of every planning conversation to find out what's already known. " +
        "Returns one of: {status: 'ok', trip, missing} | {status: 'no_active_trip'} | " +
        "{status: 'ambiguous', candidates} so you can route to create_trip or ask the user to disambiguate.",
      inputSchema: {},
    },
    async (_input, extra) => {
      const userId = getUserId(extra);
      if (!userId) return errorResult("Authentication required");
      try {
        const result = await resolveActiveTrip(userId);
        if (result.status !== "ok") return jsonResult(result);

        const totalBudget = result.trip.budgetUsd
          ? parseFloat(result.trip.budgetUsd)
          : null;

        return jsonResult({
          status: "ok",
          trip: result.trip,
          totalBudgetUsd: totalBudget,
          budgetNote:
            "Total trip budget — itinerary cost subtraction (remaining = total - confirmed item costs) will arrive in a later phase.",
          missing: missingGatedFields(result.trip),
        });
      } catch (e) {
        console.error("[get_my_context] error:", e);
        return errorResult("Error reading trip context");
      }
    },
  );

  server.registerTool(
    "update_trip_context",
    {
      title: "Update Trip Context",
      description:
        "Partial update of any trip context field. Typed fields (arrival_date, departure_date, " +
        "party_size, budget_usd) become real columns; softPreferences merges into the trip metadata JSONB " +
        "and is intended for vibe, experience level, dietary needs, etc. Pass only the fields you want to change. " +
        "Defaults to updating the user's active trip; pass tripId explicitly if user has multiple.",
      inputSchema: {
        tripId: z
          .string()
          .uuid()
          .optional()
          .describe("Trip id to update; defaults to active trip if omitted"),
        arrivalDate: ISO_DATE.optional(),
        departureDate: ISO_DATE.optional(),
        partySize: z.number().int().min(1).optional(),
        budgetUsd: z.number().positive().optional(),
        softPreferences: z
          .record(z.string(), z.any())
          .optional()
          .describe(
            "Soft prefs merged into metadata, e.g. {vibeQ: 'bougie', experienceLevel: 'first_time'}",
          ),
      },
    },
    async (input, extra) => {
      const userId = getUserId(extra);
      if (!userId) return errorResult("Authentication required");
      try {
        let tripId = input.tripId;
        if (!tripId) {
          const resolved = await resolveActiveTrip(userId);
          if (resolved.status !== "ok") return jsonResult(resolved);
          tripId = resolved.trip.id;
        } else {
          const [membership] = await db
            .select()
            .from(tripMembers)
            .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
          if (!membership) return errorResult("Trip not found or not yours");
        }

        const trip = await updateTripContext({ ...input, userId, tripId });
        return jsonResult({ status: "updated", trip });
      } catch (e) {
        console.error("[update_trip_context] error:", e);
        return errorResult("Error updating trip context");
      }
    },
  );
}

// Expose helpers used by other tool modules
export { queryCarnivalSeasons, createTripForUser, updateTripContext };

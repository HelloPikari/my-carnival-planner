import { db } from "@/src/db/index.js";
import { accommodations, roomTypes } from "@/src/db/schema/accommodations.js";
import { and, desc, eq, gte, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { loadToolContext } from "@/src/mcp/lib/context.js";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

function getAuth(extra: Extra): { userId: string; email: string } | null {
  const userId = extra?.authInfo?.extra?.["userId"];
  const email = extra?.authInfo?.extra?.["email"];
  if (typeof userId !== "string" || typeof email !== "string") return null;
  return { userId, email };
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

export async function queryAccommodations(input: { search?: string; limit?: number }) {
  const { search, limit = 20 } = input;
  return db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      type: accommodations.type,
      starRating: accommodations.starRating,
      plannerRating: accommodations.plannerRating,
    })
    .from(accommodations)
    .where(search ? ilike(accommodations.name, `%${search}%`) : undefined)
    .orderBy(desc(accommodations.plannerRating))
    .limit(limit);
}

/**
 * Context-aware list:
 *  - filter accommodations to those with at least one room_type that sleeps
 *    >= partySize (when partySize present)
 *  - rank by plannerRating desc
 */
export async function queryAccommodationsWithSkew(input: {
  search?: string;
  limit?: number;
  partySize?: number;
}) {
  const { search, limit = 20, partySize } = input;

  let candidateIds: string[] | null = null;
  if (partySize && partySize > 0) {
    const fits = await db
      .select({ accommodationId: roomTypes.accommodationId })
      .from(roomTypes)
      .where(gte(roomTypes.maxOccupancy, partySize));
    candidateIds = Array.from(new Set(fits.map((r) => r.accommodationId)));
    if (candidateIds.length === 0) return []; // no rooms fit the party
  }

  const where = and(
    search ? ilike(accommodations.name, `%${search}%`) : undefined,
    candidateIds ? inArray(accommodations.id, candidateIds) : undefined,
  );

  return db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      type: accommodations.type,
      starRating: accommodations.starRating,
      plannerRating: accommodations.plannerRating,
    })
    .from(accommodations)
    .where(where)
    .orderBy(desc(accommodations.plannerRating))
    .limit(limit);
}

export async function queryAccommodationById(id: string) {
  const accommodation = await db
    .select()
    .from(accommodations)
    .where(eq(accommodations.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!accommodation) return null;

  const rooms = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.accommodationId, id));

  return { ...accommodation, roomTypes: rooms };
}

export function registerAccommodationTools(server: McpServer, adminEmails: string[] = []) {
  server.registerTool(
    "list_accommodations",
    {
      title: "List Accommodations",
      description:
        "List accommodations, ranked by Nicole's planner rating. " +
        "When the user has an active trip with party_size, results are filtered to " +
        "accommodations that have at least one room sleeping the whole party. " +
        "Remaining budget is surfaced in the response so you can reason about price fit. " +
        "If no active trip, returns {status: 'no_active_trip'} so you can call create_trip; " +
        "admins bypass the gate.",
      inputSchema: {
        search: z.string().optional().describe("Filter accommodations by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async (input, extra) => {
      const auth = getAuth(extra);
      if (!auth) return errorResult("Authentication required");
      try {
        const ctx = await loadToolContext(auth.userId, auth.email, adminEmails);

        if (ctx.adminOverride && !ctx.trip) {
          const results = await queryAccommodations(input);
          return jsonResult({ status: "ok", is_admin: true, accommodations: results });
        }

        if (ctx.statusResponse) return jsonResult(ctx.statusResponse);

        const trip = ctx.trip!;
        const partySize = trip.partySize ?? undefined;
        const remainingBudgetUsd = trip.budgetUsd ? parseFloat(trip.budgetUsd) : null;

        const results = await queryAccommodationsWithSkew({ ...input, partySize });
        return jsonResult({
          status: "ok",
          is_admin: ctx.adminOverride,
          tripContext: { partySize, remainingBudgetUsd },
          accommodations: results,
        });
      } catch (e) {
        console.error("[list_accommodations] error:", e);
        return errorResult("Error fetching accommodations");
      }
    },
  );

  server.registerTool(
    "get_accommodation",
    {
      title: "Get Accommodation",
      description: "Get full accommodation details including room types and pricing",
      inputSchema: {
        id: z.string().uuid().describe("Accommodation ID from list_accommodations"),
      },
    },
    async ({ id }) => {
      try {
        const accommodation = await queryAccommodationById(id);
        if (!accommodation)
          return { content: [{ type: "text" as const, text: "Accommodation not found" }] };
        return jsonResult(accommodation);
      } catch {
        return errorResult("Error fetching accommodation");
      }
    },
  );
}

import { db } from "@/src/db/index.js";
import { fetes, feteEditions } from "@/src/db/schema/fetes.js";
import { and, asc, between, eq, ilike, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { loadToolContext, type ActiveTripRow } from "@/src/mcp/lib/context.js";
import { daysFromCarnivalMonday } from "@/src/mcp/lib/carnival.js";

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

export async function queryFetes(input: { search?: string; limit?: number }) {
  const { search, limit = 20 } = input;

  return db
    .select({ id: fetes.id, name: fetes.name, category: fetes.category })
    .from(fetes)
    .where(search ? ilike(fetes.name, `%${search}%`) : undefined)
    .limit(limit);
}

/**
 * Edition-scoped query for context-aware list_fetes. Returns fete editions
 * within the trip's attendance window with the parent fete's name and category.
 */
export async function queryFetesForTrip(input: {
  trip: ActiveTripRow;
  search?: string;
  limit?: number;
}) {
  const { trip, search, limit = 20 } = input;
  if (!trip.arrivalDate || !trip.departureDate) {
    throw new Error("queryFetesForTrip requires arrival_date and departure_date");
  }

  const rows = await db
    .select({
      feteId: fetes.id,
      name: fetes.name,
      category: fetes.category,
      editionId: feteEditions.id,
      startDatetime: feteEditions.startDatetime,
      endDatetime: feteEditions.endDatetime,
      status: feteEditions.status,
    })
    .from(feteEditions)
    .innerJoin(fetes, eq(fetes.id, feteEditions.feteId))
    .where(
      and(
        eq(feteEditions.carnivalSeasonId, trip.carnivalSeasonId),
        eq(feteEditions.status, "published"),
        isNotNull(feteEditions.startDatetime),
        between(
          feteEditions.startDatetime,
          new Date(`${trip.arrivalDate}T00:00:00Z`),
          new Date(`${trip.departureDate}T23:59:59Z`),
        ),
        search ? ilike(fetes.name, `%${search}%`) : undefined,
      ),
    )
    .orderBy(asc(feteEditions.startDatetime))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    daysFromCarnivalMonday: r.startDatetime
      ? daysFromCarnivalMonday(r.startDatetime, trip.carnivalSeasonYear)
      : null,
  }));
}

export async function queryFeteById(id: string) {
  const fete = await db
    .select()
    .from(fetes)
    .where(eq(fetes.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!fete) return null;

  const editions = await db
    .select()
    .from(feteEditions)
    .where(eq(feteEditions.feteId, id));

  return { ...fete, editions };
}

export function registerFeteTools(server: McpServer, adminEmails: string[] = []) {
  server.registerTool(
    "list_fetes",
    {
      title: "List Fetes",
      description:
        "List fetes for the user's active trip, scoped to their attendance window. " +
        "Requires the active trip to have arrival_date and departure_date set — if missing, returns " +
        "{status: 'missing_context', required: [...]}; call update_trip_context first. " +
        "If no active trip, returns {status: 'no_active_trip'}; call create_trip first. " +
        "Otherwise returns fete editions within the window, including daysFromCarnivalMonday " +
        "(negative = before, 0 = Carnival Monday). Admins bypass all gates.",
      inputSchema: {
        search: z.string().optional().describe("Filter fetes by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async (input, extra) => {
      const auth = getAuth(extra);
      if (!auth) return errorResult("Authentication required");
      try {
        const ctx = await loadToolContext(auth.userId, auth.email, adminEmails);

        if (ctx.adminOverride && !ctx.trip) {
          const results = await queryFetes(input);
          return jsonResult({ status: "ok", is_admin: true, fetes: results });
        }

        if (ctx.statusResponse) return jsonResult(ctx.statusResponse);

        const trip = ctx.trip!;
        if (!trip.arrivalDate || !trip.departureDate) {
          return jsonResult({
            status: "missing_context",
            required: ["arrival_date", "departure_date"].filter((f) =>
              f === "arrival_date" ? !trip.arrivalDate : !trip.departureDate,
            ),
            hint: "Call update_trip_context to set the missing fields.",
          });
        }

        const results = await queryFetesForTrip({ trip, ...input });
        return jsonResult({
          status: "ok",
          is_admin: ctx.adminOverride,
          tripId: trip.id,
          window: { arrival: trip.arrivalDate, departure: trip.departureDate },
          fetes: results,
        });
      } catch (e) {
        console.error("[list_fetes] error:", e);
        return errorResult("Error fetching fetes");
      }
    },
  );

  server.registerTool(
    "get_fete",
    {
      title: "Get Fete",
      description: "Get full fete details including all yearly editions",
      inputSchema: {
        id: z.string().uuid().describe("Fete ID from list_fetes"),
      },
    },
    async ({ id }) => {
      try {
        const fete = await queryFeteById(id);
        if (!fete) return { content: [{ type: "text" as const, text: "Fete not found" }] };
        return jsonResult(fete);
      } catch {
        return errorResult("Error fetching fete");
      }
    },
  );
}

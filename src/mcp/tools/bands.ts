import { db } from "@/src/db/index.js";
import { bands, bandThemes, bandSections } from "@/src/db/schema/bands.js";
import { eq, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { loadToolContext, type ActiveTripRow } from "@/src/mcp/lib/context.js";

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

export async function queryBands(input: { search?: string; limit?: number }) {
  const { search, limit = 20 } = input;
  return db
    .select({ id: bands.id, name: bands.name, category: bands.category, size: bands.size })
    .from(bands)
    .where(search ? ilike(bands.name, `%${search}%`) : undefined)
    .limit(limit);
}

/**
 * Soft skew by party size:
 *   - very small parties (1-3) prefer Mini / Medium
 *   - medium parties (4-7)   any, Medium preferred
 *   - large parties (8+)     prefer Large
 * Bands with a theme for the trip's carnival season are surfaced first.
 */
export async function queryBandsForTrip(input: {
  trip: ActiveTripRow;
  search?: string;
  limit?: number;
}) {
  const { trip, search, limit = 20 } = input;
  const partySize = trip.partySize ?? 0;

  // Bands with a theme for this season
  const themedBandIds = await db
    .select({ bandId: bandThemes.bandId })
    .from(bandThemes)
    .where(eq(bandThemes.carnivalSeasonId, trip.carnivalSeasonId));
  const themedIds = new Set(themedBandIds.map((r) => r.bandId));

  // Category preference order based on party size
  let preferred: string[];
  if (partySize >= 8) preferred = ["Large", "Medium", "Mini"];
  else if (partySize >= 4) preferred = ["Medium", "Large", "Mini"];
  else preferred = ["Mini", "Medium", "Large"];

  const where = search ? ilike(bands.name, `%${search}%`) : undefined;

  const rows = await db
    .select({
      id: bands.id,
      name: bands.name,
      category: bands.category,
      size: bands.size,
      demographic: bands.demographic,
      costumeStyle: bands.costumeStyle,
    })
    .from(bands)
    .where(where);

  return rows
    .map((b) => ({
      ...b,
      hasThemeForSeason: themedIds.has(b.id),
      categoryPreferenceRank: b.category ? preferred.indexOf(b.category) : 99,
    }))
    .sort((a, b) => {
      if (a.hasThemeForSeason !== b.hasThemeForSeason) {
        return a.hasThemeForSeason ? -1 : 1;
      }
      return a.categoryPreferenceRank - b.categoryPreferenceRank;
    })
    .slice(0, limit);
}

export async function queryBandById(id: string) {
  const band = await db
    .select()
    .from(bands)
    .where(eq(bands.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!band) return null;

  const themes = await db
    .select()
    .from(bandThemes)
    .where(eq(bandThemes.bandId, id));

  const sections =
    themes.length > 0
      ? await db
          .select()
          .from(bandSections)
          .where(inArray(bandSections.bandThemeId, themes.map((t) => t.id)))
      : [];

  const themesWithSections = themes.map((t) => ({
    ...t,
    sections: sections.filter((s) => s.bandThemeId === t.id),
  }));

  return { ...band, themes: themesWithSections };
}

export function registerBandTools(server: McpServer, adminEmails: string[] = []) {
  server.registerTool(
    "list_bands",
    {
      title: "List Bands",
      description:
        "List masquerade bands. When the user has an active trip, results are ranked: " +
        "bands with a theme for the trip's carnival season first, then by category " +
        "preference based on party size (large parties prefer Large bands, small parties " +
        "prefer Mini/Medium). If no active trip, returns {status: 'no_active_trip'}; " +
        "admins bypass the gate.",
      inputSchema: {
        search: z.string().optional().describe("Filter bands by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async (input, extra) => {
      const auth = getAuth(extra);
      if (!auth) return errorResult("Authentication required");
      try {
        const ctx = await loadToolContext(auth.userId, auth.email, adminEmails);

        if (ctx.adminOverride && !ctx.trip) {
          const results = await queryBands(input);
          return jsonResult({ status: "ok", is_admin: true, bands: results });
        }

        if (ctx.statusResponse) return jsonResult(ctx.statusResponse);

        const trip = ctx.trip!;
        const results = await queryBandsForTrip({ trip, ...input });
        return jsonResult({
          status: "ok",
          is_admin: ctx.adminOverride,
          tripContext: { partySize: trip.partySize, carnivalYear: trip.carnivalSeasonYear },
          bands: results,
        });
      } catch (e) {
        console.error("[list_bands] error:", e);
        return errorResult("Error fetching bands");
      }
    },
  );

  server.registerTool(
    "get_band",
    {
      title: "Get Band",
      description:
        "Get full band details including themes and sections (sections are nested within each theme)",
      inputSchema: {
        id: z.string().uuid().describe("Band ID from list_bands"),
      },
    },
    async ({ id }) => {
      try {
        const band = await queryBandById(id);
        if (!band) return { content: [{ type: "text" as const, text: "Band not found" }] };
        return jsonResult(band);
      } catch {
        return errorResult("Error fetching band");
      }
    },
  );
}

import { db } from "@/src/db/index.js";
import { bands, bandThemes, bandSections } from "@/src/db/schema/bands.js";
import { eq, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function queryBands(input: { search?: string; limit?: number }) {
  const { search, limit = 20 } = input;
  return db
    .select({ id: bands.id, name: bands.name, category: bands.category, size: bands.size })
    .from(bands)
    .where(search ? ilike(bands.name, `%${search}%`) : undefined)
    .limit(limit);
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

  // bandSections links to bandThemes via bandThemeId, not directly to bands
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

export function registerBandTools(server: McpServer) {
  server.registerTool(
    "list_bands",
    {
      title: "List Bands",
      description: "Search and list carnival bands. Returns id, name, category, and size.",
      inputSchema: {
        search: z.string().optional().describe("Filter bands by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async (input) => {
      try {
        const results = await queryBands(input);
        return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
      } catch {
        return { content: [{ type: "text" as const, text: "Error fetching bands" }], isError: true };
      }
    }
  );

  server.registerTool(
    "get_band",
    {
      title: "Get Band",
      description: "Get full band details including themes and sections (sections are nested within each theme)",
      inputSchema: {
        id: z.string().uuid().describe("Band ID from list_bands"),
      },
    },
    async ({ id }) => {
      try {
        const band = await queryBandById(id);
        if (!band) return { content: [{ type: "text" as const, text: "Band not found" }] };
        return { content: [{ type: "text" as const, text: JSON.stringify(band, null, 2) }] };
      } catch {
        return { content: [{ type: "text" as const, text: "Error fetching band" }], isError: true };
      }
    }
  );
}

import { db } from "@/src/db/index.js";
import { accommodations, roomTypes } from "@/src/db/schema/accommodations.js";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function queryAccommodations(input: { search?: string; limit?: number }) {
  const { search, limit = 20 } = input;
  return db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      type: accommodations.type,
      starRating: accommodations.starRating,
    })
    .from(accommodations)
    .where(search ? ilike(accommodations.name, `%${search}%`) : undefined)
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

export function registerAccommodationTools(server: McpServer) {
  server.registerTool(
    "list_accommodations",
    {
      title: "List Accommodations",
      description: "Search and list accommodations. Returns id, name, type, and star rating.",
      inputSchema: {
        search: z.string().optional().describe("Filter accommodations by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async (input) => {
      try {
        const results = await queryAccommodations(input);
        return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
      } catch {
        return { content: [{ type: "text" as const, text: "Error fetching accommodations" }], isError: true };
      }
    }
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
        if (!accommodation) return { content: [{ type: "text" as const, text: "Accommodation not found" }] };
        return { content: [{ type: "text" as const, text: JSON.stringify(accommodation, null, 2) }] };
      } catch {
        return { content: [{ type: "text" as const, text: "Error fetching accommodation" }], isError: true };
      }
    }
  );
}

import { db } from "@/src/db/index.js";
import { fetes, feteEditions } from "@/src/db/schema/fetes.js";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function queryFetes(input: { search?: string; limit?: number }) {
  const { search, limit = 20 } = input;

  return db
    .select({ id: fetes.id, name: fetes.name, category: fetes.category })
    .from(fetes)
    .where(search ? ilike(fetes.name, `%${search}%`) : undefined)
    .limit(limit);
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

export function registerFeteTools(server: McpServer) {
  server.registerTool(
    "list_fetes",
    {
      title: "List Fetes",
      description: "Search and list fetes. Returns id, name, and category.",
      inputSchema: {
        search: z.string().optional().describe("Filter fetes by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async (input) => {
      try {
        const results = await queryFetes(input);
        return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
      } catch {
        return { content: [{ type: "text" as const, text: "Error fetching fetes" }], isError: true };
      }
    }
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
        return { content: [{ type: "text" as const, text: JSON.stringify(fete, null, 2) }] };
      } catch {
        return { content: [{ type: "text" as const, text: "Error fetching fete" }], isError: true };
      }
    }
  );
}

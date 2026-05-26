import { db } from "@/src/db/index.js";
import { vendors } from "@/src/db/schema/vendors.js";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export async function queryVendors(input: { search?: string; limit?: number }) {
  const { search, limit = 20 } = input;
  return db
    .select({
      id: vendors.id,
      name: vendors.name,
      type: vendors.type,
      website: vendors.website,
    })
    .from(vendors)
    .where(search ? ilike(vendors.name, `%${search}%`) : undefined)
    .limit(limit);
}

export async function queryVendorById(id: string) {
  return db
    .select()
    .from(vendors)
    .where(eq(vendors.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
}

export function registerVendorTools(server: McpServer) {
  server.registerTool(
    "list_vendors",
    {
      title: "List Vendors",
      description: "Search and list vendors. Returns id, name, type, and website.",
      inputSchema: {
        search: z.string().optional().describe("Filter vendors by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async (input) => {
      const results = await queryVendors(input);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_vendor",
    {
      title: "Get Vendor",
      description: "Get full vendor details by ID",
      inputSchema: {
        id: z.string().uuid().describe("Vendor ID from list_vendors"),
      },
    },
    async ({ id }) => {
      const vendor = await queryVendorById(id);
      if (!vendor) {
        return { content: [{ type: "text" as const, text: "Vendor not found" }] };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(vendor, null, 2) }],
      };
    }
  );
}

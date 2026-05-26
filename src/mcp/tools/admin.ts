import { db } from "@/src/db/index.js";
import { fetes, feteEditions } from "@/src/db/schema/fetes.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

const FETE_CATEGORIES = [
  "Fete",
  "Traditional Jouvert",
  "Traditional Carnival Event",
  "Jouvert Style",
] as const;

type FeteCategory = typeof FETE_CATEGORIES[number];

export function isAdmin(email: string, adminEmails: string[]): boolean {
  const lower = email.toLowerCase();
  return adminEmails.map((e) => e.toLowerCase()).includes(lower);
}

export function buildFeteInput(input: { name: string; category: string }) {
  if (!FETE_CATEGORIES.includes(input.category as FeteCategory)) {
    throw new Error(
      `Invalid category: "${input.category}". Must be one of: ${FETE_CATEGORIES.join(", ")}`
    );
  }
  return { name: input.name, category: input.category as FeteCategory };
}

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

function requireAdmin(extra: Extra, adminEmails: string[]): string | null {
  const email = extra?.authInfo?.extra?.["email"] as string | undefined;
  if (!email || !isAdmin(email, adminEmails)) return null;
  return email;
}

export function registerAdminTools(server: McpServer, adminEmails: string[]) {
  server.registerTool(
    "create_fete",
    {
      title: "Create Fete (Admin)",
      description: "Create a new fete master record. Admin only.",
      inputSchema: {
        name: z.string().min(1).describe("Fete name"),
        category: z.enum(FETE_CATEGORIES).describe("Fete category"),
      },
    },
    async (input, extra) => {
      const email = requireAdmin(extra, adminEmails);
      if (!email) {
        return { content: [{ type: "text" as const, text: "Access denied: admin only" }], isError: true };
      }
      try {
        const [created] = await db.insert(fetes).values(buildFeteInput(input)).returning();
        return {
          content: [{ type: "text" as const, text: `Created: ${JSON.stringify(created, null, 2)}` }],
        };
      } catch {
        return { content: [{ type: "text" as const, text: "Error creating fete" }], isError: true };
      }
    }
  );

  server.registerTool(
    "update_fete_edition_status",
    {
      title: "Update Fete Edition Status (Admin)",
      description: "Set fete edition status to draft, published, cancelled, or completed. Admin only.",
      inputSchema: {
        editionId: z.string().uuid().describe("Fete edition ID"),
        status: z.enum(["draft", "published", "cancelled", "completed"]),
      },
    },
    async ({ editionId, status }, extra) => {
      const email = requireAdmin(extra, adminEmails);
      if (!email) {
        return { content: [{ type: "text" as const, text: "Access denied: admin only" }], isError: true };
      }
      try {
        const [updated] = await db
          .update(feteEditions)
          .set({ status })
          .where(eq(feteEditions.id, editionId))
          .returning();
        if (!updated) {
          return { content: [{ type: "text" as const, text: "Fete edition not found" }] };
        }
        return {
          content: [{ type: "text" as const, text: `Updated: ${JSON.stringify(updated, null, 2)}` }],
        };
      } catch {
        return { content: [{ type: "text" as const, text: "Error updating fete edition" }], isError: true };
      }
    }
  );
}

import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/src/mcp/auth";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ping",
      {
        title: "Ping",
        description:
          "Health check — returns the authenticated user's email and plan",
        inputSchema: {},
      },
      async (_input, extra: { authInfo?: AuthInfo }) => {
        const email =
          (extra.authInfo?.extra?.email as string | undefined) ?? "unknown";
        const plan =
          (extra.authInfo?.extra?.plan as string | undefined) ?? "unknown";
        return {
          content: [
            { type: "text" as const, text: `pong — ${email} (${plan})` },
          ],
        };
      }
    );
  },
  {},
  { basePath: "/api", maxDuration: 60 }
);

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };

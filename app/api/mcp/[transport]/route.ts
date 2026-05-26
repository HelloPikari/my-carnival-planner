import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/src/mcp/auth.js";
import { registerFeteTools } from "@/src/mcp/tools/fetes.js";
import { registerBandTools } from "@/src/mcp/tools/bands.js";
import { registerAccommodationTools } from "@/src/mcp/tools/accommodations.js";
import { registerVendorTools } from "@/src/mcp/tools/vendors.js";
import { registerAdminTools } from "@/src/mcp/tools/admin.js";

const ADMIN_EMAILS = (process.env.MCP_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

const handler = createMcpHandler(
  (server) => {
    registerFeteTools(server);
    registerBandTools(server);
    registerAccommodationTools(server);
    registerVendorTools(server);
    registerAdminTools(server, ADMIN_EMAILS);
  },
  {},
  { basePath: "/api", maxDuration: 60 }
);

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };

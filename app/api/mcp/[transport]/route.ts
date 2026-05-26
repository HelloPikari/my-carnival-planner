import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/src/mcp/auth.js";
import { registerFeteTools } from "@/src/mcp/tools/fetes.js";
import { registerBandTools } from "@/src/mcp/tools/bands.js";
import { registerAccommodationTools } from "@/src/mcp/tools/accommodations.js";
import { registerVendorTools } from "@/src/mcp/tools/vendors.js";

const handler = createMcpHandler(
  (server) => {
    registerFeteTools(server);
    registerBandTools(server);
    registerAccommodationTools(server);
    registerVendorTools(server);
  },
  {},
  { basePath: "/api", maxDuration: 60 }
);

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };

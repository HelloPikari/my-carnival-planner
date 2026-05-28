import { createRemoteJWKSet, jwtVerify, decodeJwt } from "jose";
import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { eq } from "drizzle-orm";

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!_jwks) {
    const uri = process.env.WORKOS_JWKS_URI;
    if (!uri) throw new Error("WORKOS_JWKS_URI is not set");
    _jwks = createRemoteJWKSet(new URL(uri));
  }
  return _jwks;
}

export async function verifyMcpToken(_req: Request, bearerToken?: string) {
  if (!bearerToken) return undefined;

  try {
    const { payload } = await jwtVerify(bearerToken, getJWKS(), {
      algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
      issuer: process.env.WORKOS_ISSUER,
      // No audience check — WorkOS does not emit aud by default.
      // Use the client_id claim below to isolate per-app tokens.
    });

    // Reject tokens issued for a different application in the same WorkOS environment.
    // iss is environment-level (always the Default app); client_id is the per-app boundary.
    if (payload.client_id !== process.env.WORKOS_CLIENT_ID) {
      console.error("[MCP auth] token client_id mismatch:", payload.client_id, "expected:", process.env.WORKOS_CLIENT_ID);
      return undefined;
    }

    const workosId = payload.sub as string;
    const user = await db
      .select()
      .from(users)
      .where(eq(users.workosId, workosId))
      .limit(1)
      .then((r) => r[0]);

    if (!user) {
      console.error("[MCP auth] no user found for workosId:", workosId);
      return undefined;
    }
    if (user.subscriptionStatus !== "active") {
      console.error("[MCP auth] user not active:", user.email, user.subscriptionStatus);
      return undefined;
    }

    console.log("[MCP auth] authenticated:", user.email, user.subscriptionPlan);
    return {
      token: bearerToken,
      scopes: [user.subscriptionPlan],
      clientId: workosId,
      expiresAt: payload.exp,
      extra: {
        userId: user.id,
        email: user.email,
        plan: user.subscriptionPlan,
      },
    };
  } catch (err) {
    const msg = (err as Error).message;
    try {
      const claims = decodeJwt(bearerToken);
      console.error("[MCP auth] token validation failed:", msg, {
        iss: claims.iss,
        aud: claims.aud,
        exp: claims.exp,
        expectedIss: process.env.WORKOS_ISSUER,
        expectedAud: process.env.WORKOS_CLIENT_ID,
      });
    } catch {
      console.error("[MCP auth] token validation failed (undecodable):", msg);
    }
    return undefined;
  }
}

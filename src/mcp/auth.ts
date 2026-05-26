import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { eq } from "drizzle-orm";

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(process.env.WORKOS_JWKS_URI!));
  }
  return _jwks;
}

export async function verifyMcpToken(_req: Request, bearerToken?: string) {
  if (!bearerToken) return undefined;

  try {
    const { payload } = await jwtVerify(bearerToken, getJWKS(), {
      algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
      issuer: process.env.WORKOS_ISSUER,
    });

    const workosId = payload.sub as string;
    const user = await db
      .select()
      .from(users)
      .where(eq(users.workosId, workosId))
      .limit(1)
      .then((r) => r[0]);

    if (!user) return undefined;

    return {
      token: bearerToken,
      scopes: [user.subscriptionPlan],
      clientId: workosId,
      extra: {
        userId: user.id,
        email: user.email,
        plan: user.subscriptionPlan,
      },
    };
  } catch {
    return undefined;
  }
}

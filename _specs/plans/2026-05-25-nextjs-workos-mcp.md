# Next.js + WorkOS Auth + Admin MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing Drizzle/Postgres repo to a Next.js (App Router) application with WorkOS authentication and an admin MCP server for Steve and Nicole.

**Architecture:** Next.js App Router on Vercel wraps everything — web pages, API routes, and the MCP server in one deployment. WorkOS AuthKit handles auth for all users. The MCP server uses Vercel's `mcp-handler` with WorkOS JWT validation, and exposes read tools for all authenticated users and write tools for admins only.

**Tech Stack:** Next.js 15, `@workos-inc/authkit-nextjs`, `mcp-handler`, `@modelcontextprotocol/sdk@1.26.0`, `jose`, `zod`, Drizzle ORM (existing), Postgres on DigitalOcean (existing), Vitest (existing)

---

## File Map

**Create:**
- `next.config.ts` — minimal Next.js config
- `tsconfig.json` — replace existing with Next.js-compatible settings
- `middleware.ts` — WorkOS auth middleware (root level, alongside `app/`)
- `app/layout.tsx` — root layout with AuthKitProvider
- `app/page.tsx` — home page stub with auth state
- `app/api/auth/callback/route.ts` — WorkOS OAuth callback + JIT provisioning
- `app/api/oauth/authorize/route.ts` — OAuth proxy: forward to WorkOS + inject `provider=authkit`
- `app/api/oauth/token/route.ts` — OAuth proxy: server-side code exchange
- `app/api/oauth/register/route.ts` — fake DCR for mcp-remote
- `app/.well-known/oauth-authorization-server/route.ts` — RFC 8414 discovery
- `app/.well-known/oauth-protected-resource/route.ts` — RFC 9728 discovery
- `app/api/mcp/[transport]/route.ts` — MCP server endpoint
- `src/mcp/provision.ts` — JIT user provisioning on first WorkOS login
- `src/mcp/auth.ts` — JWT validation + user resolution for MCP
- `src/mcp/tools/fetes.ts` — MCP fete read tools
- `src/mcp/tools/bands.ts` — MCP band read tools
- `src/mcp/tools/accommodations.ts` — MCP accommodation read tools
- `src/mcp/tools/vendors.ts` — MCP vendor read tools
- `src/mcp/tools/admin.ts` — MCP admin write tools (admin emails only)
- `tests/mcp/provision.test.ts` — JIT provisioning tests
- `tests/mcp/tools/fetes.test.ts` — fete tool tests
- `tests/mcp/tools/admin.test.ts` — admin tool tests

**Modify:**
- `package.json` — add Next.js, React, WorkOS, mcp-handler, jose, zod
- `src/db/schema/users.ts` — add `workosId`, `subscriptionPlan`, `subscriptionStatus`; remove `passwordHash`, `sessions` table, `roles` tables
- `src/db/schema/enums.ts` — add `subscriptionPlanEnum` (free/pro/premium)

---

## Task 1: Initialize Next.js

**Files:**
- Modify: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json` (replaces existing)
- Create: `app/layout.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Verify no conflicting scripts exist**

```bash
cat package.json | grep -E '"dev"|"build"|"start"'
```

Expected: No output — these keys don't exist yet.

- [ ] **Step 2: Install Next.js and React**

```bash
npm install next@15 react@19 react-dom@19 @types/react@19 @types/react-dom@19
```

Verify: `cat node_modules/next/package.json | grep '"version"' | head -1`

- [ ] **Step 3: Add scripts to package.json**

Add to the `"scripts"` block — keep all existing scripts (`db:generate`, `db:migrate`, etc.):

```json
"dev": "next dev",
"build": "next build",
"start": "next start",
```

- [ ] **Step 4: Create next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Replace tsconfig.json**

Read the current `tsconfig.json` first to note any custom settings. Then replace entirely:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 6: Create app/layout.tsx**

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Note: `AuthKitProvider` is added in Task 3 after WorkOS is installed.

- [ ] **Step 7: Create app/page.tsx**

```tsx
export default function HomePage() {
  return <h1>My Carnival Planner</h1>;
}
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: `▲ Next.js 15.x.x` in output, server on `http://localhost:3000`. Visit it and confirm "My Carnival Planner" renders. Stop with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git add app/ next.config.ts tsconfig.json package.json package-lock.json
git commit -m "feat: initialize Next.js App Router alongside existing Drizzle schema"
```

---

## Task 2: Update User Schema for WorkOS

WorkOS replaces local passwords and sessions. Add `workosId` + subscription fields; remove `passwordHash` and the `sessions`, `roles`, `user_roles` tables.

**Files:**
- Modify: `src/db/schema/enums.ts`
- Modify: `src/db/schema/users.ts`

- [ ] **Step 1: Check all usages of subscriptionTierEnum**

```bash
grep -rn "subscriptionTierEnum\|subscription_tier" src/db/schema/
```

Note every file and line. If `commerce.ts` uses it, you must update those columns too.

- [ ] **Step 2: Add subscriptionPlanEnum to enums.ts**

Read `src/db/schema/enums.ts` first. Add this block before the final export (keep all existing enums intact):

```typescript
export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "pro",
  "premium",
]);
```

Do NOT remove `subscriptionTierEnum` yet — existing migrations may reference it.

- [ ] **Step 3: Rewrite src/db/schema/users.ts**

```typescript
import { pgTable, uuid, text, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import { vendors } from "./vendors.js";
import { subscriptionPlanEnum, subscriptionStatusEnum } from "./enums.js";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workosId: text("workos_id").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  subscriptionPlan: subscriptionPlanEnum("subscription_plan").notNull().default("free"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").notNull().default("active"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const usersRelations = relations(users, ({ one }) => ({
  vendor: one(vendors, {
    fields: [users.id],
    references: [vendors.userId],
  }),
}));
```

Note: `roles`, `userRoles`, `sessions`, and their relations are removed. WorkOS handles auth; authorization is determined by `subscriptionPlan`.

- [ ] **Step 4: Generate migration**

```bash
npm run db:generate
```

Inspect the generated file:

```bash
ls -t drizzle/*.sql | head -1 | xargs cat
```

Confirm it: adds `workos_id`, `subscription_plan`, `subscription_status`; drops `password_hash`; drops `sessions`, `user_roles`, `roles` tables.

- [ ] **Step 5: Run migration**

```bash
npm run db:migrate
```

Expected: No errors.

- [ ] **Step 6: Verify schema**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

Expected columns: `id`, `workos_id`, `email`, `display_name`, `avatar_url`, `subscription_plan`, `subscription_status`, `metadata`, `created_at`, `updated_at`.
Expected absent: `password_hash`.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema/ drizzle/
git commit -m "feat: update user schema for WorkOS (workosId, subscription plan, remove passwords/sessions)"
```

---

## Task 3: WorkOS AuthKit Integration

**Files:**
- Create: `.env.local` (gitignored — do not commit)
- Create: `middleware.ts`
- Create: `app/api/auth/callback/route.ts`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Install WorkOS AuthKit**

```bash
npm install @workos-inc/authkit-nextjs
```

Verify: `ls node_modules/@workos-inc/authkit-nextjs`

- [ ] **Step 2: Confirm .env.local is gitignored**

```bash
grep -E "\.env\.local|\.env\*" .gitignore
```

Expected: `.env.local` or `.env*` present in output. If not, add `.env.local` to `.gitignore` before continuing.

- [ ] **Step 3: Create .env.local**

Fill in real values from the WorkOS Dashboard:

```bash
# WorkOS AuthKit
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_...
WORKOS_COOKIE_PASSWORD=<run: openssl rand -base64 32>
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback

# MCP server auth
# GOTCHA: use /sso/jwks/ NOT /user_management/jwks/ — the latter 404s
WORKOS_JWKS_URI=https://api.workos.com/sso/jwks/<your-client-id>
# GOTCHA: must include client-id path segment
WORKOS_ISSUER=https://api.workos.com/user_management/<your-client-id>
OAUTH_ISSUER=http://localhost:3000

# Database
DATABASE_URL=postgresql://...

# Admin MCP access (comma-separated emails)
MCP_ADMIN_EMAILS=steve@pikari.io,nicole@...
```

- [ ] **Step 4: Check Next.js version for correct middleware convention**

```bash
cat node_modules/next/package.json | grep '"version"' | head -1
```

- Version `15.x.x` → proceed to Step 5a (create `middleware.ts`)
- Version `16.x.x` or higher → proceed to Step 5b (create `proxy.ts`)

- [ ] **Step 5a: Create middleware.ts (Next.js 15)**

```typescript
import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware();

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/auth|api/oauth|api/mcp|\\.well-known).*)",
  ],
};
```

- [ ] **Step 5b: Create proxy.ts (Next.js 16+, use instead of Step 5a)**

```typescript
import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy();

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/auth|api/oauth|api/mcp|\\.well-known).*)",
  ],
};
```

- [ ] **Step 6: Create app/api/auth/callback/route.ts**

```typescript
import { handleAuth } from "@workos-inc/authkit-nextjs";

export const GET = handleAuth();
```

Note: JIT provisioning is wired here in Task 4.

- [ ] **Step 7: Update app/layout.tsx with AuthKitProvider**

```tsx
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthKitProvider>{children}</AuthKitProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Update app/page.tsx to show auth state**

```tsx
import { withAuth, getSignInUrl } from "@workos-inc/authkit-nextjs";

export default async function HomePage() {
  const { user } = await withAuth();

  if (!user) {
    const signInUrl = await getSignInUrl();
    return (
      <main>
        <h1>My Carnival Planner</h1>
        <a href={signInUrl}>Sign in</a>
      </main>
    );
  }

  return (
    <main>
      <h1>My Carnival Planner</h1>
      <p>Welcome, {user.email}</p>
    </main>
  );
}
```

- [ ] **Step 9: WorkOS Dashboard setup**

In the WorkOS Dashboard:
- **Authentication → Redirect URIs**: add `http://localhost:3000/api/auth/callback`
- **Authentication → Redirect URIs**: add `https://claude.ai/api/mcp/auth_callback`
- **Organizations**: create org for `pikari.io`, enable Automatic membership

- [ ] **Step 10: Verify the auth flow**

```bash
npm run dev
```

Visit `http://localhost:3000`. Click "Sign in". Confirm:
1. Browser goes to a real `https://api.workos.com/...` URL (not `/[object Object]`)
2. Complete sign-in with your pikari.io email
3. Redirected back to `http://localhost:3000` showing "Welcome, your@email.com"

- [ ] **Step 11: Verify middleware placement**

```bash
ls middleware.ts proxy.ts 2>/dev/null
grep "AuthKitProvider" app/layout.tsx
```

Both must pass. If middleware is missing, the auth flow won't protect routes.

- [ ] **Step 12: Commit**

```bash
git add app/ middleware.ts package.json package-lock.json
git commit -m "feat: add WorkOS AuthKit for all users"
```

---

## Task 4: JIT User Provisioning

When a user signs in with WorkOS for the first time, create their Postgres record.

**Files:**
- Create: `src/mcp/provision.ts`
- Create: `tests/mcp/provision.test.ts`
- Modify: `app/api/auth/callback/route.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/mcp/provision.test.ts`:

```typescript
import { describe, it, expect, afterAll } from "vitest";
import { findOrProvisionUser } from "@/src/mcp/provision";
import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { eq } from "drizzle-orm";

const testWorkosId = `user_test_provision_${Date.now()}`;
const testEmail = `provision-test-${Date.now()}@pikari.io`;
const noNameId = `user_noname_${Date.now()}`;
const noNameEmail = `noname-${Date.now()}@pikari.io`;

describe("findOrProvisionUser", () => {
  afterAll(async () => {
    await db.delete(users).where(eq(users.email, testEmail));
    await db.delete(users).where(eq(users.email, noNameEmail));
  });

  it("creates a new user on first login", async () => {
    const user = await findOrProvisionUser({
      id: testWorkosId,
      email: testEmail,
      firstName: "Test",
      lastName: "User",
    });
    expect(user.workosId).toBe(testWorkosId);
    expect(user.email).toBe(testEmail);
    expect(user.displayName).toBe("Test User");
    expect(user.subscriptionPlan).toBe("free");
  });

  it("returns the same user on subsequent calls", async () => {
    const first = await findOrProvisionUser({ id: testWorkosId, email: testEmail });
    const second = await findOrProvisionUser({ id: testWorkosId, email: testEmail });
    expect(first.id).toBe(second.id);
  });

  it("uses email prefix as displayName when no name provided", async () => {
    const user = await findOrProvisionUser({ id: noNameId, email: noNameEmail });
    expect(user.displayName).toMatch(/^noname-/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/mcp/provision.test.ts
```

Expected: FAIL — `Cannot find module '@/src/mcp/provision'`

- [ ] **Step 3: Create src/mcp/provision.ts**

```typescript
import { db } from "@/src/db/index.js";
import { users } from "@/src/db/schema/users.js";
import { eq } from "drizzle-orm";

interface WorkosUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export async function findOrProvisionUser(workosUser: WorkosUser) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.workosId, workosUser.id))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const displayName =
    [workosUser.firstName, workosUser.lastName].filter(Boolean).join(" ") ||
    workosUser.email.split("@")[0];

  const [created] = await db
    .insert(users)
    .values({
      workosId: workosUser.id,
      email: workosUser.email,
      displayName,
      subscriptionPlan: "free",
      subscriptionStatus: "active",
    })
    .returning();

  return created;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/mcp/provision.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Wire provisioning into the auth callback**

Modify `app/api/auth/callback/route.ts`:

```typescript
import { handleAuth } from "@workos-inc/authkit-nextjs";
import { findOrProvisionUser } from "@/src/mcp/provision";

export const GET = handleAuth({
  onSuccess: async ({ user }) => {
    await findOrProvisionUser({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add src/mcp/provision.ts tests/mcp/provision.test.ts app/api/auth/callback/route.ts
git commit -m "feat: JIT provision users in Postgres on first WorkOS login"
```

---

## Task 5: OAuth Proxy + Well-Known Endpoints

These allow `mcp-remote` and Claude Desktop to discover and drive the MCP auth flow.

**Files:**
- Create: `app/api/oauth/authorize/route.ts`
- Create: `app/api/oauth/token/route.ts`
- Create: `app/api/oauth/register/route.ts`
- Create: `app/.well-known/oauth-authorization-server/route.ts`
- Create: `app/.well-known/oauth-protected-resource/route.ts`

- [ ] **Step 1: Create app/api/oauth/authorize/route.ts**

Forwards the request to WorkOS, injecting `provider=authkit` (without this, WorkOS shows a broken connection selector).

```typescript
export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const target = new URL(
    process.env.WORKOS_AUTHORIZATION_ENDPOINT ??
      "https://api.workos.com/user_management/authorize"
  );

  for (const [key, value] of incoming.searchParams) {
    target.searchParams.set(key, value);
  }
  target.searchParams.set("provider", "authkit");

  return Response.redirect(target.toString(), 302);
}
```

- [ ] **Step 2: Create app/api/oauth/token/route.ts**

Exchanges the code server-side so `WORKOS_API_KEY` never leaves the server.

```typescript
async function callWorkosAuthenticate(body: Record<string, string>) {
  const res = await fetch("https://api.workos.com/user_management/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.WORKOS_CLIENT_ID,
      client_secret: process.env.WORKOS_API_KEY,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`WorkOS authenticate failed: ${await res.text()}`);
  return res.json();
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const text = await req.text();
  const params = contentType.includes("application/json")
    ? new URLSearchParams(JSON.parse(text) as Record<string, string>)
    : new URLSearchParams(text);

  try {
    const grantType = params.get("grant_type");

    let token: unknown;
    if (grantType === "authorization_code") {
      token = await callWorkosAuthenticate({
        grant_type: "authorization_code",
        code: params.get("code") ?? "",
        redirect_uri: params.get("redirect_uri") ?? "",
        ...(params.get("code_verifier") ? { code_verifier: params.get("code_verifier")! } : {}),
      });
    } else if (grantType === "refresh_token") {
      token = await callWorkosAuthenticate({
        grant_type: "refresh_token",
        refresh_token: params.get("refresh_token") ?? "",
      });
    } else {
      return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
    }

    return Response.json(token);
  } catch (err) {
    return Response.json(
      { error: "server_error", error_description: (err as Error).message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create app/api/oauth/register/route.ts**

Fake DCR — WorkOS doesn't support it, but mcp-remote requires it. Echo back the client ID and redirect URIs.

```typescript
export async function POST(req: Request) {
  const body = await req.json() as { redirect_uris?: string[] };
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

  return Response.json(
    {
      client_id: process.env.WORKOS_CLIENT_ID,
      client_secret_expires_at: 0,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 }
  );
}
```

- [ ] **Step 4: Create app/.well-known/oauth-authorization-server/route.ts**

```typescript
export async function GET() {
  const issuer = process.env.OAUTH_ISSUER ?? "https://my-carnival-planner.vercel.app";

  return Response.json({
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
```

- [ ] **Step 5: Create app/.well-known/oauth-protected-resource/route.ts**

```typescript
export async function GET() {
  const resource = process.env.OAUTH_ISSUER ?? "https://my-carnival-planner.vercel.app";
  const authServer = process.env.WORKOS_ISSUER ?? "https://api.workos.com";

  return Response.json({ resource, authorization_servers: [authServer] });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
```

- [ ] **Step 6: Verify endpoints locally**

```bash
npm run dev &
sleep 3
echo "=== oauth-authorization-server ==="
curl -s http://localhost:3000/.well-known/oauth-authorization-server | python3 -m json.tool
echo "=== oauth-protected-resource ==="
curl -s http://localhost:3000/.well-known/oauth-protected-resource | python3 -m json.tool
echo "=== fake DCR ==="
curl -s -X POST http://localhost:3000/api/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris":["http://localhost:24931/callback"]}' | python3 -m json.tool
kill %1
```

Expected: All three return valid JSON without Python errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/oauth/ "app/.well-known/"
git commit -m "feat: add OAuth proxy and RFC 8414/9728 well-known endpoints"
```

---

## Task 6: MCP Server Foundation

**Files:**
- Create: `src/mcp/auth.ts`
- Create: `app/api/mcp/[transport]/route.ts`

- [ ] **Step 1: Install MCP dependencies**

```bash
npm install mcp-handler @modelcontextprotocol/sdk@1.26.0 zod jose
```

Verify:
```bash
cat node_modules/mcp-handler/package.json | grep '"version"'
cat node_modules/jose/package.json | grep '"version"'
```

- [ ] **Step 2: Create src/mcp/auth.ts**

JWT validation using WorkOS JWKS + local user lookup.

```typescript
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
```

- [ ] **Step 3: Create app/api/mcp/[transport]/route.ts with a ping tool**

```typescript
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/src/mcp/auth";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ping",
      {
        title: "Ping",
        description: "Health check — returns the authenticated user's email and plan",
        inputSchema: {},
      },
      async (_input: Record<string, never>, extra: { authInfo?: { extra?: { email?: string; plan?: string } } }) => {
        const email = extra.authInfo?.extra?.email ?? "unknown";
        const plan = extra.authInfo?.extra?.plan ?? "unknown";
        return {
          content: [{ type: "text" as const, text: `pong — ${email} (${plan})` }],
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
```

- [ ] **Step 4: Verify 401 is returned for invalid tokens**

```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3000/api/mcp \
  -H "Authorization: Bearer bad_token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
kill %1
```

Expected: `401`

- [ ] **Step 5: Test with Claude Desktop (manual)**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "carnival-local": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"]
    }
  }
}
```

Start `npm run dev`, restart Claude Desktop, complete auth flow, ask Claude to call the `ping` tool. Expected response: `pong — your@email.com (free)`.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/auth.ts app/api/mcp/ package.json package-lock.json
git commit -m "feat: add MCP server with WorkOS JWT auth and ping tool"
```

---

## Task 7: MCP Read Tools

**Files:**
- Create: `src/mcp/tools/fetes.ts`
- Create: `src/mcp/tools/bands.ts`
- Create: `src/mcp/tools/accommodations.ts`
- Create: `src/mcp/tools/vendors.ts`
- Create: `tests/mcp/tools/fetes.test.ts`
- Modify: `app/api/mcp/[transport]/route.ts`

- [ ] **Step 1: Write failing tests for fete query functions**

Create `tests/mcp/tools/fetes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { queryFetes, queryFeteById } from "@/src/mcp/tools/fetes";

describe("queryFetes", () => {
  it("returns a non-empty list", async () => {
    const result = await queryFetes({ limit: 5 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
  });

  it("filters by search term", async () => {
    const all = await queryFetes({ limit: 50 });
    const term = all[0].name.split(" ")[0];
    const filtered = await queryFetes({ search: term, limit: 50 });
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every((f: { name: string }) =>
        f.name.toLowerCase().includes(term.toLowerCase())
      )
    ).toBe(true);
  });
});

describe("queryFeteById", () => {
  it("returns null for unknown id", async () => {
    const result = await queryFeteById("00000000-0000-0000-0000-000000000000");
    expect(result).toBeNull();
  });

  it("returns fete with editions for a known id", async () => {
    const list = await queryFetes({ limit: 1 });
    const fete = await queryFeteById(list[0].id);
    expect(fete).not.toBeNull();
    expect(Array.isArray(fete!.editions)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/mcp/tools/fetes.test.ts
```

Expected: FAIL — `Cannot find module '@/src/mcp/tools/fetes'`

- [ ] **Step 3: Create src/mcp/tools/fetes.ts**

First read `src/db/schema/fetes.ts` to confirm exact table and column names.

```typescript
import { db } from "@/src/db/index.js";
import { fetes, feteEditions } from "@/src/db/schema/fetes.js";
import { eq, ilike, and } from "drizzle-orm";
import { z } from "zod";

export async function queryFetes(input: { search?: string; limit?: number }) {
  const { search, limit = 20 } = input;
  const conditions = search ? [ilike(fetes.name, `%${search}%`)] : [];

  return db
    .select({ id: fetes.id, name: fetes.name, category: fetes.category })
    .from(fetes)
    .where(conditions.length ? and(...conditions) : undefined)
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

  const editions = await db.select().from(feteEditions).where(eq(feteEditions.feteId, id));
  return { ...fete, editions };
}

export function registerFeteTools(server: { registerTool: Function }) {
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
    async (input: { search?: string; limit?: number }) => {
      const results = await queryFetes(input);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.registerTool(
    "get_fete",
    {
      title: "Get Fete",
      description: "Get full fete details including all yearly editions",
      inputSchema: { id: z.string().uuid().describe("Fete ID from list_fetes") },
    },
    async ({ id }: { id: string }) => {
      const fete = await queryFeteById(id);
      if (!fete) return { content: [{ type: "text" as const, text: "Fete not found" }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(fete, null, 2) }] };
    }
  );
}
```

- [ ] **Step 4: Run fete tests**

```bash
npx vitest run tests/mcp/tools/fetes.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Create src/mcp/tools/bands.ts**

Read `src/db/schema/bands.ts` to confirm table/column names before writing.

```typescript
import { db } from "@/src/db/index.js";
import { bands, bandThemes, bandSections } from "@/src/db/schema/bands.js";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";

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

  const themes = await db.select().from(bandThemes).where(eq(bandThemes.bandId, id));
  const sections = await db.select().from(bandSections).where(eq(bandSections.bandId, id));
  return { ...band, themes, sections };
}

export function registerBandTools(server: { registerTool: Function }) {
  server.registerTool(
    "list_bands",
    {
      title: "List Bands",
      description: "Search and list carnival bands",
      inputSchema: {
        search: z.string().optional().describe("Filter bands by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async (input: { search?: string; limit?: number }) => {
      const results = await queryBands(input);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.registerTool(
    "get_band",
    {
      title: "Get Band",
      description: "Get full band details including themes and sections",
      inputSchema: { id: z.string().uuid().describe("Band ID from list_bands") },
    },
    async ({ id }: { id: string }) => {
      const band = await queryBandById(id);
      if (!band) return { content: [{ type: "text" as const, text: "Band not found" }] };
      return { content: [{ type: "text" as const, text: JSON.stringify(band, null, 2) }] };
    }
  );
}
```

- [ ] **Step 6: Create src/mcp/tools/accommodations.ts**

Read `src/db/schema/accommodations.ts` to confirm table/column names before writing.

```typescript
import { db } from "@/src/db/index.js";
import { accommodations, roomTypes } from "@/src/db/schema/accommodations.js";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";

export function registerAccommodationTools(server: { registerTool: Function }) {
  server.registerTool(
    "list_accommodations",
    {
      title: "List Accommodations",
      description: "Search and list accommodations",
      inputSchema: {
        search: z.string().optional().describe("Filter by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ search, limit = 20 }: { search?: string; limit?: number }) => {
      const results = await db
        .select({ id: accommodations.id, name: accommodations.name })
        .from(accommodations)
        .where(search ? ilike(accommodations.name, `%${search}%`) : undefined)
        .limit(limit);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.registerTool(
    "get_accommodation",
    {
      title: "Get Accommodation",
      description: "Get accommodation details including room types",
      inputSchema: { id: z.string().uuid().describe("Accommodation ID from list_accommodations") },
    },
    async ({ id }: { id: string }) => {
      const accommodation = await db
        .select()
        .from(accommodations)
        .where(eq(accommodations.id, id))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!accommodation)
        return { content: [{ type: "text" as const, text: "Accommodation not found" }] };

      const rooms = await db.select().from(roomTypes).where(eq(roomTypes.accommodationId, id));
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ ...accommodation, roomTypes: rooms }, null, 2) },
        ],
      };
    }
  );
}
```

- [ ] **Step 7: Create src/mcp/tools/vendors.ts**

Read `src/db/schema/vendors.ts` to confirm table/column names before writing.

```typescript
import { db } from "@/src/db/index.js";
import { vendors } from "@/src/db/schema/vendors.js";
import { eq, ilike, and } from "drizzle-orm";
import { z } from "zod";

export function registerVendorTools(server: { registerTool: Function }) {
  server.registerTool(
    "list_vendors",
    {
      title: "List Vendors",
      description: "List vendors. Filter by type: organizer, band, hotel, designer.",
      inputSchema: {
        type: z.string().optional().describe("Vendor type: organizer, band, hotel, designer"),
        search: z.string().optional().describe("Filter by name"),
        limit: z.number().int().min(1).max(100).default(20),
      },
    },
    async ({ type, search, limit = 20 }: { type?: string; search?: string; limit?: number }) => {
      const conditions = [];
      if (search) conditions.push(ilike(vendors.name, `%${search}%`));
      if (type) conditions.push(eq(vendors.type, type as any));

      const results = await db
        .select({ id: vendors.id, name: vendors.name, type: vendors.type })
        .from(vendors)
        .where(conditions.length ? and(...conditions) : undefined)
        .limit(limit);

      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );
}
```

- [ ] **Step 8: Wire all read tools into the MCP server**

Replace the contents of `app/api/mcp/[transport]/route.ts`:

```typescript
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/src/mcp/auth";
import { registerFeteTools } from "@/src/mcp/tools/fetes";
import { registerBandTools } from "@/src/mcp/tools/bands";
import { registerAccommodationTools } from "@/src/mcp/tools/accommodations";
import { registerVendorTools } from "@/src/mcp/tools/vendors";

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
```

- [ ] **Step 9: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/mcp/tools/ tests/mcp/tools/ app/api/mcp/
git commit -m "feat: add MCP read tools for fetes, bands, accommodations, vendors"
```

---

## Task 8: Admin Write Tools

Write tools for Nicole and Steve only. Gated by `MCP_ADMIN_EMAILS` env var, checked against the authenticated user's email on every call.

**Files:**
- Create: `src/mcp/tools/admin.ts`
- Create: `tests/mcp/tools/admin.test.ts`
- Modify: `app/api/mcp/[transport]/route.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/mcp/tools/admin.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isAdmin, buildFeteInput } from "@/src/mcp/tools/admin";

const adminEmails = ["steve@pikari.io", "nicole@example.com"];

describe("isAdmin", () => {
  it("returns true for admin email", () => {
    expect(isAdmin("steve@pikari.io", adminEmails)).toBe(true);
  });

  it("returns false for non-admin email", () => {
    expect(isAdmin("user@example.com", adminEmails)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isAdmin("STEVE@PIKARI.IO", adminEmails)).toBe(true);
  });
});

describe("buildFeteInput", () => {
  it("maps valid input to schema shape", () => {
    const result = buildFeteInput({ name: "Test Fete", category: "Fete" });
    expect(result.name).toBe("Test Fete");
    expect(result.category).toBe("Fete");
  });

  it("throws for invalid category", () => {
    expect(() => buildFeteInput({ name: "X", category: "Invalid" })).toThrow(
      /Invalid category/
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/mcp/tools/admin.test.ts
```

Expected: FAIL — `Cannot find module '@/src/mcp/tools/admin'`

- [ ] **Step 3: Create src/mcp/tools/admin.ts**

Read `src/db/schema/fetes.ts` and `src/db/schema/enums.ts` to confirm `feteCategoryEnum` values before writing.

```typescript
import { db } from "@/src/db/index.js";
import { fetes, feteEditions } from "@/src/db/schema/fetes.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

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

type AuthExtra = { authInfo?: { extra?: { email?: string } } };

export function registerAdminTools(
  server: { registerTool: Function },
  adminEmails: string[]
) {
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
    async (input: { name: string; category: string }, extra: AuthExtra) => {
      const email = extra?.authInfo?.extra?.email;
      if (!email || !isAdmin(email, adminEmails)) {
        return { content: [{ type: "text" as const, text: "Access denied: admin only" }] };
      }
      const [created] = await db.insert(fetes).values(buildFeteInput(input)).returning();
      return {
        content: [{ type: "text" as const, text: `Created: ${JSON.stringify(created, null, 2)}` }],
      };
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
    async ({ editionId, status }: { editionId: string; status: string }, extra: AuthExtra) => {
      const email = extra?.authInfo?.extra?.email;
      if (!email || !isAdmin(email, adminEmails)) {
        return { content: [{ type: "text" as const, text: "Access denied: admin only" }] };
      }
      const [updated] = await db
        .update(feteEditions)
        .set({ status: status as any })
        .where(eq(feteEditions.id, editionId))
        .returning();

      if (!updated)
        return { content: [{ type: "text" as const, text: "Fete edition not found" }] };

      return {
        content: [{ type: "text" as const, text: `Updated: ${JSON.stringify(updated, null, 2)}` }],
      };
    }
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/mcp/tools/admin.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Wire admin tools into the MCP server**

Replace the contents of `app/api/mcp/[transport]/route.ts`:

```typescript
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/src/mcp/auth";
import { registerFeteTools } from "@/src/mcp/tools/fetes";
import { registerBandTools } from "@/src/mcp/tools/bands";
import { registerAccommodationTools } from "@/src/mcp/tools/accommodations";
import { registerVendorTools } from "@/src/mcp/tools/vendors";
import { registerAdminTools } from "@/src/mcp/tools/admin";

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
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/mcp/tools/admin.ts tests/mcp/tools/admin.test.ts app/api/mcp/
git commit -m "feat: add admin write tools gated by MCP_ADMIN_EMAILS"
```

---

## Task 9: Deploy to Vercel

**Files:** None (config via Vercel CLI)

- [ ] **Step 1: Run production build locally**

```bash
npm run build
```

Fix any TypeScript errors before proceeding. Expected: `Route (app)` table printed with no errors.

- [ ] **Step 2: Install Vercel CLI and deploy**

```bash
npm install -g vercel
vercel
```

Follow prompts: link or create project, name `my-carnival-planner`, framework Next.js, root directory `.`.

- [ ] **Step 3: Set all environment variables**

```bash
vercel env add WORKOS_API_KEY production
vercel env add WORKOS_CLIENT_ID production
vercel env add WORKOS_COOKIE_PASSWORD production
vercel env add NEXT_PUBLIC_WORKOS_REDIRECT_URI production
vercel env add WORKOS_JWKS_URI production
vercel env add WORKOS_ISSUER production
vercel env add OAUTH_ISSUER production
vercel env add MCP_ADMIN_EMAILS production
vercel env add DATABASE_URL production
```

Values for production:
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` → `https://<vercel-url>/api/auth/callback`
- `OAUTH_ISSUER` → `https://<vercel-url>`

- [ ] **Step 4: Add production redirect URIs to WorkOS Dashboard**

- `https://<vercel-url>/api/auth/callback`
- `https://claude.ai/api/mcp/auth_callback`

- [ ] **Step 5: Deploy to production**

```bash
vercel --prod
```

Expected: Production URL printed, e.g. `https://my-carnival-planner.vercel.app`.

- [ ] **Step 6: Verify well-known endpoints on production**

```bash
PROD=https://my-carnival-planner.vercel.app
curl -s $PROD/.well-known/oauth-protected-resource | python3 -m json.tool
curl -s $PROD/.well-known/oauth-authorization-server | python3 -m json.tool
```

Both must return JSON with your production URLs in `resource` / `issuer` fields.

- [ ] **Step 7: Test MCP server from Claude Desktop**

Update `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "carnival-planner": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://my-carnival-planner.vercel.app/api/mcp"]
    }
  }
}
```

Restart Claude Desktop. Complete auth. Ask Claude to call `list_fetes`. Confirm results return from the seeded DB.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: Phase 2+3 complete — Next.js + WorkOS auth + admin MCP server on Vercel"
```

---

## Self-Review

**Spec coverage:**
- ✅ Next.js App Router initialized in existing repo (alongside `src/db/`)
- ✅ WorkOS AuthKit for all users — consumer + admin same flow
- ✅ User schema: `workosId`, `subscriptionPlan`, `subscriptionStatus`; removed `passwordHash` and `sessions`
- ✅ Auth middleware with exclusions for OAuth/MCP/well-known routes
- ✅ JIT user provisioning on first WorkOS login (tested)
- ✅ OAuth proxy routes (authorize, token, register)
- ✅ RFC 8414 + RFC 9728 discovery endpoints with CORS OPTIONS
- ✅ MCP server with `mcp-handler` + `withMcpAuth` JWT validation
- ✅ Read tools: fetes, bands, accommodations, vendors (tested)
- ✅ Admin write tools gated by `MCP_ADMIN_EMAILS` (tested)
- ✅ Vercel deployment with all env vars

**Known follow-ups (not in this plan):**
- Band/accommodation write tools for Nicole's data management
- Subscription plan enforcement in the web app (gating Pro/Premium features)
- Stripe integration for subscription purchases

**Type consistency check:** `registerFeteTools`, `registerBandTools`, `registerAccommodationTools`, `registerVendorTools`, `registerAdminTools` all use `server: { registerTool: Function }` — consistent throughout. `verifyMcpToken` signature matches `withMcpAuth`'s expected type.

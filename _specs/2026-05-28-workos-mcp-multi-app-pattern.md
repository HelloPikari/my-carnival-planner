# WorkOS Multi-App MCP Auth Pattern

**Date:** 2026-05-28  
**Status:** Resolved — root cause found, fix documented

---

## Root Cause of the `iss` Mismatch Bug

WorkOS pins the `iss` (issuer) claim in all JWTs **to the Default application's `client_id`**, across the entire environment. This is by design — see WorkOS Applications docs:

> "The `iss` claim is the same for all applications in the environment. It will reference the default application's client id."

**Our environment:**
- Default app: Pikari Todos MCP → `client_01KREFHFZRYWAB2CSZED2773VD`
- My Carnival Planer → `client_01KSH7ESPNVZEPY7BDGPGY7N9S`

**What was happening:** `WORKOS_ISSUER` was set to My Carnival Planer's client_id. Every token from WorkOS had `iss=client_01KREFHFZRYWAB2CSZED2773VD`. jose's `jwtVerify` rejected every token with "unexpected iss".

**Second failure mode:** WorkOS does not emit an `aud` claim by default. `jwtVerify` was passed `audience: process.env.WORKOS_CLIENT_ID`, which requires `aud` to be present. Every token would fail this check even after fixing the `iss` mismatch.

---

## The Correct Environment Variables

For any application in this WorkOS environment, `WORKOS_ISSUER` and `WORKOS_JWKS_URI` **always reference the Default app** (Pikari Todos MCP). `WORKOS_CLIENT_ID` is the only per-app value.

```bash
# Per-environment (same value across all apps in this WorkOS account)
WORKOS_ISSUER=client_01KREFHFZRYWAB2CSZED2773VD
# ⚠️ The iss claim in WorkOS JWTs is the bare client_id string, not a URL.
# Verify by decoding a real token: Buffer.from(token.split('.')[1], 'base64url').toString()
# and reading the 'iss' field. Use that exact string here.

WORKOS_JWKS_URI=https://api.workos.com/sso/jwks/client_01KREFHFZRYWAB2CSZED2773VD
# Use /sso/jwks/ (NOT /user_management/jwks/ — that 404s)
# Use the Default app's client_id

# Per-application (unique per app)
WORKOS_CLIENT_ID=client_01KSH7ESPNVZEPY7BDGPGY7N9S  # My Carnival Planer
WORKOS_API_KEY=sk_live_...                            # API key for this app
```

**For Vercel (My Carnival Planer):**
- Update `WORKOS_ISSUER` → `client_01KREFHFZRYWAB2CSZED2773VD`
- Update `WORKOS_JWKS_URI` → `https://api.workos.com/sso/jwks/client_01KREFHFZRYWAB2CSZED2773VD`
- `WORKOS_CLIENT_ID` stays as `client_01KSH7ESPNVZEPY7BDGPGY7N9S` ✓

---

## The Reusable Multi-App Pattern

Each MCP server in a new application needs its own deployment with:

| Variable | Value |
|---|---|
| `WORKOS_ISSUER` | Default app's `client_id` (bare string, no URL prefix) — **same for all apps** |
| `WORKOS_JWKS_URI` | `https://api.workos.com/sso/jwks/{default_client_id}` — **same for all apps** |
| `WORKOS_CLIENT_ID` | This app's `client_id` — **unique per app** |
| `WORKOS_API_KEY` | API key — environment-level credential; can share or use per-app |
| `OAUTH_ISSUER` | This app's public URL (e.g. `https://mycarnivalplanner.app`) — **unique per app** |

### Isolating app tokens via `client_id` claim

Since `iss` is environment-wide, a token issued by Pikari Todos MCP would pass signature and issuer validation on My Carnival Planer's MCP server. **The `client_id` claim is the only signal for which app issued the token.** This check is load-bearing:

```typescript
const { payload } = await jwtVerify(bearerToken, getJWKS(), {
  algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
  issuer: process.env.WORKOS_ISSUER,
  // NO audience check — WorkOS doesn't emit aud by default
});

// Reject tokens issued for a different application
if (payload.client_id !== process.env.WORKOS_CLIENT_ID) {
  console.error("[MCP auth] token client_id mismatch:", payload.client_id, "expected:", process.env.WORKOS_CLIENT_ID);
  return undefined;
}
```

---

## What "Default" Application Means in WorkOS

- Created automatically when the environment is set up
- Used for IdP-initiated SSO and Dashboard-sent invitations
- **Serves as the canonical JWT issuer for the entire environment**
- There is exactly one Default app per environment; you can change which app is Default in the Dashboard

**Implication:** The Default app's client_id is a shared infrastructure identifier. Changing which app is Default would change `iss` for all tokens across the environment — don't do this casually.

---

## Key Gotchas (update `workos-mcp-auth.md`)

1. **`WORKOS_ISSUER` must use the Default app's `client_id`**, not the current app's. Every app in the environment shares the same `iss`.
2. **WorkOS does not emit `aud` by default.** Do not pass `audience` to `jwtVerify` unless you have a JWT Template configured that adds it.
3. **Use the `client_id` JWT claim to distinguish which app a token was issued for.** This is the per-app isolation boundary.
4. **`WORKOS_JWKS_URI` uses `/sso/jwks/`** (not `/user_management/jwks/` — 404s). Use Default app's client_id in the path.
5. **The `iss` claim is the bare client_id string**, not a URL. The format `https://api.workos.com/user_management/<client-id>` appears in some docs but does not match the actual JWT payload on this account.

---

## Files Changed

- `src/mcp/auth.ts` — removed `audience` check, added `client_id` claim check
- `app/api/oauth/token/route.ts` — removed incorrect `invalid_grant` issuer rejection
- Vercel: `WORKOS_ISSUER`, `WORKOS_JWKS_URI` updated to Default app's client_id

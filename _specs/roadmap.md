# My Carnival Planner — Roadmap
**Last updated:** 2026-06-24
**Updated by:** Session — Phase 4.7 (2027 fete seed, local + prod) + publish-status fix

## Phase 1: Foundation ✓
> Data layer complete.

- [x] Design database schema (all entities, relationships, conventions decided)
- [x] Explore Nicole's Airtable data to ground schema in real data
- [x] Set up project structure (CLAUDE.md, roadmap, session logging, memory)
- [x] Visually diagram full schema for review
- [x] Write Drizzle schema files for all tables (31 tables across 9 domain groups)
- [x] Set up local Postgres via Docker
- [x] Run Drizzle migrations to create all tables
- [x] Write seed script (two-stage: extract from Airtable → load from local JSON)
- [x] Set up Postgres MCP connector for live querying in sessions
- [x] Run test queries to validate relationships and key user questions (7/7 passing)
- [x] Run Airtable extract to populate local JSON with Nicole's data (20 tables, ~1,900 records)
- [x] Verify load stage with real data

## Phase 2+3: Next.js + Auth + Admin MCP Server ✓
> Next.js App Router, WorkOS auth, admin MCP server, and production deploy — complete.

- [x] Convert repo to Next.js 15 (App Router) alongside existing Drizzle schema
- [x] WorkOS AuthKit integration (middleware, callback route, AuthKitProvider)
- [x] Update user schema: `workosId`, `subscriptionPlan` (free/pro/premium), `subscriptionStatus`; dropped `passwordHash`, `sessions`, `roles`
- [x] Run Drizzle migration (applied manually via psql)
- [x] JIT user provisioning on first WorkOS login (`src/mcp/provision.ts`)
- [x] OAuth proxy routes: `api/oauth/authorize`, `api/oauth/token`, `api/oauth/register`
- [x] RFC 8414 + RFC 9728 well-known discovery endpoints (with CORS)
- [x] MCP server with WorkOS JWT auth (`withMcpAuth`, JWKS validation, audience check)
- [x] MCP read tools: list_fetes, get_fete, list_bands, get_band, list_accommodations, get_accommodation, list_vendors, get_vendor
- [x] Admin write tools: create_fete, update_fete_edition_status (gated by MCP_ADMIN_EMAILS)
- [x] Deploy to Vercel — production at https://mycarnivalplanner.app
- [x] Production Postgres on DigitalOcean droplet, secured via nginx TCP proxy + Postgres SSL
- [x] Test MCP server end-to-end with Claude Desktop + mcp-remote
- [ ] MCP tool call logging — who called what tool, when, with what args (usage tracking + admin audit trail)

## Phase 4: Consumer Web App
> The self-planning experience for trip-goers.

- [ ] Browse listings (fetes, bands, accommodations) — Free tier, limited content
- [ ] Auth/signup flow (WorkOS AuthKit hosted UI)
- [ ] Subscription purchase and plan management (Stripe)
- [ ] Content + feature gating by tier (Free / Pro / Premium)
- [ ] Fete and band detail pages (Pro: full pricing, availability)
- [ ] Itinerary builder — Pro
- [ ] Trip creation and group coordination — Pro
- [ ] Review submission
- [ ] Image upload pipeline (storage + CDN)

## Phase 4.5: Context-Aware MCP ✓
> Stateful MCP server so the LLM can guide users through planning without hallucinating or losing context between sessions. Shipped 2026-06-09.

**Data foundation:**
- [x] Update accommodation seed to include amenities, safety/walkability/location ratings, minimum stay
- [x] Re-seed accommodations locally with updated data
- [x] Add `arrival_date`, `departure_date`, `party_size`, `budget_usd` columns to `trips` table

**New MCP tools:**
- [x] `get_carnival_seasons` — returns non-archived seasons with computed Carnival Monday
- [x] `create_trip` — single-transaction trip + tripMember(role=organizer) creation; gathers 4 required fields conversationally
- [x] `get_my_context` — returns active trip + `totalBudgetUsd` + missing gated fields; distinct responses for `no_active_trip` / `ambiguous`
- [x] `update_trip_context` — partial update; typed cols for queryable fields, JSONB metadata merge for soft prefs

**Enhanced existing tools:**
- [x] `list_fetes` — gated on `arrival_date`/`departure_date`; filters editions by attendance window; includes `daysFromCarnivalMonday`
- [x] `list_accommodations` — hard filter by party-size room availability; ranked by Nicole's planner rating; surfaces total budget
- [x] `list_bands` — bands with theme for this season first, then party-size category preference
- [x] Active trip auto-resolution — `resolveActiveTrip()` helper; ambiguous when top two tie on (season year, arrival_date)

**Carnival math:**
- [x] `carnivalMonday(year)` — Meeus/Jones/Butcher Easter algorithm, Carnival Monday = Easter − 48 days; vitest covering 2024-2027

**Admin behavior:**
- [x] `MCP_ADMIN_EMAILS` bypasses missing-context / no-trip gates; response carries `is_admin: true`

**Known follow-ups (not in this phase):**
- Itinerary spend subtraction — turn `totalBudgetUsd` into a true `remainingBudgetUsd` once we have a `create_itinerary_item` tool
- Per-trip arrival-date cutoff in resolver (only fires when the season has ended)
- End-to-end MCP handler tests (current coverage is query-level)

## Phase 4.6: Steering Pass
> Apply closed-loop steering (see [_specs/mcp-design-principles.md](mcp-design-principles.md)) across all MCP tool responses. Every empty/error/edge response must carry `status`, payload, and explicit `guidance` for the LLM. Triggered by 2026-06-09 production observation: `get_carnival_seasons` returned `[]` and the LLM hallucinated from training data.

- [x] `get_carnival_seasons` — `no_upcoming_seasons` envelope with guidance (PR #12)
- [ ] `list_fetes` — wrap empty fetes array with status + guidance (no editions in window)
- [ ] `list_accommodations` — wrap empty results, especially the "no rooms fit party" early return
- [ ] `list_bands` — wrap empty results
- [ ] `get_fete` / `get_band` / `get_accommodation` — wrap not-found responses with guidance
- [ ] `create_trip` — wrap validation failures with guidance on what to gather
- [ ] Audit `update_trip_context` and `get_my_context` for envelope consistency
- [ ] Audit tool descriptions for explicit state-handling instructions

## Phase 4.7: 2027 Season Seed (Trinidad) — fetes ✓ (2026-06-24)
> Extract and seed 2027 Trinidad Carnival data from Nicole's Airtable. Fetes done; bands have no 2027 source data yet.

- [x] Add 2027 to `seedStatic` carnival_seasons (Carnival Monday 2027-02-08 via utility; status active)
- [x] Extract 2027 fete editions from Airtable (107 editions appended to `data/airtable/fetes-by-year.json`)
- [x] Update `loadFetes` to include 2027 alongside 2025/2026 (+ `index.ts` wires `s2027`)
- [x] Re-seed local — 2025 (58) / 2026 (105) / 2027 (107) editions; 2025/2026 retained for testing
- [x] Re-seed prod with 2027 data — **additive** (insert-only, idempotent; no drop). Live users/trips untouched.
- [x] Update `loadBands` to accept 2027 (type + year→season map) — but see follow-up bug below: theme year detection is broken upstream, so this path is currently inert
- [ ] Extract 2027 band themes + sections — **blocked: not in Airtable yet** (Costumes base Theme table stops at 2026)

**Follow-up bugs (code review 2026-06-25 — deferred to a separate PR):**
- **Timezone window drops boundary fetes** (`src/mcp/tools/fetes.ts`, `queryFetesForTrip`). The attendance
  window is built in UTC (`${departureDate}T23:59:59Z`) but fetes are Trinidad time (AST, UTC−4); a late-night
  fete on a trip's first/last day falls outside the UTC window and is silently dropped. Fix: build the window in
  AST. Affects all seasons.
- **`loadBands` files every theme under 2026.** The theme year is read as a plain array, but the year-lookup
  field is the `{linkedRecordIds, valuesByLinkedRecordId}` object shape (same shape `loadFetes` already handles),
  so `year` is always undefined → defaults to `s2026`. Verified: all 28 themes land in 2026 regardless of real
  year (2020–2026). Fix: reuse `loadFetes`' year parser + add a year guard. **Also needs a prod band-data
  correction** (prod has the same bug). Do NOT just add a guard without fixing detection — it would skip all themes.

**Publish-status fix (found during verification):** `load.ts` mapped only `"Confirmed"/"Active"` → `published`,
but real Airtable statuses are `"Released" / "Not Announced Yet" / "Announced -- Not Released"` → every edition
was `draft`, so `list_fetes` (trip path, requires `published`) returned nothing for any season. Added `"Released"` →
`published`. After re-seed: 2025 = 55 published, 2026 = 42 published, 2027 = 0 (none released yet — correct).
Applied to prod via the additive script (97 existing editions updated). Admin path (`queryFetes`, master table)
masked this since it never hits the edition status filter.

**Data quality notes for Nicole (2027 fete editions):**
- "Xperience" has start `2027-10-27` (8 months after Carnival) — almost certainly a date typo.
- "FOC Carnival" `2026-12-17` and "Zèle Cooler" `2027-01-03` fall just outside the Carnival window — verify.
- All 107 2027 fetes are `Not Announced Yet` (no prices/tickets yet) — expected this far out; they'll surface in
  `list_fetes` as Nicole flips statuses to `Released`.

## Phase 4.8: Visual elements via MCP (scoping)
> Use MCP's richer-than-text content (image blocks, resources, MCP Apps) to render state that's harder for the LLM to paper over. The text steering envelope (Phase 4.6) is the prompt-level guardrail; visual elements would be the UX-level guardrail layered on top. Idea origin: production session 2026-06-09 — even with steering text, the LLM still tried to be helpful around the "no data" case.

**Goal of this phase: scope, don't ship.** Decide what gets a visual treatment, what stays text, and what the host-support story looks like.

- [ ] Audit current MCP host UI render capabilities (Claude Desktop first; later: web, IDE clients)
- [ ] Verify MCP spec direction for server-rendered UI (resources, Apps, structured content) — what's stable, what's still proposal
- [ ] Pick the highest-value states for visual treatment. Strong candidates:
   - "No data available" cards (current empty-state hallucination case)
   - Persistent "active trip context" card (dates, party size, budget always visible)
   - Comparison cards (band vs band, accommodation vs accommodation)
   - "Missing context" prompts as visual forms instead of conversational asks
- [ ] Define the fallback contract — every tool response must still work in text-only hosts; visual is **additive**, never a replacement
- [ ] Decide whether visuals live in tool responses, separate `resources`, or both
- [ ] Spec document: data model for each visual element, render expectations per host, graceful degradation

## Phase 4.9: Premium MCP Access Gating
> Make the MCP server a real Premium-only paid feature. Spec: [_specs/2026-06-10-premium-mcp-access-entitlements.md](2026-06-10-premium-mcp-access-entitlements.md)
>
> **Sequencing:** NOT the immediate next task. This is a prerequisite for opening public signups (Phase 4) and exposing MCP as the paid product (Phase 5) — flip the gate on just before the public arrives, not before the product is ready. Today the MCP server is only used by admins, so the current "free = active" gap leaks nothing yet. Recommended next work is Phase 4.6 (Steering Pass), optionally with MCP tool-call logging, to make the product worth paying for first.

- [ ] Stripe: Premium product + price + `mcp_access` Entitlement Feature
- [ ] WorkOS: connect Stripe via Stripe Connect; confirm `entitlements` claim carries `mcp_access` (verify claim shape from a live token)
- [ ] `src/mcp/auth.ts`: gate on `entitlements ∋ mcp_access`; admin emails bypass; distinguishable `not_entitled` log
- [ ] `src/mcp/provision.ts`: provisioning no longer implies access; subscriptionPlan/Status become dormant
- [ ] Web app: AuthKit hosted signup + "Upgrade to Premium" → Stripe Checkout + billing-portal link
- [ ] Regression test: reject foreign `client_id` token (boundary already in `auth.ts:30`)
- [ ] Unit tests: grant with entitlement, deny without, deny cross-app, admin bypass

## Phase 5: Premium AI Features
> The MCP server as an end-user product. Gated by Phase 4.9.

- [ ] Expose MCP server to Premium tier users (scoped read-only tools)
- [ ] AI trip planning tools: "build me a fete schedule", "compare band sections"
- [ ] Itinerary generation and conflict detection via AI

## Phase 6: Commerce
> Revenue beyond subscriptions.

- [ ] Vendor self-management portal (claim/edit profiles)
- [ ] Marketplace: fete ticket purchasing through platform
- [ ] Marketplace: band costume purchasing through platform
- [ ] Commission/platform fee on transactions
- [ ] Vendor deals and affiliate link system
- [ ] Exclusive discount codes for paid members

## Future / Backlog

- [ ] Multi-carnival expansion (Notting Hill, Rio, etc.)
- [ ] Automated yearly data ingestion
- [ ] Carnival persona quiz driving recommendations
- [ ] Roommate matching (Nicole has Airtable base for this)
- [ ] Transportation management
- [ ] Concierge tier (video call, WhatsApp with planner)
- [ ] Vendor analytics dashboard
- [ ] Social proof tagging ("liked by first-timers")

---

## Notes
- Trinidad Carnival is the sole focus until the platform is validated.
- "Ship small, iterate fast" — every phase should produce something usable.
- Stack: Next.js (App Router) on Vercel, Drizzle + Postgres on DigitalOcean, WorkOS auth.

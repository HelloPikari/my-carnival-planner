# My Carnival Planner — Roadmap
**Last updated:** 2026-06-09
**Updated by:** Phase 4.5 implementation session (with 4.6 + 4.7 follow-ups from production testing)

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

## Phase 4.7: 2027 Season Seed (Trinidad)
> Extract and seed 2027 Trinidad Carnival data from Nicole's Airtable.

- [ ] Add 2027 to `seedStatic` carnival_seasons (Carnival Monday computed from utility)
- [ ] Extract 2027 fete editions from Airtable (run `db:extract`)
- [ ] Update `loadFetes` to include 2027 alongside 2025/2026
- [ ] Extract 2027 band themes + sections from Airtable
- [ ] Update `loadBands` to include 2027
- [ ] Re-seed prod with 2027 data

## Phase 5: Premium AI Features
> The MCP server as an end-user product.

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

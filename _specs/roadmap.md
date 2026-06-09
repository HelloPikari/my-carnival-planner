# My Carnival Planner — Roadmap
**Last updated:** 2026-06-09
**Updated by:** MCP context-awareness design session

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

## Phase 4.5: Context-Aware MCP (next up)
> Make the MCP server stateful so the LLM can guide users through planning without hallucinating or losing context between sessions. Decisions from 2026-06-09 design session.

**Data foundation (do first, one session):**
- [x] Update accommodation seed to include amenities, safety/walkability/location ratings, minimum stay
- [ ] Re-seed accommodations locally with updated data
- [ ] Add `arrival_date`, `departure_date`, `party_size`, `budget_usd` columns to `trips` table (migration)

**New MCP tools:**
- [ ] `get_carnival_seasons` — returns available seasons so LLM can present options at trip creation
- [ ] `create_trip` — creates trip + sets 4 required context fields in one call; LLM does intake conversationally
- [ ] `get_my_context` — returns active trip context (profile fields + computed remaining budget), lists missing required fields
- [ ] `update_trip_context` — partial update of any context fields (typed columns for server-queryable fields, JSONB metadata for soft preferences)

**Enhanced existing tools:**
- [ ] `list_fetes` — check user's active trip; if `arrival_date`/`departure_date` missing, return `{status: "missing_context", required: [...]}` instead of data; filter by attendance window when present; include `daysBeforeCarnivalMonday` computed field in responses
- [ ] `list_accommodations` — skew results by `budget_usd` (remaining) and `party_size` when available
- [ ] `list_bands` — skew results by `party_size` when available
- [ ] Active trip auto-resolution — server selects most upcoming incomplete trip; returns "ambiguous" response if multiple

**Key design decisions (from grill-me 2026-06-09):**
- Only `arrival_date`/`departure_date` are server-enforced (gate tool responses); other fields are LLM-enforced via tool descriptions
- `budget_usd` is a raw number; remaining = `budget_usd - SUM(confirmed itinerary item costs)`; LLM reasons about fit, server skews ranking
- `party_size` is a real column (server skews band recommendations); soft preferences go in JSONB `metadata`
- Carnival Monday is computed from year (calendar math), not stored — utility function, not a DB column
- LLM can create trips directly (no web form required); trip creation = `carnival_season_id` + name + 4 required fields
- Tool descriptions must state: "gather arrival_date, departure_date, party_size, budget_usd before calling planning tools"

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

# My Carnival Planner — Roadmap
**Last updated:** 2026-05-27
**Updated by:** Deployment + infrastructure session

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
- [ ] Test MCP server end-to-end with Claude Desktop + mcp-remote
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

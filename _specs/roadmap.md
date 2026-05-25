# My Carnival Planner — Roadmap
**Last updated:** 2026-05-25
**Updated by:** Architecture rethink session

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

## Phase 2: Next.js + Auth (Current)
> Convert to Next.js, wire up WorkOS auth, establish the user model.

- [ ] Convert repo to Next.js (App Router) — add alongside existing Drizzle schema
- [ ] WorkOS AuthKit integration for all users (consumers + admin)
- [ ] Update user schema: add `workosId`, `subscriptionPlan` (free/pro/premium), `subscriptionStatus`; remove `passwordHash` and `sessions` table
- [ ] Run Drizzle migration for schema changes
- [ ] Auth middleware: protect routes by tier
- [ ] Admin role flag for Steve + Nicole (domain-locked via WorkOS org)

## Phase 3: Admin MCP Server
> Steve and Nicole manage content through an AI interface.

- [ ] Set up mcp-handler in Next.js API route
- [ ] WorkOS JWT validation (`withMcpAuth`)
- [ ] OAuth proxy routes: `/oauth/authorize`, `/oauth/token`, `/oauth/register`
- [ ] `/.well-known/oauth-protected-resource` and `oauth-authorization-server` endpoints
- [ ] Read tools: fetes, bands, accommodations, vendors, reviews
- [ ] Write tools: create/update/delete records (admin only)
- [ ] JIT user provisioning on first WorkOS login
- [ ] Deploy to Vercel

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

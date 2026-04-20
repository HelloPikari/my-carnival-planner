# My Carnival Planner — Roadmap
**Last updated:** 2026-04-06
**Updated by:** Schema Diagram Review Session

## Phase 1: Foundation (Current)
> Get the data layer solid. Everything else builds on this.

- [x] Design database schema (all entities, relationships, conventions decided)
- [x] Explore Nicole's Airtable data to ground schema in real data
- [x] Set up project structure (CLAUDE.md, roadmap, session logging, memory)
- [x] Visually diagram full schema for review
- [ ] Initialize Node.js project (TypeScript, Drizzle, Hono, Postgres dependencies)
- [ ] Write Drizzle schema files for all tables
- [ ] Set up local Postgres via Docker
- [ ] Run Drizzle migrations to create all tables
- [ ] Write seed script (pull from Nicole's Airtable, map to our schema, insert)
- [ ] Set up Postgres MCP connector for live querying in sessions
- [ ] Run test queries to validate relationships and key user questions
- [ ] Set up Hono API project structure
- [ ] Auth system (users, sessions, roles) in API layer
- [ ] Basic CRUD endpoints for core entities

## Phase 2: MVP API
> A working API that can serve data to any consumer.

- [ ] Full REST API for all core entities (carnivals, fetes, bands, accommodations)
- [ ] Fete/band edition management (create new carnival season, roll forward)
- [ ] Review submission and moderation workflow
- [ ] Favorites system
- [ ] Location-based queries ("what's near me")
- [ ] Image upload pipeline (DO Spaces + processing service)
- [ ] Subscription plans and user subscription management
- [ ] Content gating based on plan entitlements

## Phase 3: Trip Planning
> The collaborative planning experience that differentiates the product.

- [ ] Trip creation and member invitation
- [ ] Per-member itineraries with platform + custom items
- [ ] Coordinator role (view/edit all member itineraries)
- [ ] Itinerary conflict detection (overlapping events)
- [ ] Cost rollup per person / per trip
- [ ] Item status tracking (interested → booked → paid → confirmed)

## Phase 4: Frontend
> Visual layer on top of the API for "legacy users" (Nicole's term via Steve).

- [ ] Framework selection (Next.js or similar)
- [ ] Browse listings (fetes, bands, accommodations) — no account required
- [ ] User registration and login
- [ ] Favorites and itinerary builder UI
- [ ] Review submission UI
- [ ] Subscription purchase flow
- [ ] Nicole/admin interface for data management

## Phase 5: Commerce
> Revenue beyond subscriptions.

- [ ] Vendor self-management portal (claim/edit profiles)
- [ ] Marketplace: fete ticket purchasing through platform
- [ ] Marketplace: band costume purchasing through platform
- [ ] Commission/platform fee on transactions
- [ ] Vendor deals and affiliate link system
- [ ] Exclusive discount codes for paid members

## Phase 6: MCP Server
> The long-term play — data as a service for AI assistants.

- [ ] MCP (Model Context Protocol) server exposing carnival planning data
- [ ] Paid access model for MCP server consumers
- [ ] User's personal AI assistant can query fetes, bands, accommodations, build itineraries

## Future / Backlog
> Ideas captured but not yet prioritized.

- [ ] Multi-carnival expansion (Notting Hill, Rio, etc.) — schema supports it, need local data + people
- [ ] Automated yearly data ingestion (scraping/collection service for new carnival seasons)
- [ ] Carnival persona quiz ("what kind of carnival person are you") driving recommendations
- [ ] Roommate matching (Nicole has an Airtable base for this already)
- [ ] Transportation management
- [ ] Concierge tier with direct planner access (video call, WhatsApp)
- [ ] Vendor analytics dashboard (how many views, favorites, conversions)
- [ ] Social proof / "liked by first-timers" tagging based on user demographics
- [ ] Nicole's internal operations migration (client management, invoicing — separate from public platform)

---

## Notes
- This roadmap is a living document. Agents should review it at session start and update it when new requirements surface.
- Phases are sequential in priority but may overlap in execution.
- Trinidad Carnival is the sole focus until the platform is validated.
- "Ship small, iterate fast" — every phase should produce something usable.

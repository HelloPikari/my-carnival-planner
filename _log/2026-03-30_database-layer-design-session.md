# Session: Database Layer Design
**Date:** 2026-03-30
**Participants:** Steve + Claude
**Method:** Grill Me skill -- systematic interrogation of all database design decisions

## Context
Brand new project. Reviewed transcript from 2026-03-27 planning session with Nicole Phillips (domain expert, runs We Plan Your Jam). This session focused entirely on resolving database layer decisions before writing any code.

## What Happened

### Transcript Review
- Read the full 2026-03-27 planning session transcript between Steve and Nicole
- Extracted core product vision, user problems, revenue model, and technical direction
- Saved key context to project memory files

### Database Design Decisions (20 questions resolved)
Systematically worked through every structural decision for the database layer using the Grill Me skill. All decisions documented below.

### Airtable Exploration
- Connected to Nicole's Airtable via MCP tools
- Explored three core bases: Events, Costumes, Accommodations
- Mapped her existing data structures to our schema design
- Identified improvements over her current structure (separated trips vs carnival seasons, consolidated locations, unified vendors)

### Project Infrastructure
- Created CLAUDE.md with full project guidance (tech stack, session logging, specs, experiments, principles)
- Created roadmap at `_specs/roadmap.md`
- Set up memory files for project context and workflow preferences

## Decisions Made

### Infrastructure Stack
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | PostgreSQL | Relational data with clear entity relationships; JSONB for flexibility |
| ORM | Drizzle | Type-safe, SQL-like, no abstraction bloat; agents write better SQL than ORM code |
| Runtime | Node.js | Standard, stable |
| API Framework | Hono | TypeScript-native, typed routes + validation; better agent experience than Express |
| Architecture | Standalone API | API is the product; frontends and MCP server are consumers |
| Image Storage | DigitalOcean Spaces + CDN | S3-compatible, image processing service for on-demand derivatives |
| Auth | API-layer sessions in Postgres | No external auth service; frontends are just API consumers |
| Hosting | DigitalOcean | Simple, sufficient for 10K-100K users |

### Schema Conventions (all tables)
- `created_at`, `updated_at`, `deleted_at` (soft deletes everywhere)
- `created_by`, `updated_by` (FK to users)
- JSONB `metadata` column as escape hatch where type-specific flexibility is needed
- Pricing: store original currency + currency code + USD snapshot for comparison + pricing strategy (passthrough/markup/fixed) for display price control

### Schema Entities

**Core Domain:**
- `carnivals` — top-level (Trinidad Carnival, Notting Hill, etc.)
- `carnival_seasons` — yearly instance (FK to carnival, year, start/end dates, status: planning|active|archived)
- `locations` — first-class normalized table (name, address, city, country, lat/long, type, metadata JSONB)

**Fetes:**
- `fetes` — master entity (name, organizer, category, venue type, description)
- `fete_editions` — yearly iteration (FK to fete + carnival_season, dates, status, pricing)
- `tickets` — ticket tiers per fete edition (admission type, price, currency, pricing strategy)

**Bands:**
- `bands` — master entity (name, category, size, demographic, costume style)
- `band_themes` — yearly theme (FK to band + carnival_season, name, description, pricing)
- `band_sections` — sections within a theme (name, description, designer, colors, photos)
- `costumes` — individual costume types within section (type: male/female/frontline/backline, pricing, add-ons)

**Accommodations:**
- `accommodations` — master entity (name, type, star rating, amenities, planner ratings)
- `room_types` — room options per accommodation (occupancy, description, images)
- Schema supports structured/filterable detail with MVP behavior of linking out to book

**Vendors:**
- `vendors` — unified table with JSONB metadata for type-specific attributes
- Single vendor profile regardless of type (organizer, band, hotel, designer)
- Links to user account for future self-management

**Users & Auth:**
- `users` — single table for all user types
- `roles` + `user_roles` — RBAC
- Auth sessions stored in Postgres

**Reviews:**
- Separate review tables per entity type (different rating dimensions per type)
- Multi-dimensional ratings + headline + body text + user photos
- Moderation workflow: pending → approved → flagged → rejected
- Gated behind event date having passed

**Favorites:**
- Single polymorphic table (user_id, favoritable_type, favoritable_id)

**Trip Planning:**
- `trips` — group trip entity
- `trip_members` — participants + roles (organizer/member)
- `itineraries` — one per member per trip
- `itinerary_items` — platform entity references OR freeform custom items (any user-defined content)

**Commerce:**
- `subscription_plans` → `user_subscriptions` → `plan_entitlements` (content gating by tier)
- `orders` → `order_items` (stubbed for future marketplace with platform commission)

**Media:**
- `images` — polymorphic, stores original references only
- Derivatives handled by image processing service (Imgproxy or similar)

### Out of Scope
- Content/guides/blog (separate concern, separate storage)
- Messaging/group chat
- Nicole's internal operations (client management, reservations, invoicing)
- AI chat/recommendations
- Notifications
- Analytics/tracking

## Key Decisions and Why

1. **Drizzle over Prisma** — Agents write better SQL-like code than ORM-abstracted code. No binary engine overhead.
2. **Hono over Express** — TypeScript-native with typed routes. Agent experience over developer familiarity.
3. **Standalone API over full-stack framework** — The API is the product. Decouples from any frontend choice.
4. **Separate review tables per entity** — Different rating dimensions per entity type. Type safety over DRY.
5. **Single favorites table** — A favorite is just a boolean relationship. No entity-specific columns needed.
6. **Unified vendors with JSONB** — Flexibility without EAV performance pain. Same pattern as carnival-specific metadata.
7. **Soft deletes everywhere** — Nicole needs historical data. Manual cleanup later if needed.
8. **carnival_seasons as anchor** — Everything hangs off a season, not a raw year integer. Supports variable dates across carnivals.
9. **Pricing strategy per item** — passthrough/markup/fixed gives Nicole business control over displayed prices.
10. **Itinerary supports custom items** — It's a real trip plan, not just a filtered list of platform content.

## Files Changed
- `CLAUDE.md` — Full project guidance (tech stack, session logging, specs, experiments, principles)
- `_specs/roadmap.md` — Living roadmap organized by phase
- `_log/2026-03-30_database-layer-design-session.md` — This file
- `.claude/memory/user_nicole.md` — Nicole's profile and role
- `.claude/memory/project_mcp_overview.md` — Project context from planning session
- `.claude/memory/feedback_memory_location.md` — Store memory in project folder preference
- `.claude/memory/feedback_session_workflow.md` — Session logging workflow preference
- `.claude/memory/feedback_agent_approach.md` — Agent-first development mindset
- `.claude/memory/MEMORY.md` — Memory index

## What's Next
1. **Visually diagram the full schema** — Steve wants to inspect table relationships together before writing code
2. **Write Drizzle schema files** — Translate all decisions into actual TypeScript schema definitions
3. **Set up project structure** — Initialize Node.js project, install Drizzle + Hono + Postgres dependencies
4. **Seed with mock data** — Pull from Nicole's Airtable to populate the database
5. **Run test queries** — Validate that the schema supports the key user questions (e.g., "fetes near my hotel under $100 USD", "all frontline costumes across bands", "my group's itinerary for Saturday")

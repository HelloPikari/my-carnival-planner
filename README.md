# My Carnival Planner

API backend for planning trips to Trinidad Carnival (and eventually other carnivals). Consolidates fete listings, band/costume info, accommodations, reviews, and group trip coordination into a single platform.

## Prerequisites

- Node.js 20+
- Docker (for local Postgres)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Default .env works with the Docker Postgres below — no edits needed

# 3. Start Postgres
docker compose up -d

# 4. Run migrations (creates all tables)
npm run db:migrate

# 5. Seed the database
npm run db:seed
```

The API is now ready for development. The seed populates static data (Trinidad Carnival, seasons, roles, subscription plans) plus any Airtable data that has been extracted locally.

## Database Commands

| Command | What it does |
|---------|------|
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly (skips migration files — dev only) |
| `npm run db:generate` | Generate migration SQL from schema changes |
| `npm run db:seed` | Seed database (static + local JSON data) |
| `npm run db:extract` | Pull fresh data from Airtable → local JSON (run once) |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |

## Seeding

The seed system has two stages:

### Stage 1: Extract (Airtable → local JSON)

Pulls records from Nicole's Airtable bases and saves them as JSON in `data/airtable/`. This only needs to run once — or again when her Airtable data changes.

```bash
npm run db:extract
```

This is designed to run in a Claude session with Airtable MCP tools available. The extracted JSON files are gitignored (they're generated artifacts).

### Stage 2: Load (local JSON → database)

Reads the local JSON files, transforms them to match our schema, and inserts into Postgres. This is fully repeatable with no network dependency.

```bash
npm run db:seed
```

This runs both static seed (roles, carnival, seasons, plans) and the Airtable data load. If no JSON files exist yet, it gracefully skips the Airtable portion.

## Resetting the Database

To wipe everything and start fresh:

```bash
# Drop and recreate the database
docker compose exec postgres psql -U mcp -c "DROP DATABASE carnival_planner"
docker compose exec postgres psql -U mcp -c "CREATE DATABASE carnival_planner"

# Re-apply migrations and re-seed
npm run db:migrate
npm run db:seed
```

Or for a quick schema-only reset (no migration history):

```bash
npm run db:push
npm run db:seed
```

Note: `db:push` overwrites the schema directly without tracking migration history. Fine for local dev, don't use in production.

## Running Tests

```bash
npm test          # Run once
npm run test:watch  # Watch mode
```

Tests run against the local Postgres database — they expect it to be running and seeded.

## Project Structure

```
src/
├── db/
│   ├── index.ts          # Drizzle client
│   ├── schema/           # Table definitions (one file per domain group)
│   └── seed/
│       ├── index.ts      # Seed orchestrator
│       ├── extract.ts    # Stage 1: Airtable → JSON
│       ├── load.ts       # Stage 2: JSON → DB
│       └── static.ts     # Static seed data
data/
└── airtable/             # Extracted JSON (gitignored)
drizzle/                  # Generated migration SQL
tests/                    # Validation queries
```

## Tech Stack

- **Database:** PostgreSQL 16
- **ORM:** Drizzle (type-safe, SQL-like)
- **Runtime:** Node.js with TypeScript
- **API:** Hono (not yet implemented — Phase 2)

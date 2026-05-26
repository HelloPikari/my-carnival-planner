# My Carnival Planner

Platform for planning trips to Trinidad Carnival (and eventually other carnivals). Consolidates fete listings, band/costume info, accommodations, reviews, and group trip coordination into a single planning tool.

Built on Next.js 15 (App Router), WorkOS authentication, and an authenticated MCP server for content management.

## Prerequisites

- Node.js 22.11+
- Docker (for local Postgres)
- WorkOS account (for auth)

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in your WorkOS credentials (see .env.example for all required vars)

# 3. Start Postgres
docker compose up -d

# 4. Run migrations
npm run db:migrate

# 5. Seed the database
npm run db:seed

# 6. Start the dev server
npm run dev
```

Visit `http://localhost:3000`. Sign in with your WorkOS credentials.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. Required:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string |
| `WORKOS_CLIENT_ID` | From WorkOS Dashboard |
| `WORKOS_API_KEY` | From WorkOS Dashboard (server-side only — never expose to client) |
| `WORKOS_COOKIE_PASSWORD` | 32+ char random string: `openssl rand -base64 32` |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | `http://localhost:3000/api/auth/callback` in dev |
| `WORKOS_JWKS_URI` | `https://api.workos.com/sso/jwks/<client-id>` |
| `WORKOS_ISSUER` | `https://api.workos.com/user_management/<client-id>` |
| `OAUTH_ISSUER` | `http://localhost:3000` in dev |
| `MCP_ADMIN_EMAILS` | Comma-separated admin emails (e.g. `steve@pikari.io,nicole@...`) |

> **Note:** `WORKOS_API_KEY` is server-side only. It is never sent to the browser.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm test` | Run test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:generate` | Generate migration SQL from schema changes |
| `npm run db:push` | Push schema directly (dev only — skips migration history) |
| `npm run db:seed` | Seed database (static data + Airtable JSON) |
| `npm run db:extract` | Pull fresh data from Airtable → local JSON |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |

## MCP Server

The app exposes an authenticated MCP server at `/api/mcp` for content management.

### Connecting locally (Claude Desktop)

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

Start `npm run dev`, restart Claude Desktop, and complete the auth flow when prompted.

### Available tools

**Read (all authenticated users):**
- `list_fetes` / `get_fete` — search and browse fetes with editions
- `list_bands` / `get_band` — bands with themes and sections
- `list_accommodations` / `get_accommodation` — accommodations with room types
- `list_vendors` / `get_vendor` — vendors filtered by type

**Write (admin only — `MCP_ADMIN_EMAILS`):**
- `create_fete` — create a new fete master record
- `update_fete_edition_status` — set edition status (draft / published / cancelled / completed)

## Seeding

The seed system has two stages:

### Stage 1: Extract (Airtable → local JSON)

Pulls records from Nicole's Airtable bases and saves them to `data/airtable/`. Run once, or again when her data changes. Requires a Claude session with Airtable MCP tools.

```bash
npm run db:extract
```

Extracted JSON files are gitignored.

### Stage 2: Load (local JSON → database)

Reads local JSON, transforms to match schema, inserts into Postgres. No network dependency.

```bash
npm run db:seed
```

Runs both static seed (carnival, seasons, subscription plans) and Airtable data load. Skips Airtable portion gracefully if no JSON files exist.

## Resetting the Database

```bash
docker compose exec postgres psql -U mcp -c "DROP DATABASE carnival_planner"
docker compose exec postgres psql -U mcp -c "CREATE DATABASE carnival_planner"
npm run db:migrate
npm run db:seed
```

## Tests

Tests run against the local Postgres database — it must be running and seeded.

```bash
npm test
```

## Project Structure

```
app/
├── api/
│   ├── auth/callback/    # WorkOS OAuth callback + JIT user provisioning
│   ├── mcp/[transport]/  # MCP server endpoint
│   └── oauth/            # OAuth proxy (authorize, token, register)
├── .well-known/          # RFC 8414 + RFC 9728 discovery endpoints
├── layout.tsx            # Root layout with AuthKitProvider
└── page.tsx              # Home page (auth-aware)
middleware.ts             # WorkOS auth middleware
src/
├── db/
│   ├── index.ts          # Drizzle client
│   ├── schema/           # Table definitions (one file per domain group)
│   └── seed/             # Seed scripts (extract + load)
└── mcp/
    ├── auth.ts           # JWT validation for MCP requests
    ├── provision.ts      # JIT user provisioning on first login
    └── tools/            # MCP tool implementations (fetes, bands, accommodations, vendors, admin)
tests/                    # Vitest test suite (real DB, no mocks)
drizzle/                  # Generated migration SQL
data/airtable/            # Extracted Airtable JSON (gitignored)
```

## Tech Stack

- **Framework:** Next.js 15 (App Router) on Vercel
- **Auth:** WorkOS AuthKit
- **MCP:** mcp-handler + @modelcontextprotocol/sdk
- **Database:** PostgreSQL (Drizzle ORM)
- **Runtime:** Node.js 22+, TypeScript

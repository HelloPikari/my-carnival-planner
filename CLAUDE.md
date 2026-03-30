# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

My Carnival Planner (MCP) is a one-stop-shop platform for planning trips to Carnival (starting with Trinidad Carnival, expanding to others later). It consolidates information users currently gather from scattered sources (WhatsApp, Facebook groups, Instagram, influencer videos) into a single planning tool.

**Core user problems:** Where to stay, what events (fetes) to attend, which bands/costumes to choose, how to get there, and group trip coordination.

**Key entities:** Carnivals, Fetes (events with yearly iterations), Bands (with yearly themes/costumes), Accommodations, Reviews, Users, Groups/Trips.

## Tech Stack

- **Database:** PostgreSQL
- **ORM:** Drizzle (type-safe, SQL-like — chosen for agent readability)
- **API:** Hono on Node.js (standalone API service — the API is the product)
- **Auth:** API-layer sessions in Postgres (no external auth service)
- **Image Storage:** DigitalOcean Spaces + CDN + image processing service
- **Hosting:** DigitalOcean

Frontends, MCP servers, and other consumers are separate projects that call this API.

## Session Logging

This project uses a session log system in `_log/` to maintain continuity between sessions.

### At the START of every session:
1. Read `_specs/roadmap.md` to understand the current state of the project
2. Read the most recent `_log/YYYY-MM-DD*.md` file to pick up where we left off

These two files are your "memory" — treat them as the source of truth for what's been done and what's next.

### At the END of every session (or when the user says they're wrapping up):
1. **Update `_specs/roadmap.md`** — Check off completed tasks, add new tasks discovered during the session, update the "Last updated" date
2. **Create or append to `_log/YYYY-MM-DD.md`** — Write a session summary covering:
   - What happened (key actions, decisions, results)
   - Key decisions made and why
   - What's next (immediate next steps for the following session)
   - Files changed
3. **Git commit** — Stage all changed files and create a commit. Use a descriptive message summarizing the session's work. Do NOT push unless asked.
4. Remind the user that the log has been updated and the commit has been created so they can review

### File conventions:
- `_log/YYYY-MM-DD.md` — Daily session logs. One file per day, append if multiple sessions in a day. Never edit past entries.
- `_specs/roadmap.md` — Living task list organized by project phase. Evolves over time.

## Specs & Plans

- Design specs go in `_specs/` (e.g., `_specs/2026-03-30-database-schema.md`)
- Implementation plans go in `_specs/plans/` (e.g., `_specs/plans/2026-03-30-seed-from-airtable.md`)
- Use `YYYY-MM-DD-` date prefix in filenames to keep folders sorted chronologically

## Experiments

Experiments in `experiments/` are immutable snapshots once concluded. A `CONCLUDED` file marks a finished experiment.

- Never modify files in a concluded experiment directory (one containing a `CONCLUDED` file)
- New experiments get their own versioned directory (e.g., `query-performance-v1/`)
- If you need to build on past results, read from the concluded experiment but write to a new one
- Use experiments for things like: testing query patterns, validating schema designs with mock data, prototyping API endpoints, testing image processing pipelines

## Shared Code

`src/lib/` contains utilities shared across the application. Before writing utility functions, check `src/lib/` first. If you write something reusable, consider adding it there.

## Reference Data

- `_reference/` contains meeting transcripts, Nicole's documents, and other source material
- Nicole's Airtable bases are accessible via MCP tools and serve as the primary data source for initial seeding
- Airtable is a source of *what data matters*, not *how it should be structured* — improve on her schema where appropriate

## Key Design Principles

- **API-first:** The API is the product. Frontends and MCP servers are just consumers.
- **Agent-first:** Agents are the primary developers. Prefer explicit, typed, SQL-like patterns over magical abstractions.
- **Data layer is the foundation:** Get the schema and queries right before building UI.
- **Multi-carnival from day one:** Schema supports multiple carnivals, but only Trinidad is populated initially.
- **Yearly iteration pattern:** Fetes and bands have master entities with per-season editions.
- **Ship small, iterate fast:** Every phase should produce something usable. Don't over-engineer for hypotheticals.

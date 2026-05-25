# CLAUDE.md

## Project Overview

My Carnival Planner is a platform for planning trips to Carnival (starting with Trinidad). It replaces the scattered research users do across WhatsApp groups, Instagram, and influencer videos with a single planning tool.

**Core user problems:** Where to stay, what fetes to attend, which band/costume to choose, how to get there, group coordination.

**Key entities:** Carnivals, Fetes (with yearly editions), Bands (with yearly themes/sections/costumes), Accommodations, Reviews, Users, Trips/Groups.

**Tiers:** Free (limited browse) / Pro (full access + itinerary builder + group planning) / Premium (Pro + AI assistant).

**Nicole Phillips** is a business partner and the primary data curator. She uses the admin MCP server to manage content.

## Session Logging

### At the START of every session:
1. Read `.claude/memory/MEMORY.md` to load project memory and user preferences
2. Read `_specs/roadmap.md` to understand the current state of the project
3. Read the most recent `_log/YYYY-MM-DD*.md` file to pick up where we left off

### At the END of every session (or when the user says they're wrapping up):
1. **Update `_specs/roadmap.md`** — check off completed tasks, add new ones, update the date
2. **Create or append to `_log/YYYY-MM-DD.md`** — cover what happened, decisions made, what's next, files changed
3. **Git commit** — stage changed files and commit with a descriptive message. Do NOT push unless asked.
4. Remind the user the log is updated and commit is ready to review

### File conventions:
- `_log/YYYY-MM-DD.md` — daily session logs, append if multiple sessions in a day, never edit past entries
- `_specs/roadmap.md` — living task list by phase

## Specs & Plans

- Design specs → `_specs/` (e.g. `_specs/2026-03-30-database-schema.md`)
- Implementation plans → `_specs/plans/` (e.g. `_specs/plans/2026-03-30-seed-from-airtable.md`)
- Use `YYYY-MM-DD-` date prefix

## Experiments

Experiments in `experiments/` are immutable once concluded (marked by a `CONCLUDED` file).

- Never modify files in a concluded experiment directory
- New experiments get their own versioned directory (e.g. `query-performance-v2/`)
- Read from concluded experiments, write to new ones

## Reference Data

- `_reference/` — meeting transcripts, Nicole's documents, source material
- Nicole's Airtable bases are accessible via MCP tools and are the primary source for seeding
- Airtable shows *what data matters*, not *how it should be structured*

## Design Principles

- **Data layer is the foundation.** Schema and queries before UI.
- **Multi-carnival from day one.** Schema supports multiple carnivals; Trinidad is populated first.
- **Yearly iteration pattern.** Fetes and bands have master entities with per-season editions.
- **Ship small, iterate fast.** Every phase produces something usable.

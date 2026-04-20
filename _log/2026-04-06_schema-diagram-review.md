# Session: Schema Diagram Review
**Date:** 2026-04-06
**Participants:** Steve + Claude

## Context
Following up on the 2026-03-30 database layer design session. Goal was to visually diagram the full schema and review it together before writing code.

## What Happened

### Mermaid Diagram Creation
- Created full ER diagram with all 27 tables and relationships
- Mermaid ER diagrams don't render in Steve's VS Code markdown preview (extension issue with erDiagram type)
- Tried generating a Mermaid Live URL — encoding mismatch (Python zlib vs JavaScript pako)
- Settled on: raw Mermaid code in the markdown file, copy-paste into mermaid.live for interactive viewing
- Also added per-domain-group breakdowns as smaller diagrams in the same file (these also won't render in VS Code but are useful for reading the code)

### Schema Refinements from Review
Walked through domain groups and refined based on Nicole's actual Airtable data:

1. **Carnivals normalized to locations** — removed `country`/`city` from `carnivals`, added `location_id FK` referencing an area-type location. Description stays on carnivals (it's about the cultural event, not the place).

2. **Fetes master slimmed down** — master now only holds identity traits: `name`, `organizer_vendor_id`, `category`. Pushed `description`, `venue_type`, `location_id` down to `fete_editions` since these can change year to year. Grounded in Airtable data: Nicole's Events table has 4 stable categories (Fete, Traditional Jouvert, Traditional Carnival Event, Jouvert Style).

3. **Bands master kept thick** — bands are more stable than fetes. Kept `category`, `size`, `demographic`, `costume_style` on master. `best_for` stored as JSONB array for now. Theme details (name, description, distribution info) live on `band_themes`.

4. **Pricing model reworked** — replaced `pricing_strategy` + `display_price` with `markup_type` + `markup_value`. Display price now calculated at query time, never stored. Markup types: none, percentage, flat, fixed. Negative values = discounts (e.g., Nicole bulk-bought hotel rooms and wants to pass savings along).

5. **Commerce tables left as-is** — order records are transaction snapshots (what the user paid), not listings. Different pricing semantics, intentionally different field names.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Carnivals → locations FK | Normalize geographic data; locations already supports "area" type |
| Thin fete master, thick editions | Category is identity; description/venue/location vary per year |
| Thick band master | Band traits (size, demographic, costume style) are stable identity |
| `best_for` as JSONB | Multi-select field, not worth a join table at this stage |
| Calculated display price | Stored prices go stale; markup_type + markup_value is sufficient |
| Negative markup = discount | Natural extension of markup model, no special discount logic needed |
| Local Docker for Postgres | Faster to start, free; migrate to DigitalOcean later |
| Mermaid code in markdown, view on mermaid.live | VS Code extension doesn't support erDiagram; copy-paste workflow is fine |

## Files Changed
- `_specs/2026-03-30-database-schema-diagram.md` — Full schema diagram + per-group breakdowns (created, iterated multiple times)
- `_specs/roadmap.md` — Checked off diagram task, expanded next steps into granular items
- `_log/2026-04-06_schema-diagram-review.md` — This file
- `.claude/memory/feedback_mermaid_diagrams.md` — Updated: don't use Mermaid Chart MCP tool

## What's Next
1. **Write a formal implementation plan** for getting to test queries (init project → Drizzle schema → Docker Postgres → migrations → Airtable seed script → MCP connector → test queries)
2. **Meet with Nicole** to review the schema diagram — show her on mermaid.live
3. **Start executing** — initialize project and write Drizzle schema files

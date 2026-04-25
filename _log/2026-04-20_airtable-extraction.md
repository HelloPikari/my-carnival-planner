# Session: Airtable Data Extraction + Seed
**Date:** 2026-04-20 (session 2)
**Participants:** Steve + Claude

## Context
Continued from earlier data-layer-implementation session. All schema/infra was ready; needed to pull real data from Nicole's Airtable bases and wire up the load script.

## What Happened

### Airtable Extraction
Identified and extracted 20 tables from 4 Airtable bases:
- **Events** (`appXz3qTokzWOZhx0`) — 7 tables (organizers, events, fetes-by-year, tickets, locations, reviews, trips)
- **Costumes** (`appEqqQjdTpdHTBpq`) — 6 tables (bands, themes, sections, costumes, designers, reviews)
- **Accommodations** (`app6CfLOVVPpf2yd0`) — 3 tables (hotels, amenities, room-types)
- **Vendors** (`appAvrjVHALzzvEjt`) — 4 tables (beauty, clothing, restaurants, transportation)

Total: ~1,900 records saved to `data/airtable/*.json`

### Load Script Rewrite
Completely rewrote `src/db/seed/load.ts` to handle:
- Actual Airtable JSON format (`cellValuesByFieldId` with field IDs, not names)
- Proper linked record resolution via `airtableId → pgUuid` maps
- Select field parsing (`{id, name, color}` objects)
- Lookup field parsing (`{linkedRecordIds, valuesByLinkedRecordId}` structure)
- Enum normalization (strip commas from band sizes, trim whitespace)

### Seed Results
Successfully loaded into Postgres:
- 70 locations, 86 vendors, 143 fetes, 163 fete editions
- 49 bands, 28 themes, 254 sections
- 19 accommodations, 11 room types

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Load only 2025 + 2026 editions | Matches seasons in static seed; avoids creating historical seasons |
| Store extra Airtable fields in `metadata` JSONB | Keeps schema minimal while preserving useful data (instagram, descriptions, tags) |
| Map organizers as vendors (type: "organizer") | Matches the vendor-first design from schema spec |
| Parse planner_rating from "4.7/5" formula strings | Airtable formula field outputs text, not numbers |

## Known Limitations
- **Tickets**: Only 1 loaded (from USD price on edition records). The detailed `tickets.json` (308 records) has per-tier data but needs fete-edition cross-referencing to load properly.
- **Costumes**: Sections loaded but individual costumes not yet loaded (need section→costume linking)
- **Reviews**: Only 3 total in Airtable (1 fete, 2 band) — sparse data
- **Vendor types**: Only organizers loaded; beauty/clothing/restaurant/transport vendors extracted but not loaded (no schema mapping yet for those types)

## Files Changed
- `src/db/seed/load.ts` — Complete rewrite with Airtable field ID mappings
- `src/db/seed/index.ts` — Updated to match new function signatures (location map, vendor map, season IDs)
- `data/airtable/*.json` — 20 new extract files
- `_specs/roadmap.md` — Checked off extraction tasks

## What's Next
1. **Load detailed tickets** — map `tickets.json` records through fete editions
2. **Load costumes** — map through band sections
3. **Set up Hono API project structure** — next roadmap item
4. **Auth system** — users, sessions, roles in API layer

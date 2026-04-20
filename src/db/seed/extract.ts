/**
 * EXTRACT STAGE: Pulls data from Nicole's Airtable bases → local JSON.
 *
 * Run this once (or whenever Airtable data changes):
 *   npx tsx src/db/seed/extract.ts
 *
 * This script is designed to be run interactively in a Claude session
 * with MCP Airtable tools available. It uses the Airtable MCP tools
 * to fetch records, then writes them to data/airtable/*.json.
 *
 * If running outside a Claude session, you'll need to export from
 * Airtable manually and place the JSON files in data/airtable/.
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const OUTPUT_DIR = resolve(import.meta.dirname, "../../../data/airtable");

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function writeExtract(filename: string, records: AirtableRecord[]) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const path = resolve(OUTPUT_DIR, filename);
  writeFileSync(path, JSON.stringify(records, null, 2));
  console.log(`  Wrote ${records.length} records to ${filename}`);
}

/**
 * Call this function with the records fetched from Airtable MCP tools.
 *
 * Usage in a Claude session:
 *   1. Use mcp__claude_ai_Airtable__search_bases to find the bases
 *   2. Use mcp__claude_ai_Airtable__list_records_for_table to get records
 *   3. Pass the records to these extract functions
 *
 * Or run this script directly and it will prompt for manual paste.
 */
export function extractEvents(records: AirtableRecord[]) {
  writeExtract("events.json", records);
}

export function extractBands(records: AirtableRecord[]) {
  writeExtract("bands.json", records);
}

export function extractAccommodations(records: AirtableRecord[]) {
  writeExtract("accommodations.json", records);
}

// When run directly, provide instructions
async function main() {
  console.log("=== Airtable Extract ===\n");
  console.log("This script extracts data from Nicole's Airtable bases.");
  console.log("It should be run in a Claude session with MCP Airtable tools.\n");
  console.log("The executing agent should:");
  console.log("  1. search_bases → find Events, Costumes, Accommodations");
  console.log("  2. list_records_for_table for each relevant table");
  console.log("  3. Import { extractEvents, extractBands, extractAccommodations }");
  console.log("     and call them with the fetched records\n");
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

main();

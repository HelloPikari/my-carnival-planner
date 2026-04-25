/**
 * Main seed entry point. Runs both stages:
 *   1. Static data (always runs — roles, carnival, seasons, plans)
 *   2. Load from local JSON (reads data/airtable/*.json — no network)
 *
 * Usage:
 *   npm run db:seed
 *
 * To reset and re-seed:
 *   npm run db:push && npm run db:seed
 */

import "dotenv/config";
import { db } from "../index.js";
import { carnivalSeasons } from "../schema/index.js";
import { eq } from "drizzle-orm";
import { seedStatic } from "./static.js";
import { loadLocations, loadVendors, loadFetes, loadBands, loadAccommodations } from "./load.js";

async function main() {
  console.log("Starting seed...\n");

  // Stage 1: Static data
  await seedStatic();

  // Stage 2: Load from local JSON (extracted from Airtable)
  console.log("\nLoading from local JSON...");

  const [season2025] = await db
    .select()
    .from(carnivalSeasons)
    .where(eq(carnivalSeasons.year, 2025));

  const [season2026] = await db
    .select()
    .from(carnivalSeasons)
    .where(eq(carnivalSeasons.year, 2026));

  if (!season2025 || !season2026) {
    throw new Error("2025/2026 seasons not found — did static seed run?");
  }

  const seasonIds = { s2025: season2025.id, s2026: season2026.id };

  const locationMap = await loadLocations();
  const vendorMap = await loadVendors();
  await loadFetes(seasonIds, vendorMap, locationMap);
  await loadBands(seasonIds);
  await loadAccommodations(locationMap);

  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

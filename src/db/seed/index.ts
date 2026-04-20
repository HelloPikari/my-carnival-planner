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
import { loadFetes, loadBands, loadAccommodations } from "./load.js";

async function main() {
  console.log("Starting seed...\n");

  // Stage 1: Static data
  await seedStatic();

  // Stage 2: Load from local JSON (extracted from Airtable)
  console.log("\nLoading from local JSON...");

  const [season2026] = await db
    .select()
    .from(carnivalSeasons)
    .where(eq(carnivalSeasons.year, 2026));

  if (!season2026) {
    throw new Error("2026 season not found — did static seed run?");
  }

  await loadFetes(season2026.id);
  await loadBands(season2026.id);
  await loadAccommodations();

  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

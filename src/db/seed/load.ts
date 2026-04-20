/**
 * LOAD STAGE: Reads local JSON (from extract) → transforms → inserts into DB.
 *
 * Repeatable, no network needed. Run after migrations:
 *   npx tsx src/db/seed/index.ts
 *
 * Expects JSON files in data/airtable/ (created by extract.ts).
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { db } from "../index.js";
import {
  locations,
  vendors,
  fetes,
  feteEditions,
  tickets,
  bands,
  bandThemes,
  bandSections,
  costumes,
  accommodations,
  roomTypes,
} from "../schema/index.js";

const DATA_DIR = resolve(import.meta.dirname, "../../../data/airtable");

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function readExtract(filename: string): AirtableRecord[] {
  const path = resolve(DATA_DIR, filename);
  if (!existsSync(path)) {
    console.log(`  Skipping ${filename} (not found — run extract first)`);
    return [];
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Load fetes from extracted events.json.
 */
export async function loadFetes(seasonId: string) {
  const records = readExtract("events.json");
  if (!records.length) return;

  console.log(`  Loading ${records.length} fetes...`);

  for (const record of records) {
    const fields = record.fields;

    let vendorId: string | undefined;
    if (fields["Organizer"]) {
      const [vendor] = await db
        .insert(vendors)
        .values({
          name: fields["Organizer"] as string,
          type: "organizer",
        })
        .onConflictDoNothing()
        .returning();
      vendorId = vendor?.id;
    }

    const [fete] = await db
      .insert(fetes)
      .values({
        name: fields["Name"] as string,
        organizerVendorId: vendorId,
        category: fields["Category"] as any,
      })
      .returning();

    let locationId: string | undefined;
    if (fields["Venue"] || fields["Location"]) {
      const [loc] = await db
        .insert(locations)
        .values({
          name: (fields["Venue"] || fields["Location"]) as string,
          type: "venue",
        })
        .returning();
      locationId = loc.id;
    }

    const [edition] = await db
      .insert(feteEditions)
      .values({
        feteId: fete.id,
        carnivalSeasonId: seasonId,
        locationId,
        venueType: fields["Venue Type"] as any,
        description: fields["Description"] as string,
        startDatetime: fields["Date"] ? new Date(fields["Date"] as string) : undefined,
        status: "published",
      })
      .returning();

    if (fields["General Price"]) {
      await db.insert(tickets).values({
        feteEditionId: edition.id,
        admissionType: "General",
        price: String(fields["General Price"]),
        currency: "TTD",
        markupType: "none",
      });
    }
  }

  console.log(`  Fetes loaded.`);
}

/**
 * Load bands from extracted bands.json.
 */
export async function loadBands(seasonId: string) {
  const records = readExtract("bands.json");
  if (!records.length) return;

  console.log(`  Loading ${records.length} bands...`);

  for (const record of records) {
    const fields = record.fields;

    const [band] = await db
      .insert(bands)
      .values({
        name: fields["Name"] as string,
        category: fields["Category"] as any,
        size: fields["Size"] as any,
        demographic: fields["Demographic"] as any,
        costumeStyle: fields["Costume Style"] as any,
      })
      .returning();

    await db
      .insert(bandThemes)
      .values({
        bandId: band.id,
        carnivalSeasonId: seasonId,
        themeName: (fields["Theme"] || fields["Name"]) as string,
        description: fields["Theme Description"] as string,
      });
  }

  console.log(`  Bands loaded.`);
}

/**
 * Load accommodations from extracted accommodations.json.
 */
export async function loadAccommodations() {
  const records = readExtract("accommodations.json");
  if (!records.length) return;

  console.log(`  Loading ${records.length} accommodations...`);

  for (const record of records) {
    const fields = record.fields;

    let locationId: string | undefined;
    if (fields["Address"] || fields["Area"]) {
      const [loc] = await db
        .insert(locations)
        .values({
          name: (fields["Area"] || fields["Name"]) as string,
          address: fields["Address"] as string,
          city: "Port of Spain",
          country: "Trinidad and Tobago",
          type: "hotel",
        })
        .returning();
      locationId = loc.id;
    }

    await db
      .insert(accommodations)
      .values({
        name: fields["Name"] as string,
        type: fields["Type"] as string,
        starRating: fields["Star Rating"] as number,
        locationId,
        amenities: fields["Amenities"] as any,
        plannerRating: fields["Rating"] ? String(fields["Rating"]) : undefined,
      });
  }

  console.log(`  Accommodations loaded.`);
}

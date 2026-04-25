/**
 * LOAD STAGE: Reads local JSON (from extract) → transforms → inserts into DB.
 *
 * Repeatable, no network needed. Run after migrations:
 *   npx tsx src/db/seed/index.ts
 *
 * Expects JSON files in data/airtable/ (created by extract.ts or MCP tools).
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface AirtableRecord {
  id: string;
  createdTime: string;
  cellValuesByFieldId: Record<string, unknown>;
}

interface AirtableFile {
  records: AirtableRecord[];
  metadata: { totalRecordCount: number };
}

function readExtract(filename: string): AirtableRecord[] {
  const path = resolve(DATA_DIR, filename);
  if (!existsSync(path)) {
    console.log(`  Skipping ${filename} (not found)`);
    return [];
  }
  const data: AirtableFile = JSON.parse(readFileSync(path, "utf-8"));
  return data.records;
}

/** Get .name from a singleSelect field value ({id, name, color}) */
function selectName(val: unknown): string | undefined {
  if (val && typeof val === "object" && "name" in (val as any)) {
    return (val as { name: string }).name;
  }
  return undefined;
}

/** Get first linked record ID from a multipleRecordLinks field */
function firstLinkedId(val: unknown): string | undefined {
  if (Array.isArray(val) && val.length > 0) {
    return val[0].id;
  }
  return undefined;
}

/** Strip commas from band size strings to match our enum */
function normalizeBandSize(val: string | undefined): string | undefined {
  if (!val) return undefined;
  return val.replace(/,/g, "");
}

// ─── Locations ───────────────────────────────────────────────────────────────

export async function loadLocations(): Promise<Map<string, string>> {
  const records = readExtract("locations.json");
  if (!records.length) return new Map();

  console.log(`  Loading ${records.length} locations...`);
  const idMap = new Map<string, string>(); // airtableId → pgId

  for (const rec of records) {
    const f = rec.cellValuesByFieldId;
    const name = f["fldaSfkYvrf99jyAo"] as string;
    if (!name) continue;

    const [row] = await db
      .insert(locations)
      .values({
        name,
        address: f["fldxwpT7mYv0H5qkz"] as string | undefined,
        city: selectName(f["fld04HTsBfzUTpAY1"]),
        country: selectName(f["fldHonxrG9rSculsa"]) === "Trinidad"
          ? "Trinidad and Tobago"
          : selectName(f["fldHonxrG9rSculsa"]),
        latitude: f["fldyQxfAI4Z7pzZss"] as string | undefined,
        longitude: f["fldqQ4E5PtmvNB8Ab"] as string | undefined,
        type: "venue",
      })
      .onConflictDoNothing()
      .returning();

    if (row) idMap.set(rec.id, row.id);
  }

  console.log(`  Loaded ${idMap.size} locations.`);
  return idMap;
}

// ─── Vendors (Event Organizers) ──────────────────────────────────────────────

export async function loadVendors(): Promise<Map<string, string>> {
  const records = readExtract("event-organizers.json");
  if (!records.length) return new Map();

  console.log(`  Loading ${records.length} event organizers as vendors...`);
  const idMap = new Map<string, string>();

  for (const rec of records) {
    const f = rec.cellValuesByFieldId;
    const name = (f["fldp7rEysQU5QGkZF"] as string)?.trim();
    if (!name) continue;

    const [row] = await db
      .insert(vendors)
      .values({
        name,
        type: "organizer",
        website: f["fldaPCh77TTAMamFl"] as string | undefined,
        contactEmail: f["fld5BKm1ArITXZk7W"] as string | undefined,
        metadata: {
          instagram: f["fld9Bi9Rux5ILidzn"] as string | undefined,
          contactName: f["fldIqg5pE7PAzalvc"] as string | undefined,
          status: selectName(f["fldYeOJJSO4vSckJo"]),
        },
      })
      .onConflictDoNothing()
      .returning();

    if (row) idMap.set(rec.id, row.id);
  }

  console.log(`  Loaded ${idMap.size} vendors.`);
  return idMap;
}

// ─── Fetes (master + editions for 2025/2026) ─────────────────────────────────

export async function loadFetes(
  seasonIds: { s2025: string; s2026: string },
  vendorMap: Map<string, string>,
  locationMap: Map<string, string>,
) {
  const masterRecords = readExtract("events.json");
  const editionRecords = readExtract("fetes-by-year.json");
  if (!masterRecords.length) return;

  console.log(`  Loading ${masterRecords.length} fetes (master)...`);
  const feteIdMap = new Map<string, string>(); // airtableId → pgId

  for (const rec of masterRecords) {
    const f = rec.cellValuesByFieldId;
    const name = f["fldzMbZhSMX7Y05qg"] as string;
    if (!name) continue;

    const category = selectName(f["fldkaIh1HwHwjAYrx"]);
    const organizerAirtableId = firstLinkedId(f["fldjRI6GYcifVXSbp"]);
    const organizerVendorId = organizerAirtableId
      ? vendorMap.get(organizerAirtableId)
      : undefined;

    // Resolve location
    const locationAirtableId = firstLinkedId(f["fldhBZmtPAKHvooYU"]);
    const locationId = locationAirtableId
      ? locationMap.get(locationAirtableId)
      : undefined;

    const [fete] = await db
      .insert(fetes)
      .values({
        name,
        organizerVendorId,
        category: category as any || "Fete",
        metadata: {
          airtableId: rec.id,
          slug: f["fldAuexx3MpwuzQvH"] as string | undefined,
          day: selectName(f["fld8ZeqmqlA4q0Ga3"]),
          included: Array.isArray(f["fldzpICVuGpi0ktSY"])
            ? (f["fldzpICVuGpi0ktSY"] as any[]).map(s => s.name)
            : undefined,
          entertainment: Array.isArray(f["fldrquItEqbnDQ7Tr"])
            ? (f["fldrquItEqbnDQ7Tr"] as any[]).map(s => s.name)
            : undefined,
          dress: Array.isArray(f["fldU4DekXFuDLcHWt"])
            ? (f["fldU4DekXFuDLcHWt"] as any[]).map(s => s.name)
            : undefined,
          locationId,
        },
      })
      .returning();

    feteIdMap.set(rec.id, fete.id);
  }

  // Now load editions (only 2025 + 2026)
  console.log(`  Loading fete editions (2025+2026 only)...`);
  let editionCount = 0;

  for (const rec of editionRecords) {
    const f = rec.cellValuesByFieldId;

    // Determine year from lookup field (multipleLookupValues format)
    const yearLookup = f["fldy4n0CaLK20Kiyd"] as any;
    let year: number | undefined;
    if (yearLookup?.valuesByLinkedRecordId) {
      const firstId = yearLookup.linkedRecordIds?.[0];
      const vals = firstId ? yearLookup.valuesByLinkedRecordId[firstId] : undefined;
      if (Array.isArray(vals) && vals.length > 0) {
        year = parseInt(vals[0]?.name || vals[0]);
      }
    } else if (Array.isArray(yearLookup) && yearLookup.length > 0) {
      const yearVal = yearLookup[0];
      year = typeof yearVal === "object" ? parseInt(yearVal.name) : parseInt(yearVal);
    }

    if (!year || (year !== 2025 && year !== 2026)) continue;

    const seasonId = year === 2025 ? seasonIds.s2025 : seasonIds.s2026;
    const feteAirtableId = firstLinkedId(f["fldSs7QaPFSwk6FOT"]);
    const feteId = feteAirtableId ? feteIdMap.get(feteAirtableId) : undefined;
    if (!feteId) continue;

    const startRaw = f["fldoNwnQLerlxBrmA"] as string | undefined;
    const endRaw = f["fldlsuwO7pS4lTTo1"] as string | undefined;
    const status = selectName(f["fldpVJs6CAAxovq3H"]);
    const description = f["fld1RUCpDZnQiKsb2"] as string | undefined;

    const [edition] = await db
      .insert(feteEditions)
      .values({
        feteId,
        carnivalSeasonId: seasonId,
        startDatetime: startRaw ? new Date(startRaw) : undefined,
        endDatetime: endRaw ? new Date(endRaw) : undefined,
        description,
        status: status === "Confirmed" || status === "Active" ? "published" : "draft",
        metadata: {
          airtableId: rec.id,
          airtableStatus: status,
        },
      })
      .returning();

    // Load ticket price if available
    const priceUsd = f["fldRFXstE2Hf3OlgC"] as number | undefined;
    if (priceUsd && edition) {
      await db.insert(tickets).values({
        feteEditionId: edition.id,
        admissionType: "General",
        price: String(priceUsd),
        currency: "USD",
        markupType: "none",
      });
    }

    editionCount++;
  }

  console.log(`  Loaded ${feteIdMap.size} fetes, ${editionCount} editions.`);
}

// ─── Bands ───────────────────────────────────────────────────────────────────

export async function loadBands(
  seasonIds: { s2025: string; s2026: string },
) {
  const bandRecords = readExtract("bands.json");
  const themeRecords = readExtract("band-themes.json");
  const sectionRecords = readExtract("band-sections.json");
  if (!bandRecords.length) return;

  console.log(`  Loading ${bandRecords.length} bands...`);
  const bandIdMap = new Map<string, string>();

  for (const rec of bandRecords) {
    const f = rec.cellValuesByFieldId;
    const name = f["fldOoChsdYi1fdkU0"] as string;
    if (!name) continue;

    const category = selectName(f["fld8nLI8H1k3kYVgG"])?.trim();
    const size = normalizeBandSize(selectName(f["fldMdfxuQMVXHyNgc"])?.trim());
    const demographic = selectName(f["fld31xOjGCSYmeckH"])?.trim();
    const costumeStyle = selectName(f["fldzMqsWNRIpLuQhH"])?.trim();

    const [band] = await db
      .insert(bands)
      .values({
        name,
        category: category as any || undefined,
        size: size as any || undefined,
        demographic: demographic as any || undefined,
        costumeStyle: costumeStyle as any || undefined,
        metadata: {
          airtableId: rec.id,
          website: f["fldhQ1NfpaaLOJXFR"] as string | undefined,
          instagram: f["fldsC2GxU7TFfrV82"] as string | undefined,
          description: f["fldpfrccYgWfNVDqO"] as string | undefined,
        },
      })
      .returning();

    bandIdMap.set(rec.id, band.id);
  }

  // Load themes (only those linked to 2025/2026 trips)
  console.log(`  Loading band themes...`);
  const themeIdMap = new Map<string, string>();

  for (const rec of themeRecords) {
    const f = rec.cellValuesByFieldId;
    const themeName = f["fldXn6UZlSLVZBXtd"] as string;
    if (!themeName) continue;

    const bandAirtableId = firstLinkedId(f["fld75FFjA8Nbr38yh"]);
    const bandId = bandAirtableId ? bandIdMap.get(bandAirtableId) : undefined;
    if (!bandId) continue;

    // Check year via Trip link
    const tripLink = f["fldh3FW7mmUitBhrB"] as any[];
    let year: number | undefined;
    if (Array.isArray(tripLink) && tripLink.length > 0) {
      const yearLookup = f["fldQpSatklrKiZpp1"];
      if (Array.isArray(yearLookup) && yearLookup.length > 0) {
        const yv = yearLookup[0];
        year = typeof yv === "object" && yv?.name
          ? parseInt(yv.name)
          : typeof yv === "string" ? parseInt(yv) : undefined;
      }
    }

    // Default to 2026 if we can't determine year
    const seasonId = year === 2025 ? seasonIds.s2025 : seasonIds.s2026;

    const [theme] = await db
      .insert(bandThemes)
      .values({
        bandId,
        carnivalSeasonId: seasonId,
        themeName,
        description: f["fldaANu9DebUr4ERJ"] as string | undefined,
        metadata: { airtableId: rec.id },
      })
      .returning();

    themeIdMap.set(rec.id, theme.id);
  }

  // Load sections
  console.log(`  Loading band sections...`);
  let sectionCount = 0;
  const sectionIdMap = new Map<string, string>();

  for (const rec of sectionRecords) {
    const f = rec.cellValuesByFieldId;
    const name = f["fldnZan7R9998h3ya"] as string;
    if (!name) continue;

    const themeAirtableId = firstLinkedId(f["fld68PdkyzInUO5mA"]);
    const themeId = themeAirtableId ? themeIdMap.get(themeAirtableId) : undefined;
    if (!themeId) continue;

    const designerLink = f["fld3BRA54qKmZ25KZ"] as any[];
    const designer = Array.isArray(designerLink) && designerLink.length > 0
      ? designerLink[0].name
      : undefined;

    const colors = Array.isArray(f["fldDrywx0MJhTzbjE"])
      ? (f["fldDrywx0MJhTzbjE"] as any[]).map(s => s.name).join(", ")
      : undefined;

    const [section] = await db
      .insert(bandSections)
      .values({
        bandThemeId: themeId,
        name,
        description: f["fldLfOd777fPNZAjB"] as string | undefined,
        designer,
        colors,
        metadata: { airtableId: rec.id },
      })
      .returning();

    sectionIdMap.set(rec.id, section.id);
    sectionCount++;
  }

  console.log(`  Loaded ${bandIdMap.size} bands, ${themeIdMap.size} themes, ${sectionCount} sections.`);
}

// ─── Accommodations ──────────────────────────────────────────────────────────

export async function loadAccommodations(locationMap: Map<string, string>) {
  const hotelRecords = readExtract("hotels.json");
  const roomRecords = readExtract("room-types.json");
  if (!hotelRecords.length) return;

  console.log(`  Loading ${hotelRecords.length} accommodations...`);
  const accomIdMap = new Map<string, string>();

  for (const rec of hotelRecords) {
    const f = rec.cellValuesByFieldId;
    const name = f["fld4AfHka63jwg33V"] as string;
    if (!name) continue;

    // Create location for hotel address
    const address = f["fldM5Sw5pJhxLQl8w"] as string | undefined;
    let locationId: string | undefined;
    if (address) {
      const [loc] = await db
        .insert(locations)
        .values({
          name,
          address,
          city: "Port of Spain",
          country: "Trinidad and Tobago",
          type: "hotel",
        })
        .returning();
      locationId = loc.id;
    }

    const starRatingStr = selectName(f["fldql2WbtvMzlLQE4"]);
    const starRating = starRatingStr ? parseInt(starRatingStr) : undefined;
    // Planner rating is a formula like "4.7/5" — extract the number
    const plannerRatingRaw = f["fld9EH4dNPDLLamGU"] as string | number | undefined;
    let plannerRating: string | undefined;
    if (typeof plannerRatingRaw === "number") {
      plannerRating = String(plannerRatingRaw);
    } else if (typeof plannerRatingRaw === "string") {
      const match = plannerRatingRaw.match(/^([\d.]+)/);
      plannerRating = match ? match[1] : undefined;
    }

    const [accom] = await db
      .insert(accommodations)
      .values({
        name,
        type: selectName(f["fldLTwx1jDS7578sk"]) || "Hotel",
        starRating: isNaN(starRating as number) ? undefined : starRating,
        locationId,
        plannerRating,
        metadata: {
          airtableId: rec.id,
          website: f["fldTtxs4UQSLu1u9V"] as string | undefined,
          description: f["fldjzqZVAeQAdQaPH"] as string | undefined,
        },
      })
      .returning();

    accomIdMap.set(rec.id, accom.id);
  }

  // Load room types
  console.log(`  Loading room types...`);
  let roomCount = 0;

  for (const rec of roomRecords) {
    const f = rec.cellValuesByFieldId;
    const roomType = f["fldvmTinPzd2RFXjP"] as string;
    if (!roomType) continue;

    const hotelLink = f["fldXdRJZ8xmRYSQPv"] as any[];
    const hotelAirtableId = Array.isArray(hotelLink) && hotelLink.length > 0
      ? hotelLink[0].id
      : undefined;
    const accommodationId = hotelAirtableId
      ? accomIdMap.get(hotelAirtableId)
      : undefined;
    if (!accommodationId) continue;

    const maxOccupancy = selectName(f["fldC3opWEoaFRHRc3"]);

    await db.insert(roomTypes).values({
      accommodationId,
      name: roomType,
      maxOccupancy: maxOccupancy ? parseInt(maxOccupancy) : undefined,
      description: f["fldDqVFLJJdxEShBI"] as string | undefined,
      metadata: { airtableId: rec.id },
    });

    roomCount++;
  }

  console.log(`  Loaded ${accomIdMap.size} accommodations, ${roomCount} room types.`);
}

import { describe, it, expect, beforeAll } from "vitest";
import "dotenv/config";
import { db } from "../src/db/index.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  carnivals,
  carnivalSeasons,
  locations,
  fetes,
  feteEditions,
  tickets,
  bands,
  bandThemes,
  bandSections,
  costumes,
  accommodations,
  roomTypes,
  subscriptionPlans,
} from "../src/db/schema/index.js";

describe("Schema validation queries", () => {
  it("can query carnival with location via relation", async () => {
    const result = await db.query.carnivals.findFirst({
      with: { location: true, seasons: true },
    });

    expect(result).toBeDefined();
    expect(result!.name).toBe("Trinidad Carnival");
    expect(result!.location).toBeDefined();
    expect(result!.location!.country).toBe("Trinidad and Tobago");
    expect(result!.seasons.length).toBeGreaterThanOrEqual(2);
  });

  it("can query active carnival season", async () => {
    const result = await db
      .select()
      .from(carnivalSeasons)
      .where(eq(carnivalSeasons.status, "active"));

    expect(result.length).toBe(1);
    expect(result[0].year).toBe(2026);
  });

  it("can query subscription plans by tier", async () => {
    const result = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.tier, "premium"));

    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Premium");
  });

  it("schema supports fete → edition → tickets join", async () => {
    const result = await db
      .select({
        feteName: fetes.name,
        editionId: feteEditions.id,
        ticketType: tickets.admissionType,
      })
      .from(fetes)
      .leftJoin(feteEditions, eq(feteEditions.feteId, fetes.id))
      .leftJoin(tickets, eq(tickets.feteEditionId, feteEditions.id));

    expect(result).toBeDefined();
  });

  it("schema supports band → theme → section → costume join", async () => {
    const result = await db
      .select({
        bandName: bands.name,
        theme: bandThemes.themeName,
        section: bandSections.name,
        costumeType: costumes.type,
        costumePrice: costumes.price,
      })
      .from(bands)
      .leftJoin(bandThemes, eq(bandThemes.bandId, bands.id))
      .leftJoin(bandSections, eq(bandSections.bandThemeId, bandThemes.id))
      .leftJoin(costumes, eq(costumes.bandSectionId, bandSections.id));

    expect(result).toBeDefined();
  });

  it("schema supports accommodation → room_types join", async () => {
    const result = await db
      .select({
        name: accommodations.name,
        roomName: roomTypes.name,
        price: roomTypes.price,
      })
      .from(accommodations)
      .leftJoin(roomTypes, eq(roomTypes.accommodationId, accommodations.id));

    expect(result).toBeDefined();
  });
});

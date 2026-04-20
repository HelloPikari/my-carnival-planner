import { pgTable, uuid, text, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import { feteCategoryEnum, venueTypeEnum, feteEditionStatusEnum, markupTypeEnum } from "./enums.js";
import { carnivalSeasons, locations } from "./core.js";
import { vendors } from "./vendors.js";

export const fetes = pgTable("fetes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  organizerVendorId: uuid("organizer_vendor_id").references(() => vendors.id),
  category: feteCategoryEnum("category").notNull(),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const feteEditions = pgTable("fete_editions", {
  id: uuid("id").primaryKey().defaultRandom(),
  feteId: uuid("fete_id").notNull().references(() => fetes.id),
  carnivalSeasonId: uuid("carnival_season_id").notNull().references(() => carnivalSeasons.id),
  locationId: uuid("location_id").references(() => locations.id),
  venueType: venueTypeEnum("venue_type"),
  description: text("description"),
  startDatetime: timestamp("start_datetime", { withTimezone: true }),
  endDatetime: timestamp("end_datetime", { withTimezone: true }),
  status: feteEditionStatusEnum("status").notNull().default("draft"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  feteEditionId: uuid("fete_edition_id").notNull().references(() => feteEditions.id),
  admissionType: text("admission_type").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("TTD"),
  usdSnapshot: decimal("usd_snapshot", { precision: 10, scale: 2 }),
  markupType: markupTypeEnum("markup_type").notNull().default("none"),
  markupValue: decimal("markup_value", { precision: 10, scale: 2 }),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

// Relations
export const fetesRelations = relations(fetes, ({ one, many }) => ({
  organizerVendor: one(vendors, {
    fields: [fetes.organizerVendorId],
    references: [vendors.id],
  }),
  editions: many(feteEditions),
}));

export const feteEditionsRelations = relations(feteEditions, ({ one, many }) => ({
  fete: one(fetes, {
    fields: [feteEditions.feteId],
    references: [fetes.id],
  }),
  carnivalSeason: one(carnivalSeasons, {
    fields: [feteEditions.carnivalSeasonId],
    references: [carnivalSeasons.id],
  }),
  location: one(locations, {
    fields: [feteEditions.locationId],
    references: [locations.id],
  }),
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one }) => ({
  feteEdition: one(feteEditions, {
    fields: [tickets.feteEditionId],
    references: [feteEditions.id],
  }),
}));

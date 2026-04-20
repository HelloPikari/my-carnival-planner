import { pgTable, uuid, text, integer, date, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import { carnivalSeasonStatusEnum, locationTypeEnum } from "./enums.js";

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  type: locationTypeEnum("type").notNull(),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const carnivals = pgTable("carnivals", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  locationId: uuid("location_id").references(() => locations.id),
  description: text("description"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const carnivalSeasons = pgTable("carnival_seasons", {
  id: uuid("id").primaryKey().defaultRandom(),
  carnivalId: uuid("carnival_id").notNull().references(() => carnivals.id),
  year: integer("year").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: carnivalSeasonStatusEnum("status").notNull().default("planning"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

// Relations
export const locationsRelations = relations(locations, ({ many }) => ({
  carnivals: many(carnivals),
}));

export const carnivalsRelations = relations(carnivals, ({ one, many }) => ({
  location: one(locations, {
    fields: [carnivals.locationId],
    references: [locations.id],
  }),
  seasons: many(carnivalSeasons),
}));

export const carnivalSeasonsRelations = relations(carnivalSeasons, ({ one }) => ({
  carnival: one(carnivals, {
    fields: [carnivalSeasons.carnivalId],
    references: [carnivals.id],
  }),
}));

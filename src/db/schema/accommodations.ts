import { pgTable, uuid, text, integer, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import { markupTypeEnum } from "./enums.js";
import { locations } from "./core.js";
import { vendors } from "./vendors.js";

export const accommodations = pgTable("accommodations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type"),
  starRating: integer("star_rating"),
  locationId: uuid("location_id").references(() => locations.id),
  amenities: jsonb("amenities"),
  plannerRating: decimal("planner_rating", { precision: 3, scale: 1 }),
  vendorId: uuid("vendor_id").references(() => vendors.id),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const roomTypes = pgTable("room_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  accommodationId: uuid("accommodation_id").notNull().references(() => accommodations.id),
  name: text("name").notNull(),
  maxOccupancy: integer("max_occupancy"),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  currency: text("currency").default("TTD"),
  usdSnapshot: decimal("usd_snapshot", { precision: 10, scale: 2 }),
  markupType: markupTypeEnum("markup_type").notNull().default("none"),
  markupValue: decimal("markup_value", { precision: 10, scale: 2 }),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

// Relations
export const accommodationsRelations = relations(accommodations, ({ one, many }) => ({
  location: one(locations, {
    fields: [accommodations.locationId],
    references: [locations.id],
  }),
  vendor: one(vendors, {
    fields: [accommodations.vendorId],
    references: [vendors.id],
  }),
  roomTypes: many(roomTypes),
}));

export const roomTypesRelations = relations(roomTypes, ({ one }) => ({
  accommodation: one(accommodations, {
    fields: [roomTypes.accommodationId],
    references: [accommodations.id],
  }),
}));

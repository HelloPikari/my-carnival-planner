import { pgTable, uuid, text, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import {
  tripMemberRoleEnum,
  itineraryItemTypeEnum,
  itineraryItemStatusEnum,
} from "./enums.js";
import { carnivalSeasons } from "./core.js";
import { users } from "./users.js";

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  carnivalSeasonId: uuid("carnival_season_id").notNull().references(() => carnivalSeasons.id),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const tripMembers = pgTable("trip_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id").notNull().references(() => trips.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: tripMemberRoleEnum("role").notNull().default("member"),
  ...auditColumns,
});

export const itineraries = pgTable("itineraries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripMemberId: uuid("trip_member_id").notNull().references(() => tripMembers.id),
  name: text("name"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const itineraryItems = pgTable("itinerary_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  itineraryId: uuid("itinerary_id").notNull().references(() => itineraries.id),
  itemType: itineraryItemTypeEnum("item_type").notNull(),
  itemId: uuid("item_id"),
  customTitle: text("custom_title"),
  customDescription: text("custom_description"),
  startDatetime: timestamp("start_datetime", { withTimezone: true }),
  endDatetime: timestamp("end_datetime", { withTimezone: true }),
  status: itineraryItemStatusEnum("status").notNull().default("interested"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  currency: text("currency"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

// Relations
export const tripsRelations = relations(trips, ({ one, many }) => ({
  carnivalSeason: one(carnivalSeasons, {
    fields: [trips.carnivalSeasonId],
    references: [carnivalSeasons.id],
  }),
  members: many(tripMembers),
}));

export const tripMembersRelations = relations(tripMembers, ({ one, many }) => ({
  trip: one(trips, {
    fields: [tripMembers.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [tripMembers.userId],
    references: [users.id],
  }),
  itineraries: many(itineraries),
}));

export const itinerariesRelations = relations(itineraries, ({ one, many }) => ({
  tripMember: one(tripMembers, {
    fields: [itineraries.tripMemberId],
    references: [tripMembers.id],
  }),
  items: many(itineraryItems),
}));

export const itineraryItemsRelations = relations(itineraryItems, ({ one }) => ({
  itinerary: one(itineraries, {
    fields: [itineraryItems.itineraryId],
    references: [itineraries.id],
  }),
}));

import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import { reviewStatusEnum } from "./enums.js";
import { users } from "./users.js";
import { feteEditions } from "./fetes.js";
import { bandThemes } from "./bands.js";
import { accommodations } from "./accommodations.js";

export const feteReviews = pgTable("fete_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  feteEditionId: uuid("fete_edition_id").notNull().references(() => feteEditions.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  ratingOverall: integer("rating_overall").notNull(),
  ratingVibes: integer("rating_vibes"),
  ratingMusic: integer("rating_music"),
  ratingValue: integer("rating_value"),
  headline: text("headline"),
  body: text("body"),
  status: reviewStatusEnum("status").notNull().default("pending"),
  ...auditColumns,
});

export const bandReviews = pgTable("band_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  bandThemeId: uuid("band_theme_id").notNull().references(() => bandThemes.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  ratingOverall: integer("rating_overall").notNull(),
  ratingCostumeQuality: integer("rating_costume_quality"),
  ratingOrganization: integer("rating_organization"),
  ratingValue: integer("rating_value"),
  headline: text("headline"),
  body: text("body"),
  status: reviewStatusEnum("status").notNull().default("pending"),
  ...auditColumns,
});

export const accommodationReviews = pgTable("accommodation_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  accommodationId: uuid("accommodation_id").notNull().references(() => accommodations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  ratingOverall: integer("rating_overall").notNull(),
  ratingCleanliness: integer("rating_cleanliness"),
  ratingLocation: integer("rating_location"),
  ratingValue: integer("rating_value"),
  headline: text("headline"),
  body: text("body"),
  status: reviewStatusEnum("status").notNull().default("pending"),
  ...auditColumns,
});

export const favorites = pgTable("favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  favoritableType: text("favoritable_type").notNull(),
  favoritableId: uuid("favoritable_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const feteReviewsRelations = relations(feteReviews, ({ one }) => ({
  feteEdition: one(feteEditions, {
    fields: [feteReviews.feteEditionId],
    references: [feteEditions.id],
  }),
  user: one(users, {
    fields: [feteReviews.userId],
    references: [users.id],
  }),
}));

export const bandReviewsRelations = relations(bandReviews, ({ one }) => ({
  bandTheme: one(bandThemes, {
    fields: [bandReviews.bandThemeId],
    references: [bandThemes.id],
  }),
  user: one(users, {
    fields: [bandReviews.userId],
    references: [users.id],
  }),
}));

export const accommodationReviewsRelations = relations(accommodationReviews, ({ one }) => ({
  accommodation: one(accommodations, {
    fields: [accommodationReviews.accommodationId],
    references: [accommodations.id],
  }),
  user: one(users, {
    fields: [accommodationReviews.userId],
    references: [users.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
}));

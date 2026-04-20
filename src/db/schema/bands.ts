import { pgTable, uuid, text, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import {
  bandCategoryEnum,
  bandSizeEnum,
  bandDemographicEnum,
  costumeStyleEnum,
  costumeTypeEnum,
  markupTypeEnum,
} from "./enums.js";
import { carnivalSeasons } from "./core.js";
import { vendors } from "./vendors.js";

export const bands = pgTable("bands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  vendorId: uuid("vendor_id").references(() => vendors.id),
  category: bandCategoryEnum("category"),
  size: bandSizeEnum("size"),
  demographic: bandDemographicEnum("demographic"),
  costumeStyle: costumeStyleEnum("costume_style"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const bandThemes = pgTable("band_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  bandId: uuid("band_id").notNull().references(() => bands.id),
  carnivalSeasonId: uuid("carnival_season_id").notNull().references(() => carnivalSeasons.id),
  themeName: text("theme_name").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const bandSections = pgTable("band_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  bandThemeId: uuid("band_theme_id").notNull().references(() => bandThemes.id),
  name: text("name").notNull(),
  description: text("description"),
  designer: text("designer"),
  colors: text("colors"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const costumes = pgTable("costumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  bandSectionId: uuid("band_section_id").notNull().references(() => bandSections.id),
  type: costumeTypeEnum("type").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  currency: text("currency").default("TTD"),
  usdSnapshot: decimal("usd_snapshot", { precision: 10, scale: 2 }),
  markupType: markupTypeEnum("markup_type").notNull().default("none"),
  markupValue: decimal("markup_value", { precision: 10, scale: 2 }),
  addOns: text("add_ons"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

// Relations
export const bandsRelations = relations(bands, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [bands.vendorId],
    references: [vendors.id],
  }),
  themes: many(bandThemes),
}));

export const bandThemesRelations = relations(bandThemes, ({ one, many }) => ({
  band: one(bands, {
    fields: [bandThemes.bandId],
    references: [bands.id],
  }),
  carnivalSeason: one(carnivalSeasons, {
    fields: [bandThemes.carnivalSeasonId],
    references: [carnivalSeasons.id],
  }),
  sections: many(bandSections),
}));

export const bandSectionsRelations = relations(bandSections, ({ one, many }) => ({
  bandTheme: one(bandThemes, {
    fields: [bandSections.bandThemeId],
    references: [bandThemes.id],
  }),
  costumes: many(costumes),
}));

export const costumesRelations = relations(costumes, ({ one }) => ({
  bandSection: one(bandSections, {
    fields: [costumes.bandSectionId],
    references: [bandSections.id],
  }),
}));

import { pgTable, uuid, text, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import { vendorTypeEnum } from "./enums.js";

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: vendorTypeEnum("type").notNull(),
  userId: uuid("user_id"),
  website: text("website"),
  contactEmail: text("contact_email"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

// Relations defined here avoid circular imports.
// The userId FK to users is added as a raw reference (not a Drizzle .references())
// because users.ts imports from vendors.ts for the relation definition.
// The FK constraint will still exist in the DB via migration SQL.

export const vendorsRelations = relations(vendors, ({ many }) => ({
  // Reverse relations added by other schema files via relations()
}));

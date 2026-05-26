import { pgTable, uuid, text, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import { vendors } from "./vendors.js";
import { subscriptionPlanEnum, subscriptionStatusEnum } from "./enums.js";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  workosId: text("workos_id").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  subscriptionPlan: subscriptionPlanEnum("subscription_plan").notNull().default("free"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").notNull().default("active"),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const usersRelations = relations(users, ({ one }) => ({
  vendor: one(vendors, {
    fields: [users.id],
    references: [vendors.userId],
  }),
}));

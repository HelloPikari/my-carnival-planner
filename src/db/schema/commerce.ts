import { pgTable, uuid, text, integer, decimal, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { auditColumns } from "./columns.js";
import { subscriptionTierEnum, subscriptionStatusEnum, orderStatusEnum } from "./enums.js";
import { users } from "./users.js";

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: subscriptionTierEnum("tier").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  billingInterval: text("billing_interval").notNull(),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const userSubscriptions = pgTable("user_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  ...auditColumns,
});

export const planEntitlements = pgTable("plan_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  feature: text("feature").notNull(),
  limitType: text("limit_type").notNull(),
  limitValue: integer("limit_value"),
  ...auditColumns,
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  platformCommission: decimal("platform_commission", { precision: 10, scale: 2 }),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  itemType: text("item_type").notNull(),
  itemId: uuid("item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  ...auditColumns,
});

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageableType: text("imageable_type").notNull(),
  imageableId: uuid("imageable_id").notNull(),
  originalUrl: text("original_url").notNull(),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  metadata: jsonb("metadata"),
  ...auditColumns,
});

// Relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptions: many(userSubscriptions),
  entitlements: many(planEntitlements),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const planEntitlementsRelations = relations(planEntitlements, ({ one }) => ({
  plan: one(subscriptionPlans, {
    fields: [planEntitlements.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

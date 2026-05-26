import { pgEnum } from "drizzle-orm/pg-core";

export const carnivalSeasonStatusEnum = pgEnum("carnival_season_status", [
  "planning",
  "active",
  "archived",
]);

export const locationTypeEnum = pgEnum("location_type", [
  "venue",
  "hotel",
  "area",
]);

export const feteCategoryEnum = pgEnum("fete_category", [
  "Fete",
  "Traditional Jouvert",
  "Traditional Carnival Event",
  "Jouvert Style",
]);

export const venueTypeEnum = pgEnum("venue_type", [
  "Resort",
  "Field",
  "Beach",
  "Boat",
  "Stadium",
  "Poolside",
  "Hotel",
  "Waterfront Resort",
  "Road",
  "Restaurant",
  "Street",
  "Golf course",
  "Waterfront",
  "Events Venue",
]);

export const bandCategoryEnum = pgEnum("band_category", [
  "Large",
  "Medium",
  "Mini",
  "Kids Medium Band",
  "Presentation Band",
]);

export const bandSizeEnum = pgEnum("band_size", [
  "Less than 500",
  "500-1500",
  "1500-2500",
  "2500-3500",
  "3500-5000",
  "More than 5000",
]);

export const bandDemographicEnum = pgEnum("band_demographic", [
  "All ages",
  "18-35",
  "25-55",
  "35-55",
]);

export const costumeStyleEnum = pgEnum("costume_style", [
  "Skimpy with fewer cover-up options",
  "Varies with many cover-up options",
  "Full coverage options",
]);

export const vendorTypeEnum = pgEnum("vendor_type", [
  "organizer",
  "band",
  "hotel",
  "designer",
]);

export const costumeTypeEnum = pgEnum("costume_type", [
  "male",
  "female",
  "frontline",
  "backline",
]);

export const markupTypeEnum = pgEnum("markup_type", [
  "none",
  "percentage",
  "flat",
  "fixed",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "pending",
  "approved",
  "flagged",
  "rejected",
]);

export const tripMemberRoleEnum = pgEnum("trip_member_role", [
  "organizer",
  "member",
]);

export const itineraryItemTypeEnum = pgEnum("itinerary_item_type", [
  "fete_edition",
  "band_theme",
  "accommodation",
  "custom",
]);

export const itineraryItemStatusEnum = pgEnum("itinerary_item_status", [
  "interested",
  "booked",
  "paid",
  "confirmed",
]);

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "basic",
  "premium",
]);

export const subscriptionPlanEnum = pgEnum("subscription_plan", [
  "free",
  "pro",
  "premium",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "cancelled",
  "expired",
]);

export const feteEditionStatusEnum = pgEnum("fete_edition_status", [
  "draft",
  "published",
  "cancelled",
  "completed",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "refunded",
  "cancelled",
]);

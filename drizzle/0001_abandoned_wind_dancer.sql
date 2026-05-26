CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'pro', 'premium');--> statement-breakpoint
ALTER TABLE "roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_roles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "roles" CASCADE;--> statement-breakpoint
DROP TABLE "sessions" CASCADE;--> statement-breakpoint
DROP TABLE "user_roles" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "workos_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_plan" "subscription_plan" DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" "subscription_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workos_id_unique" UNIQUE("workos_id");
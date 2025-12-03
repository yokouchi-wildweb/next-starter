CREATE TYPE "public"."user_provider_type" AS ENUM('email', 'local', 'google.com', 'yahoo.com', 'github', 'apple', 'microsoft', 'facebook.com', 'twitter.com', 'line', 'oidc', 'saml', 'custom');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'inactive', 'locked');--> statement-breakpoint
CREATE TYPE "public"."sample_select_enum" AS ENUM('apple', 'orange', 'berry');--> statement-breakpoint
CREATE TYPE "public"."wallet_type_enum" AS ENUM('regular_point', 'temporary_point');--> statement-breakpoint
CREATE TYPE "public"."wallet_change_method" AS ENUM('INCREMENT', 'DECREMENT', 'SET');--> statement-breakpoint
CREATE TYPE "public"."wallet_history_source_type" AS ENUM('user_action', 'admin_action', 'system');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_type" "user_provider_type" NOT NULL,
	"provider_uid" text NOT NULL,
	"email" text,
	"display_name" text,
	"role" "user_role" NOT NULL,
	"local_password" text,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"last_authenticated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_header_logo_image_url" text,
	"admin_header_logo_image_dark_url" text,
	"admin_list_per_page" integer DEFAULT 100 NOT NULL,
	"admin_footer_text" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sample_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sample_category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"number" integer,
	"rich_number" integer,
	"switch" boolean,
	"radio" boolean,
	"select" "sample_select_enum",
	"multi_select" text[] NOT NULL,
	"sale_start_at" timestamp with time zone,
	"date" date,
	"time" time,
	"main_image" text,
	"sub_image" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sample_to_sample_tag" (
	"sample_id" uuid NOT NULL,
	"sample_tag_id" uuid NOT NULL,
	CONSTRAINT "sample_to_sample_tag_sample_id_sample_tag_id_pk" PRIMARY KEY("sample_id","sample_tag_id")
);
--> statement-breakpoint
CREATE TABLE "sample_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "wallet_type_enum" NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"locked_balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallet_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "wallet_type_enum" NOT NULL,
	"change_method" "wallet_change_method" NOT NULL,
	"points_delta" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"source_type" "wallet_history_source_type" NOT NULL,
	"request_batch_id" uuid,
	"reason" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "samples" ADD CONSTRAINT "samples_sample_category_id_sample_categories_id_fk" FOREIGN KEY ("sample_category_id") REFERENCES "public"."sample_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_to_sample_tag" ADD CONSTRAINT "sample_to_sample_tag_sample_id_samples_id_fk" FOREIGN KEY ("sample_id") REFERENCES "public"."samples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sample_to_sample_tag" ADD CONSTRAINT "sample_to_sample_tag_sample_tag_id_sample_tags_id_fk" FOREIGN KEY ("sample_tag_id") REFERENCES "public"."sample_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_histories" ADD CONSTRAINT "wallet_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_type_uid_idx" ON "users" USING btree ("provider_type","provider_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_type_idx" ON "wallets" USING btree ("user_id","type");
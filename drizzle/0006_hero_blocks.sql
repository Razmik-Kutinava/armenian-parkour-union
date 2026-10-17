CREATE TYPE "public"."hero_type" AS ENUM('event', 'presentation', 'video', 'person', 'custom');--> statement-breakpoint
CREATE TABLE "hero_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "hero_type" NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subtitle" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"media_key" text,
	"video_url" text,
	"cta_label" jsonb,
	"cta_url" text,
	"event_id" uuid,
	"person_user_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hero_blocks_event_has_event" CHECK ("hero_blocks"."type" <> 'event' OR "hero_blocks"."event_id" IS NOT NULL),
	CONSTRAINT "hero_blocks_person_has_user" CHECK ("hero_blocks"."type" <> 'person' OR "hero_blocks"."person_user_id" IS NOT NULL),
	CONSTRAINT "hero_blocks_video_has_url" CHECK ("hero_blocks"."type" <> 'video' OR "hero_blocks"."video_url" IS NOT NULL),
	CONSTRAINT "hero_blocks_ends_after_starts" CHECK ("hero_blocks"."starts_at" IS NULL OR "hero_blocks"."ends_at" IS NULL OR "hero_blocks"."ends_at" >= "hero_blocks"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "hero_blocks" ADD CONSTRAINT "hero_blocks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_blocks" ADD CONSTRAINT "hero_blocks_person_user_id_users_id_fk" FOREIGN KEY ("person_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_blocks" ADD CONSTRAINT "hero_blocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hero_blocks_active_sort_idx" ON "hero_blocks" USING btree ("is_active","sort_order");
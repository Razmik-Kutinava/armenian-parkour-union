CREATE TYPE "public"."video_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"platform" text NOT NULL,
	"title" text,
	"event_id" uuid,
	"status" "video_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reject_reason" text,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_platform" CHECK ("videos"."platform" IN ('youtube', 'instagram', 'tiktok', 'other')),
	CONSTRAINT "videos_reject_reason" CHECK (("videos"."status" = 'rejected') = (btrim(coalesce("videos"."reject_reason", '')) <> '')
				AND ("videos"."status" = 'rejected' OR "videos"."reject_reason" IS NULL)),
	CONSTRAINT "videos_reviewed_at" CHECK (("videos"."status" = 'pending') = ("videos"."reviewed_at" IS NULL)),
	CONSTRAINT "videos_hidden_approved" CHECK ("videos"."hidden_at" IS NULL OR "videos"."status" = 'approved')
);
--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "videos_user_id_url_key" ON "videos" USING btree ("user_id","url");--> statement-breakpoint
CREATE INDEX "videos_user_id_idx" ON "videos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "videos_status_created_at_idx" ON "videos" USING btree ("status","created_at");
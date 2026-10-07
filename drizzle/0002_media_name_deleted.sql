ALTER TABLE "media" ADD COLUMN "original_name" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "media" ALTER COLUMN "original_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "deleted_at" timestamp with time zone;

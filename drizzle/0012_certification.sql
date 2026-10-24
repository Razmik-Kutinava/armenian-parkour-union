CREATE TYPE "public"."certificate_kind" AS ENUM('level', 'trainer', 'judge');--> statement-breakpoint
CREATE TYPE "public"."certificate_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."exam_kind" AS ENUM('level_advanced', 'level_pro', 'trainer', 'judge');--> statement-breakpoint
CREATE TYPE "public"."exam_result" AS ENUM('scheduled', 'passed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."staff_kind" AS ENUM('trainer', 'judge');--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "certificate_kind" NOT NULL,
	"level" "membership_level",
	"category" text,
	"number" text NOT NULL,
	"public_token" text NOT NULL,
	"status" "certificate_status" DEFAULT 'active' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"exam_id" uuid,
	"issued_by" uuid NOT NULL,
	"file_key" text,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_number_unique" UNIQUE("number"),
	CONSTRAINT "certificates_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "certificates_level_kind" CHECK (("certificates"."kind" = 'level') = ("certificates"."level" IS NOT NULL) AND "certificates"."level" IS DISTINCT FROM 'novice'),
	CONSTRAINT "certificates_level_no_expiry" CHECK ("certificates"."kind" <> 'level' OR "certificates"."expires_at" IS NULL),
	CONSTRAINT "certificates_revoked_reason" CHECK (("certificates"."status" = 'revoked') = ("certificates"."revoked_at" IS NOT NULL)
				AND ("certificates"."status" <> 'revoked' OR btrim(coalesce("certificates"."revoke_reason", '')) <> ''))
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "exam_kind" NOT NULL,
	"event_id" uuid,
	"scheduled_at" timestamp with time zone,
	"result" "exam_result" DEFAULT 'scheduled' NOT NULL,
	"score" numeric(5, 2),
	"examiner_id" uuid,
	"notes" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "staff_kind" NOT NULL,
	"category" text,
	"license_number" text,
	"bio" jsonb,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_examiner_id_users_id_fk" FOREIGN KEY ("examiner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificates_user_id_idx" ON "certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "certificates_kind_status_idx" ON "certificates" USING btree ("kind","status");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_exam_id_live_key" ON "certificates" USING btree ("exam_id") WHERE "certificates"."exam_id" IS NOT NULL AND "certificates"."status" <> 'revoked';--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_id_level_live_key" ON "certificates" USING btree ("user_id","level") WHERE "certificates"."kind" = 'level' AND "certificates"."status" <> 'revoked';--> statement-breakpoint
CREATE INDEX "exams_user_id_idx" ON "exams" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exams_result_scheduled_at_idx" ON "exams" USING btree ("result","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_user_id_kind_key" ON "staff_profiles" USING btree ("user_id","kind");
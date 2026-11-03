CREATE TYPE "public"."exam_application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "exam_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "exam_kind" NOT NULL,
	"status" "exam_application_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"exam_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_applications_review_note" CHECK ("exam_applications"."status" <> 'rejected' OR btrim(coalesce("exam_applications"."review_note", '')) <> '')
);
--> statement-breakpoint
ALTER TABLE "exam_applications" ADD CONSTRAINT "exam_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_applications" ADD CONSTRAINT "exam_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_applications" ADD CONSTRAINT "exam_applications_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_applications_user_id_kind_key" ON "exam_applications" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_applications_exam_id_key" ON "exam_applications" USING btree ("exam_id") WHERE "exam_applications"."exam_id" is not null;--> statement-breakpoint
CREATE INDEX "exam_applications_status_created_at_idx" ON "exam_applications" USING btree ("status","created_at");
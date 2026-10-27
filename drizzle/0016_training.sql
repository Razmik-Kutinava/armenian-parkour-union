CREATE TYPE "public"."practice_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."training_access_status" AS ENUM('pending', 'approved', 'rejected', 'revoked');--> statement-breakpoint
CREATE TABLE "course_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"topic_id" uuid,
	"title" jsonb NOT NULL,
	"body" jsonb,
	"file_key" text,
	"file_name" text,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "course_lessons_file" CHECK (("course_lessons"."file_key" IS NULL) = ("course_lessons"."file_name" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "course_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" jsonb NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_topics_course_id_id_key" UNIQUE("course_id","id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"exam_kind" "exam_kind" NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"quiz_size" smallint DEFAULT 27 NOT NULL,
	"pass_count" smallint DEFAULT 25 NOT NULL,
	"quiz_minutes" smallint DEFAULT 60 NOT NULL,
	"retake_days" smallint DEFAULT 30 NOT NULL,
	"attempts_limit" smallint DEFAULT 3 NOT NULL,
	"attempts_period_days" smallint DEFAULT 180 NOT NULL,
	"requires_membership" boolean DEFAULT true NOT NULL,
	"min_age" smallint,
	"required_level" "membership_level",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "courses_quiz_numbers" CHECK ("courses"."quiz_size" >= 1 AND "courses"."pass_count" BETWEEN 1 AND "courses"."quiz_size"),
	CONSTRAINT "courses_quiz_minutes_positive" CHECK ("courses"."quiz_minutes" >= 1),
	CONSTRAINT "courses_retake_days_not_negative" CHECK ("courses"."retake_days" >= 0),
	CONSTRAINT "courses_attempts_positive" CHECK ("courses"."attempts_limit" >= 1 AND "courses"."attempts_period_days" >= 1),
	CONSTRAINT "courses_min_age_positive" CHECK ("courses"."min_age" IS NULL OR "courses"."min_age" >= 1)
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"text" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" smallint NOT NULL,
	"source" text,
	"hidden_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_questions_options" CHECK (CASE WHEN jsonb_typeof("quiz_questions"."options") = 'array'
				THEN jsonb_array_length("quiz_questions"."options") BETWEEN 2 AND 6
					AND "quiz_questions"."correct_index" >= 0 AND "quiz_questions"."correct_index" < jsonb_array_length("quiz_questions"."options")
				ELSE false END)
);
--> statement-breakpoint
CREATE TABLE "course_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "training_access_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"extra_attempts" smallint DEFAULT 0 NOT NULL,
	"exam_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_access_exam_id_unique" UNIQUE("exam_id"),
	CONSTRAINT "course_access_course_id_user_id_key" UNIQUE("course_id","user_id"),
	CONSTRAINT "course_access_extra_attempts" CHECK ("course_access"."extra_attempts" >= 0),
	CONSTRAINT "course_access_review_note" CHECK ("course_access"."status" NOT IN ('rejected', 'revoked') OR btrim(coalesce("course_access"."review_note", '')) <> ''),
	CONSTRAINT "course_access_reviewed_at" CHECK (("course_access"."status" = 'pending') = ("course_access"."reviewed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "practice_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"platform" text NOT NULL,
	"status" "practice_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_submissions_platform" CHECK ("practice_submissions"."platform" IN ('youtube', 'google_drive')),
	CONSTRAINT "practice_submissions_review_note" CHECK ("practice_submissions"."status" <> 'rejected' OR btrim(coalesce("practice_submissions"."review_note", '')) <> ''),
	CONSTRAINT "practice_submissions_reviewed_at" CHECK (("practice_submissions"."status" = 'pending') = ("practice_submissions"."reviewed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "practice_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"questions" jsonb NOT NULL,
	"answers" jsonb,
	"total" smallint NOT NULL,
	"pass_count" smallint NOT NULL,
	"correct_count" smallint,
	"passed" boolean,
	"is_extra" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_attempts_questions_array" CHECK (jsonb_typeof("quiz_attempts"."questions") = 'array'),
	CONSTRAINT "quiz_attempts_answers_array" CHECK ("quiz_attempts"."answers" IS NULL OR jsonb_typeof("quiz_attempts"."answers") = 'array'),
	CONSTRAINT "quiz_attempts_counts" CHECK ("quiz_attempts"."total" >= 1 AND "quiz_attempts"."pass_count" BETWEEN 1 AND "quiz_attempts"."total"),
	CONSTRAINT "quiz_attempts_expires_after_start" CHECK ("quiz_attempts"."expires_at" > "quiz_attempts"."started_at"),
	CONSTRAINT "quiz_attempts_result" CHECK (("quiz_attempts"."passed" IS NULL) = ("quiz_attempts"."correct_count" IS NULL)
				AND ("quiz_attempts"."passed" IS NULL) = ("quiz_attempts"."submitted_at" IS NULL)
				AND ("quiz_attempts"."passed" IS NULL OR ("quiz_attempts"."correct_count" BETWEEN 0 AND "quiz_attempts"."total"
					AND "quiz_attempts"."passed" = ("quiz_attempts"."correct_count" >= "quiz_attempts"."pass_count"))))
);
--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_topic_same_course_fk" FOREIGN KEY ("course_id","topic_id") REFERENCES "public"."course_topics"("course_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_topic_same_course_fk" FOREIGN KEY ("course_id","topic_id") REFERENCES "public"."course_topics"("course_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_submissions" ADD CONSTRAINT "practice_submissions_task_id_practice_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."practice_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_submissions" ADD CONSTRAINT "practice_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_submissions" ADD CONSTRAINT "practice_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_tasks" ADD CONSTRAINT "practice_tasks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_lessons_course_id_sort_order_idx" ON "course_lessons" USING btree ("course_id","sort_order");--> statement-breakpoint
CREATE INDEX "quiz_questions_course_id_topic_id_idx" ON "quiz_questions" USING btree ("course_id","topic_id") WHERE "quiz_questions"."hidden_at" IS NULL;--> statement-breakpoint
CREATE INDEX "course_access_status_created_at_idx" ON "course_access" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "practice_submissions_live_key" ON "practice_submissions" USING btree ("task_id","user_id") WHERE "practice_submissions"."status" IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "practice_submissions_status_created_at_idx" ON "practice_submissions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "practice_submissions_user_id_idx" ON "practice_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_running_key" ON "quiz_attempts" USING btree ("course_id","user_id") WHERE "quiz_attempts"."passed" IS NULL;--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_id_course_id_started_at_idx" ON "quiz_attempts" USING btree ("user_id","course_id","started_at" DESC NULLS LAST);
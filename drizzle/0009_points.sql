CREATE TYPE "public"."points_reason" AS ENUM('certificate', 'event_registration', 'event_participation', 'event_place', 'video', 'manual', 'shop_order', 'shop_refund', 'reversal');--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "points_reason" NOT NULL,
	"rule_id" uuid,
	"source_type" text,
	"source_id" uuid,
	"comment" text,
	"reversal_of_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_ledger_delta_non_zero" CHECK ("points_ledger"."delta" <> 0),
	CONSTRAINT "points_ledger_comment_required" CHECK ("points_ledger"."reason" NOT IN ('manual', 'reversal') OR btrim(coalesce("points_ledger"."comment", '')) <> ''),
	CONSTRAINT "points_ledger_reversal_link" CHECK (("points_ledger"."reason" = 'reversal') = ("points_ledger"."reversal_of_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "points_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" jsonb NOT NULL,
	"points" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_rules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_rule_id_points_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."points_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_reversal_of_id_points_ledger_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."points_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_rules" ADD CONSTRAINT "points_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "points_ledger_user_created_idx" ON "points_ledger" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "points_ledger_source_idx" ON "points_ledger" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "points_ledger_source_once_key" ON "points_ledger" USING btree ("user_id","reason","source_type","source_id") WHERE "points_ledger"."reason" NOT IN ('manual', 'reversal') AND "points_ledger"."source_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "points_ledger_reversal_once_key" ON "points_ledger" USING btree ("reversal_of_id") WHERE "points_ledger"."reversal_of_id" IS NOT NULL;--> statement-breakpoint
CREATE TRIGGER "points_ledger_no_update_delete" BEFORE UPDATE OR DELETE ON "points_ledger"
	FOR EACH ROW EXECUTE FUNCTION "forbid_append_only_change"();--> statement-breakpoint
CREATE TRIGGER "points_ledger_no_truncate" BEFORE TRUNCATE ON "points_ledger"
	FOR EACH STATEMENT EXECUTE FUNCTION "forbid_append_only_change"();
CREATE TYPE "public"."perk_kind" AS ENUM('reusable', 'single');--> statement-breakpoint
CREATE TYPE "public"."volunteer_answer" AS ENUM('invited', 'accepted', 'declined', 'expired', 'excused', 'attended', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."volunteer_card_status" AS ENUM('pending', 'active', 'rejected', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."volunteer_request_status" AS ENUM('draft', 'open', 'finished', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."points_reason" ADD VALUE 'volunteer_participation';--> statement-breakpoint
ALTER TYPE "public"."points_reason" ADD VALUE 'volunteer_report';--> statement-breakpoint
CREATE TABLE "partner_cashiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"label" text NOT NULL,
	"invite_token_hash" text,
	"invite_expires_at" timestamp with time zone,
	"device_token_hash" text,
	"bound_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	"disabled_by" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_cashiers_invite_token_hash_unique" UNIQUE("invite_token_hash"),
	CONSTRAINT "partner_cashiers_device_token_hash_unique" UNIQUE("device_token_hash")
);
--> statement-breakpoint
CREATE TABLE "volunteer_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo_key" text,
	"website" text,
	"address" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volunteer_perks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"title" jsonb NOT NULL,
	"terms" jsonb,
	"kind" "perk_kind" NOT NULL,
	"uses_limit" smallint,
	"valid_from" date,
	"valid_until" date,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volunteer_perks_uses_limit" CHECK (("volunteer_perks"."kind" = 'single') = ("volunteer_perks"."uses_limit" IS NOT NULL) AND coalesce("volunteer_perks"."uses_limit", 1) >= 1),
	CONSTRAINT "volunteer_perks_valid_range" CHECK ("volunteer_perks"."valid_from" IS NULL OR "volunteer_perks"."valid_until" IS NULL OR "volunteer_perks"."valid_from" <= "volunteer_perks"."valid_until")
);
--> statement-breakpoint
CREATE TABLE "perk_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"perk_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"cashier_id" uuid,
	"reversal_of_id" uuid,
	"comment" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perk_redemptions_reversal_of_id_unique" UNIQUE("reversal_of_id"),
	CONSTRAINT "perk_redemptions_kind" CHECK (CASE WHEN "perk_redemptions"."reversal_of_id" IS NULL
				THEN "perk_redemptions"."cashier_id" IS NOT NULL AND "perk_redemptions"."comment" IS NULL AND "perk_redemptions"."created_by" IS NULL
				ELSE "perk_redemptions"."cashier_id" IS NULL AND btrim(coalesce("perk_redemptions"."comment", '')) <> ''
					AND "perk_redemptions"."created_by" IS NOT NULL
				END)
);
--> statement-breakpoint
CREATE TABLE "volunteer_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "volunteer_card_status" DEFAULT 'pending' NOT NULL,
	"number" text,
	"public_token" text,
	"applied_at" timestamp with time zone NOT NULL,
	"issued_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"decline_streak" smallint DEFAULT 0 NOT NULL,
	"flagged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volunteer_cards_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "volunteer_cards_number_unique" UNIQUE("number"),
	CONSTRAINT "volunteer_cards_public_token_unique" UNIQUE("public_token"),
	CONSTRAINT "volunteer_cards_decline_streak" CHECK ("volunteer_cards"."decline_streak" >= 0),
	CONSTRAINT "volunteer_cards_review_note" CHECK ("volunteer_cards"."status" NOT IN ('rejected', 'revoked') OR btrim(coalesce("volunteer_cards"."review_note", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "volunteer_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "volunteer_answer" DEFAULT 'invited' NOT NULL,
	"answered_at" timestamp with time zone,
	"marked_by" uuid,
	"marked_at" timestamp with time zone,
	"counted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volunteer_invitations_request_id_user_id_key" UNIQUE("request_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "volunteer_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"file_key" text,
	"url" text,
	"note" text,
	"status" "practice_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volunteer_reports_one_source" CHECK (num_nonnulls("volunteer_reports"."file_key", "volunteer_reports"."url") = 1),
	CONSTRAINT "volunteer_reports_review_note" CHECK ("volunteer_reports"."status" <> 'rejected' OR btrim(coalesce("volunteer_reports"."review_note", '')) <> '')
);
--> statement-breakpoint
CREATE TABLE "volunteer_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb,
	"event_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location" text,
	"places" smallint NOT NULL,
	"respond_by" timestamp with time zone NOT NULL,
	"status" "volunteer_request_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volunteer_requests_times" CHECK ("volunteer_requests"."ends_at" >= "volunteer_requests"."starts_at"),
	CONSTRAINT "volunteer_requests_respond_by" CHECK ("volunteer_requests"."respond_by" <= "volunteer_requests"."starts_at"),
	CONSTRAINT "volunteer_requests_places" CHECK ("volunteer_requests"."places" >= 1)
);
--> statement-breakpoint
ALTER TABLE "partner_cashiers" ADD CONSTRAINT "partner_cashiers_partner_id_volunteer_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."volunteer_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_cashiers" ADD CONSTRAINT "partner_cashiers_disabled_by_users_id_fk" FOREIGN KEY ("disabled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_cashiers" ADD CONSTRAINT "partner_cashiers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_partners" ADD CONSTRAINT "volunteer_partners_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_perks" ADD CONSTRAINT "volunteer_perks_partner_id_volunteer_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."volunteer_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perk_redemptions" ADD CONSTRAINT "perk_redemptions_card_id_volunteer_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."volunteer_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perk_redemptions" ADD CONSTRAINT "perk_redemptions_perk_id_volunteer_perks_id_fk" FOREIGN KEY ("perk_id") REFERENCES "public"."volunteer_perks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perk_redemptions" ADD CONSTRAINT "perk_redemptions_partner_id_volunteer_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."volunteer_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perk_redemptions" ADD CONSTRAINT "perk_redemptions_cashier_id_partner_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."partner_cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perk_redemptions" ADD CONSTRAINT "perk_redemptions_reversal_of_id_perk_redemptions_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."perk_redemptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perk_redemptions" ADD CONSTRAINT "perk_redemptions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_cards" ADD CONSTRAINT "volunteer_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_cards" ADD CONSTRAINT "volunteer_cards_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_invitations" ADD CONSTRAINT "volunteer_invitations_request_id_volunteer_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."volunteer_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_invitations" ADD CONSTRAINT "volunteer_invitations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_invitations" ADD CONSTRAINT "volunteer_invitations_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_reports" ADD CONSTRAINT "volunteer_reports_invitation_id_volunteer_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."volunteer_invitations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_reports" ADD CONSTRAINT "volunteer_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_reports" ADD CONSTRAINT "volunteer_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_requests" ADD CONSTRAINT "volunteer_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_requests" ADD CONSTRAINT "volunteer_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_cashiers_partner_id_idx" ON "partner_cashiers" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "volunteer_partners_status_sort_order_idx" ON "volunteer_partners" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "volunteer_perks_partner_id_status_idx" ON "volunteer_perks" USING btree ("partner_id","status");--> statement-breakpoint
CREATE INDEX "perk_redemptions_card_id_perk_id_idx" ON "perk_redemptions" USING btree ("card_id","perk_id");--> statement-breakpoint
CREATE INDEX "perk_redemptions_partner_id_created_at_idx" ON "perk_redemptions" USING btree ("partner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "perk_redemptions_cashier_id_created_at_idx" ON "perk_redemptions" USING btree ("cashier_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "volunteer_cards_status_applied_at_idx" ON "volunteer_cards" USING btree ("status","applied_at");--> statement-breakpoint
CREATE INDEX "volunteer_cards_flagged_at_idx" ON "volunteer_cards" USING btree ("flagged_at") WHERE "volunteer_cards"."flagged_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "volunteer_invitations_user_id_created_at_idx" ON "volunteer_invitations" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "volunteer_invitations_request_id_status_idx" ON "volunteer_invitations" USING btree ("request_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "volunteer_reports_live_key" ON "volunteer_reports" USING btree ("invitation_id") WHERE "volunteer_reports"."status" IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "volunteer_reports_status_created_at_idx" ON "volunteer_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "volunteer_reports_user_id_idx" ON "volunteer_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "volunteer_requests_status_respond_by_idx" ON "volunteer_requests" USING btree ("status","respond_by");--> statement-breakpoint
CREATE INDEX "volunteer_requests_event_id_idx" ON "volunteer_requests" USING btree ("event_id");--> statement-breakpoint
CREATE TRIGGER "perk_redemptions_no_update_delete" BEFORE UPDATE OR DELETE ON "perk_redemptions"
	FOR EACH ROW EXECUTE FUNCTION "forbid_append_only_change"();--> statement-breakpoint
CREATE TRIGGER "perk_redemptions_no_truncate" BEFORE TRUNCATE ON "perk_redemptions"
	FOR EACH STATEMENT EXECUTE FUNCTION "forbid_append_only_change"();
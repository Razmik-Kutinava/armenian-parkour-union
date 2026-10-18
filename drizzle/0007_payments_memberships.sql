CREATE TYPE "public"."membership_status" AS ENUM('pending', 'active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('membership', 'donation', 'event_fee');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TABLE "donation_purposes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "membership_status" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_ends_after_starts" CHECK ("memberships"."starts_at" IS NULL OR "memberships"."ends_at" IS NULL OR "memberships"."ends_at" >= "memberships"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" "payment_kind" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"provider" text NOT NULL,
	"provider_payment_id" text,
	"provider_payload" jsonb,
	"donation_purpose_id" uuid,
	"donor_name" text,
	"donor_email" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"receipt_url" text,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"confirmed_by" uuid,
	"expires_at" timestamp with time zone,
	"failure_reason" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_minor" > 0)
);
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_donation_purpose_id_donation_purposes_id_fk" FOREIGN KEY ("donation_purpose_id") REFERENCES "public"."donation_purposes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_status_ends_at_idx" ON "memberships" USING btree ("status","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_key" ON "payment_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments" USING btree ("provider","provider_payment_id") WHERE "payments"."provider_payment_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_kind_status_idx" ON "payments" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "payments_status_expires_at_idx" ON "payments" USING btree ("status","expires_at");--> statement-breakpoint
CREATE FUNCTION "payment_webhook_events_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'UPDATE'
		AND NEW.id = OLD.id AND NEW.provider = OLD.provider AND NEW.event_id = OLD.event_id
		AND NEW.payload = OLD.payload AND NEW.created_at = OLD.created_at THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'payment_webhook_events: only processed_at and error can change, % is not allowed', TG_OP
		USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "payment_webhook_events_guard" BEFORE UPDATE OR DELETE ON "payment_webhook_events"
	FOR EACH ROW EXECUTE FUNCTION "payment_webhook_events_guard"();--> statement-breakpoint
CREATE TRIGGER "payment_webhook_events_no_truncate" BEFORE TRUNCATE ON "payment_webhook_events"
	FOR EACH STATEMENT EXECUTE FUNCTION "forbid_append_only_change"();
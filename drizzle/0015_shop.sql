CREATE TYPE "public"."order_status" AS ENUM('new', 'confirmed', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TABLE "shop_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_points" integer NOT NULL,
	"options" jsonb,
	"stock" integer,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_items_slug_unique" UNIQUE("slug"),
	CONSTRAINT "shop_items_price_positive" CHECK ("shop_items"."price_points" > 0),
	CONSTRAINT "shop_items_stock_not_negative" CHECK ("shop_items"."stock" IS NULL OR "shop_items"."stock" >= 0),
	CONSTRAINT "shop_items_image_keys_array" CHECK (jsonb_typeof("shop_items"."image_keys") = 'array'),
	CONSTRAINT "shop_items_options_object" CHECK ("shop_items"."options" IS NULL OR jsonb_typeof("shop_items"."options") = 'object')
);
--> statement-breakpoint
CREATE TABLE "shop_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"selected_options" jsonb,
	"quantity" integer NOT NULL,
	"price_points_snapshot" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_order_items_quantity_positive" CHECK ("shop_order_items"."quantity" > 0),
	CONSTRAINT "shop_order_items_price_positive" CHECK ("shop_order_items"."price_points_snapshot" > 0),
	CONSTRAINT "shop_order_items_options_object" CHECK ("shop_order_items"."selected_options" IS NULL OR jsonb_typeof("shop_order_items"."selected_options") = 'object')
);
--> statement-breakpoint
CREATE TABLE "shop_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"total_points" integer NOT NULL,
	"ledger_id" uuid,
	"recipient_name" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"comment" text,
	"tracking_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_orders_number_unique" UNIQUE("number"),
	CONSTRAINT "shop_orders_ledger_id_unique" UNIQUE("ledger_id"),
	CONSTRAINT "shop_orders_total_positive" CHECK ("shop_orders"."total_points" > 0)
);
--> statement-breakpoint
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_ledger_id_points_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."points_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shop_order_items_order_id_idx" ON "shop_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shop_orders_user_id_idx" ON "shop_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shop_orders_status_created_at_idx" ON "shop_orders" USING btree ("status","created_at");
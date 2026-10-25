-- Manual rollback of drizzle/0015_shop.sql. Loses every shop item and order (their shop_order /
-- shop_refund entries stay in points_ledger, it is append-only): run only with owner "go", after the
-- code no longer reads the tables.
-- After running, remove the 0015 row from drizzle.__drizzle_migrations and the 0015 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "shop_order_items";
DROP TABLE IF EXISTS "shop_orders";
DROP TABLE IF EXISTS "shop_items";
DROP TYPE IF EXISTS "order_status";
COMMIT;

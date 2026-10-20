-- Manual rollback of drizzle/0009_points.sql. Loses every points rule and ledger entry and resets
-- the cached balances (nothing backs them without the ledger): run only with owner "go".
-- Keeps "forbid_append_only_change"() — audit_log and payment_webhook_events use it.
-- After running, remove the 0009 row from drizzle.__drizzle_migrations and the 0009 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "points_ledger";
DROP TABLE IF EXISTS "points_rules";
DROP TYPE IF EXISTS "points_reason";
UPDATE "users" SET "points_balance" = 0 WHERE "points_balance" <> 0;
COMMIT;

-- Manual rollback of drizzle/0007_payments_memberships.sql. Loses every payment, membership,
-- webhook event and donation purpose: run only with owner "go".
-- After running, remove the 0007 row from drizzle.__drizzle_migrations and the 0007 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "payment_webhook_events";
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "memberships";
DROP TABLE IF EXISTS "donation_purposes";
DROP FUNCTION IF EXISTS "payment_webhook_events_guard"();
DROP TYPE IF EXISTS "payment_status";
DROP TYPE IF EXISTS "payment_kind";
DROP TYPE IF EXISTS "membership_status";
COMMIT;

-- Manual rollback of drizzle/0008_membership_reminders.sql. Loses only the "ends soon" letter marks
-- (the daily job may send those letters again): run only with owner "go".
-- After running, remove the 0008 row from drizzle.__drizzle_migrations and the 0008 entry from drizzle/meta.
BEGIN;
ALTER TABLE "memberships" DROP COLUMN IF EXISTS "reminded_7_at";
ALTER TABLE "memberships" DROP COLUMN IF EXISTS "reminded_30_at";
COMMIT;

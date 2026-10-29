-- Manual rollback of drizzle/0017_users_privacy_deletion.sql. Loses the privacy choices (photos and
-- cities stay hidden anyway) and pending deletion requests: run only with owner "go", after the code
-- no longer reads the columns.
-- After running, remove the 0017 row from drizzle.__drizzle_migrations and the 0017 entry from drizzle/meta.
BEGIN;
ALTER TABLE "users" DROP COLUMN IF EXISTS "deletion_requested_at";
ALTER TABLE "users" DROP COLUMN IF EXISTS "show_avatar";
ALTER TABLE "users" DROP COLUMN IF EXISTS "show_city";
COMMIT;

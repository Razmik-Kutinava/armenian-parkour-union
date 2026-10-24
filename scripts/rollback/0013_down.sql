-- Manual rollback of drizzle/0013_certificate_reminders.sql. Loses only the marks of letters already
-- sent (a rerun of the daily job sends the current reminder again): run only with owner "go", after
-- the code no longer reads the column.
-- After running, remove the 0013 row from drizzle.__drizzle_migrations and the 0013 entry from drizzle/meta.
BEGIN;
ALTER TABLE "certificates" DROP COLUMN IF EXISTS "reminded_days";
COMMIT;

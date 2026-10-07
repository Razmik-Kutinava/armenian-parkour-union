-- Manual rollback of drizzle/0002_media_name_deleted.sql. Loses file names and delete marks: run only with owner "go".
-- After running, remove the 0002 row from drizzle.__drizzle_migrations and the 0002 entry from drizzle/meta.
BEGIN;
ALTER TABLE "media" DROP COLUMN IF EXISTS "deleted_at", DROP COLUMN IF EXISTS "original_name";
COMMIT;

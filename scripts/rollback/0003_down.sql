-- Manual rollback of drizzle/0003_pages.sql. Loses every page: run only with owner "go".
-- After running, remove the 0003 row from drizzle.__drizzle_migrations and the 0003 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "pages";
DROP TYPE IF EXISTS "content_status";
COMMIT;

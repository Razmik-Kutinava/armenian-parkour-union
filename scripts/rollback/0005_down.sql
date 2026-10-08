-- Manual rollback of drizzle/0005_events.sql. Loses every event and category: run only with owner "go".
-- After running, remove the 0005 row from drizzle.__drizzle_migrations and the 0005 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "event_categories";
DROP TABLE IF EXISTS "events";
DROP TYPE IF EXISTS "discipline";
DROP TYPE IF EXISTS "event_status";
COMMIT;

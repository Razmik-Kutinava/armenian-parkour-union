-- Manual rollback of drizzle/0006_hero_blocks.sql. Loses every hero block: run only with owner "go".
-- After running, remove the 0006 row from drizzle.__drizzle_migrations and the 0006 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "hero_blocks";
DROP TYPE IF EXISTS "hero_type";
COMMIT;

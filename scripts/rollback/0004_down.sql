-- Manual rollback of drizzle/0004_posts.sql. Loses every news post: run only with owner "go".
-- After running, remove the 0004 row from drizzle.__drizzle_migrations and the 0004 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "posts";
COMMIT;

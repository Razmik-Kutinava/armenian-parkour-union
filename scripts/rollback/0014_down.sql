-- Manual rollback of drizzle/0014_videos.sql. Loses every video link with its review (points already
-- written for approved videos stay in points_ledger): run only with owner "go", after the code no
-- longer reads the table.
-- After running, remove the 0014 row from drizzle.__drizzle_migrations and the 0014 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "videos";
DROP TYPE IF EXISTS "video_status";
COMMIT;

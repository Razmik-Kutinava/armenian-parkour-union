-- Manual rollback of drizzle/0019_exam_applications.sql. Loses every exam application row:
-- run only with owner "go", after the code no longer reads the table.
-- After running, remove the 0019 row from drizzle.__drizzle_migrations and the 0019 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "exam_applications";
DROP TYPE IF EXISTS "exam_application_status";
COMMIT;

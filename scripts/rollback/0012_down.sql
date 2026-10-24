-- Manual rollback of drizzle/0012_certification.sql. Loses every exam, certificate and staff profile
-- (levels already set on users stay): run only with owner "go", after the code no longer reads these tables.
-- After running, remove the 0012 row from drizzle.__drizzle_migrations and the 0012 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "certificates";
DROP TABLE IF EXISTS "exams";
DROP TABLE IF EXISTS "staff_profiles";
DROP TYPE IF EXISTS "certificate_kind";
DROP TYPE IF EXISTS "certificate_status";
DROP TYPE IF EXISTS "exam_kind";
DROP TYPE IF EXISTS "exam_result";
DROP TYPE IF EXISTS "staff_kind";
COMMIT;

-- Manual rollback of drizzle/0011_registrations_consents.sql. Loses every event registration (with
-- results) and consent: run only with owner "go", after the code no longer reads these tables.
-- After running, remove the 0011 row from drizzle.__drizzle_migrations and the 0011 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "event_registrations";
DROP TABLE IF EXISTS "consents";
DROP TYPE IF EXISTS "registration_status";
DROP TYPE IF EXISTS "consent_status";
DROP TYPE IF EXISTS "consent_kind";
COMMIT;

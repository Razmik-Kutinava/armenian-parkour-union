-- Manual rollback of drizzle/0001_stage1_users_auth_audit.sql. Destroys data: run only with owner "go".
-- After running, remove the 0001 row from drizzle.__drizzle_migrations and the 0001 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "audit_log", "media", "site_settings", "rate_limit", "verification", "session", "account", "users";
DROP FUNCTION IF EXISTS "forbid_append_only_change"();
DROP TYPE IF EXISTS "user_status", "user_role", "membership_level";
COMMIT;

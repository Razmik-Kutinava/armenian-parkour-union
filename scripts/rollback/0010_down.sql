-- Manual rollback of drizzle/0010_payments_locale.sql. Loses only the stored payment languages (guest
-- letters go back to English): run only with owner "go", after the code no longer reads the column.
-- After running, remove the 0010 row from drizzle.__drizzle_migrations and the 0010 entry from drizzle/meta.
BEGIN;
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_locale_valid";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "locale";
COMMIT;

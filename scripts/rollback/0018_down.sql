-- Manual rollback of drizzle/0018_volunteer.sql. Loses every partner, perk, cashier access, card,
-- perk redemption, volunteer request, invitation and report (volunteer_participation /
-- volunteer_report entries stay in points_ledger, it is append-only): run only with owner "go",
-- after the code no longer reads the tables.
-- The points_reason values volunteer_participation and volunteer_report stay: PostgreSQL cannot
-- drop an enum value, and ledger rows using them cannot be deleted.
-- After running, remove the 0018 row from drizzle.__drizzle_migrations and the 0018 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "volunteer_reports";
DROP TABLE IF EXISTS "volunteer_invitations";
DROP TABLE IF EXISTS "volunteer_requests";
DROP TABLE IF EXISTS "perk_redemptions";
DROP TABLE IF EXISTS "volunteer_cards";
DROP TABLE IF EXISTS "partner_cashiers";
DROP TABLE IF EXISTS "volunteer_perks";
DROP TABLE IF EXISTS "volunteer_partners";
DROP TYPE IF EXISTS "volunteer_answer";
DROP TYPE IF EXISTS "volunteer_request_status";
DROP TYPE IF EXISTS "perk_kind";
DROP TYPE IF EXISTS "volunteer_card_status";
COMMIT;

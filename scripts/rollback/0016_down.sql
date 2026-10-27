-- Manual rollback of drizzle/0016_training.sql. Loses every course, lesson, question, access row,
-- quiz attempt and practice submission (exams created by finished courses stay in exams): run only
-- with owner "go", after the code no longer reads the tables.
-- After running, remove the 0016 row from drizzle.__drizzle_migrations and the 0016 entry from drizzle/meta.
BEGIN;
DROP TABLE IF EXISTS "practice_submissions";
DROP TABLE IF EXISTS "practice_tasks";
DROP TABLE IF EXISTS "quiz_attempts";
DROP TABLE IF EXISTS "course_access";
DROP TABLE IF EXISTS "quiz_questions";
DROP TABLE IF EXISTS "course_lessons";
DROP TABLE IF EXISTS "course_topics";
DROP TABLE IF EXISTS "courses";
DROP TYPE IF EXISTS "practice_status";
DROP TYPE IF EXISTS "training_access_status";
COMMIT;

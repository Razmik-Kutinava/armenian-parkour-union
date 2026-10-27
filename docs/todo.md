# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

**9.1** (`09` этап 9): таблицы обучающего портала одной миграцией — `courses`, `course_topics`, `course_lessons`, `quiz_questions`, `course_access`, `quiz_attempts`, `practice_tasks`, `practice_submissions` + enum `training_access_status`, `practice_status`.

Граница: только схема, миграция 0016, откат и тесты схемы. Админка курсов и тем — 9.2; банк вопросов и импорт — 9.3; заявки — 9.4; уроки — 9.5; тест — 9.6; практика — 9.7; завершение курса — 9.8; контент — 9.9; тесты этапа — 9.10. Права `training.*` и seed курса — не здесь.

Факты из документов (`02` § 11, `03` § 18 — прочитаны, выписано):
- Многоязычные поля — `jsonb {en, hy, ru}`, обязателен хотя бы один любой язык (проверяет сервис, как у прочих таблиц).
- `courses`: `slug` unique, `exam_kind`, `status content_status` default `draft`, `quiz_size` 27, `pass_count` 25 (`1 ≤ pass_count ≤ quiz_size`), `quiz_minutes` 60, `retake_days` 30, `attempts_limit` 3, `attempts_period_days` 180, `requires_membership` true, `min_age` null, `required_level membership_level` null.
- `course_topics`: `hidden_at` — тема не в тесте и не в портале; `sort_order`.
- `course_lessons`: `topic_id` null, `body` jsonb null, `file_key` / `file_name` (PDF в приватном бакете), `status`, `created_by`, `deleted_at`; индекс (`course_id`, `sort_order`).
- `quiz_questions`: вопрос не удаляется, скрывается; `options` — массив 2–6, `correct_index` с 0 внутри массива; индекс (`course_id`, `topic_id`) where `hidden_at is null`.
- `course_access`: одна строка на (курс, участник), повторная заявка — та же строка в `pending`; `review_note` обязательна при `rejected` / `revoked`; `extra_attempts` default 0; `exam_id` unique — экзамен дважды не создаётся (`03` 18.5); индекс (`status`, `created_at`).
- `quiz_attempts`: снимок вопросов с `correct_index`; `passed null` — идёт; одна идущая — unique(`course_id`, `user_id`) where `passed is null`; индекс (`user_id`, `course_id`, `started_at desc`); `updated_at` в `02` нет.
- `practice_submissions`: только ссылка, `platform` `youtube` | `google_drive`; `review_note` обязателен при `rejected`; одна живая — unique(`task_id`, `user_id`) where `status in ('pending','approved')`; индексы (`status`, `created_at`), `user_id`.

## Решения (агент, по `02` § 11 и образцам 0012–0015) — входят в «go»

1. **NOT NULL сверх `02`** (как 6.1, 7.3): `courses.title` (description default `{}`), `status` всех таблиц, `sort_order` default 0, `is_extra`, `extra_attempts`; `quiz_attempts.started_at` default `now()`. `created_by` / `reviewed_by` — null (= «система», общее соглашение `02`).
2. **Check-и `courses`:** `quiz_size ≥ 1`, `1 ≤ pass_count ≤ quiz_size`, `quiz_minutes ≥ 1`, `retake_days ≥ 0`, `attempts_limit ≥ 1`, `attempts_period_days ≥ 1`, `min_age` null или ≥ 1.
3. **Тема — того же курса:** `course_topics` unique(`course_id`, `id`); `quiz_questions` и `course_lessons` ссылаются составным FK (`course_id`, `topic_id`) → `course_topics` (у урока `topic_id` null — не проверяется). Вопрос или урок с темой чужого курса база не примет.
4. **Check-и вопросов:** `options` — массив из 2–6 элементов, `0 ≤ correct_index < длины` (через `CASE`, чтобы не-массив давал `23514`, а не ошибку функции).
5. **Check-и уроков:** `file_key` и `file_name` — оба или ни одного.
6. **Check-и `course_access`:** `extra_attempts ≥ 0`; `rejected` / `revoked` ⇒ непустая `review_note` (как `certificates_revoked_reason`); `pending` ⇔ `reviewed_at is null` (повторная заявка обязана сбросить прошлое решение).
7. **Check-и `quiz_attempts`:** `questions` — массив, `answers` — массив или null; `total ≥ 1`, `1 ≤ pass_count ≤ total`; `expires_at > started_at`; `passed`, `correct_count`, `submitted_at` — все null (идёт) или все заполнены; `0 ≤ correct_count ≤ total`; `passed = (correct_count ≥ pass_count)`.
8. **Check-и `practice_submissions`:** `platform in ('youtube','google_drive')`; `rejected` ⇒ непустой `review_note`; `pending` ⇔ `reviewed_at is null`. `practice_tasks.description` — not null (по `02`).
9. **Связи без каскада:** курсы, темы, задания не удаляются (скрытие / статус), участник с попытками и отправками не удаляется жёстко (мягкое удаление), экзамен с `course_access.exam_id` не удаляется. Индексы — только из `02` (+ unique из решения 3).
10. **Файлы схемы** (лимит 200 строк): `schema/training.ts` — курсы, темы, уроки, вопросы; `schema/training-progress.ts` — доступ, попытки, задания, отправки. Тесты так же на два файла.

## Миграция 0016 (Migration Gate — ждёт «go»)

`drizzle/0016_training.sql` (через `npm run db:generate`):
- `CREATE TYPE training_access_status AS ENUM ('pending','approved','rejected','revoked')`, `CREATE TYPE practice_status AS ENUM ('pending','approved','rejected')`.
- `CREATE TABLE` восьми таблиц `02` § 11 с решениями 1–9; FK на `users`, `exams` и между собой; индексы и частичные unique из `02`.
- Существующие таблицы, enum и данные не меняются; на проде таблиц нет до деплоя этапа 9.

Откат — `scripts/rollback/0016_down.sql`: `DROP TABLE` `practice_submissions`, `practice_tasks`, `quiz_attempts`, `course_access`, `quiz_questions`, `course_lessons`, `course_topics`, `courses`; `DROP TYPE practice_status`, `training_access_status` (только по «go»; теряется весь контент и история портала, экзамены в `exams` остаются), затем убрать строку 0016 из `drizzle.__drizzle_migrations` и из `drizzle/meta`. Применение на dev — `npm run db:migrate`; прод — деплой этапа 9 (`release_command`).

## Файлы (ожидаемо)

- `src/lib/server/db/schema/enums.ts`, `schema/index.ts` — два enum, экспорт.
- `src/lib/server/db/schema/training.ts`, `schema/training-progress.ts` — восемь таблиц.
- `drizzle/0016_training.sql`, `drizzle/meta/*`, `scripts/rollback/0016_down.sql` — миграция и откат.
- `src/lib/server/db/training-schema.test.ts`, `training-progress-schema.test.ts` — тесты схемы по образцу `shop-schema.test.ts` (в транзакции с откатом): умолчания, check-и, unique и частичные unique, тема чужого курса, нет жёсткого удаления.

## Не ломать

- Миграции 0000–0015 и тесты схемы `src/lib/server/db/*-schema.test.ts`.
- `exams`, `certificates` и их проверки (6.1) — без изменений; `exam_kind`, `membership_level`, `content_status` — без новых значений.
- Удаление тестовых пользователей в e2e `global-setup.ts` — мягкое, новые FK его не задевают.

## Проверка

- `npx vitest run src/lib/server/db` → PASS (новые и прежние тесты схемы).
- `npm run check`, `npm run lint`.

## Риск

`high` — миграция (`drizzle/*.sql`).

## Читать

- `02` § 11 и enum (выписано), `03` § 18 (выписано), `zone-notes.md` § «Экзамены и сертификаты» (прочитано: `exams` из 6.1, `exam_id` у сертификата).

## Фазы

- [x] SPEC
- [ ] «go» на миграцию 0016, решения 1–10
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

3.1 Таблицы `memberships`, `payments`, `payment_webhook_events`, `donation_purposes` (`02` разд. 2, 4). Только схема и миграция 0007; сервисы — 3.2+.

## Migration Gate — 0007 (ждёт «go»)

Что меняется (только добавление, существующие таблицы не трогаются):

- enum `membership_status` (`pending`, `active`, `expired`, `cancelled`), `payment_kind` (`membership`, `donation`, `event_fee`), `payment_status` (`pending`, `paid`, `failed`, `cancelled`, `refunded`) — по `02` «Enum-типы».
- `donation_purposes`: `id`, `title jsonb not null`, `is_active bool default true`, `sort_order int default 0`, `created_at`, `updated_at`.
- `memberships`: `id`, `user_id → users not null`, `status default 'pending'`, `starts_at`, `ends_at`, `payment_id → payments null`, `created_at`, `updated_at`; индексы `user_id`, (`status`, `ends_at`); check `ends_at >= starts_at`.
- `payments`: все поля `02` разд. 4 (`user_id` null, `kind`, `status default 'pending'`, `amount_minor int not null check > 0`, `currency char(3) not null`, `provider text not null`, `provider_payment_id`, `provider_payload jsonb`, `donation_purpose_id`, `donor_name`, `donor_email`, `is_anonymous default false`, `receipt_url`, `paid_at`, `refunded_at`, `confirmed_by → users`, `expires_at`, `failure_reason`, `needs_review default false`, `membership_id → memberships`, `created_at`, `updated_at`); unique (`provider`, `provider_payment_id`) where not null; индексы `user_id`, (`kind`, `status`), `paid_at`, (`status`, `expires_at`).
- `payment_webhook_events`: `id`, `provider text not null`, `event_id text not null`, `payload jsonb not null`, `processed_at`, `error`, `created_at`; unique (`provider`, `event_id`); триггер: DELETE / TRUNCATE запрещены, UPDATE — только `processed_at` и `error` (вопрос в `questions.md`).
- FK `memberships.payment_id` ↔ `payments.membership_id` — взаимные (так в `02`), добавляются после создания обеих таблиц.

Откат: `scripts/rollback/0007_down.sql` — `DROP` четырёх таблиц, функции триггера и трёх enum (новые таблицы пусты до 3.3; на проде — только по «go»).

## Файлы (ожидаемо)

- `src/lib/server/db/schema/payments.ts` (+ enums в `enums.ts`, экспорт в `index.ts`)
- `drizzle/0007_*.sql` (+ триггер вручную в той же миграции, как `0001`), `drizzle/meta/*`
- `scripts/rollback/0007_down.sql`
- `src/lib/server/db/schema.test.ts` (или рядом) — тесты ограничений в транзакции с откатом

## Не ломать

- Миграции 0000–0006 и их тесты; `db:seed` (назначения донатов — в 3.7, список ждёт владельца: `02` «уточнить» п. 3)

## Проверка

- `npx vitest --run src/lib/server/db`

## Риск

`high` — `drizzle/*.sql`, платежи.

## Фазы

- [x] SPEC
- [ ] Migration Gate «go»
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

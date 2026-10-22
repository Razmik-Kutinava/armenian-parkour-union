# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`.

## Задача

Долг 3.7 (вопрос этапа 3 в `questions.md`): письмо гостю после доната всегда на английском. Владелец 2026-10-22: «делаем» — поле `payments.locale`.

Сейчас: `recipient()` (`donations/mail.ts`) гостю ставит `'en'` — в `payments` языка нет. Язык страницы оплаты уже приходит в `startOnlinePayment` (`input.locale`), но не сохраняется.

Решение:
- `payments.locale text null`, check `locale is null or locale in ('en','hy','ru')` (как у `users.locale`).
- `startOnlinePayment` пишет `locale = input.locale` для любого онлайн-платежа (взнос, донат; дальше `event_fee`).
- `recipient()`: гость — `payment.locale`, если это язык сайта, иначе `'en'`. Участник — по-прежнему `users.locale` (`07` § 5.2 п. 4: участник — по аккаунту).
- Тот же `recipient()` у письма о возврате (`refund-letter.ts`) — гость получит и его на своём языке.
- Ручной платёж админа (`admin/manual.ts`) — языка не знаем, `null` → `'en'` (поле языка в форму не добавляем).
- Старые платежи — `null` → `'en'`, без заполнения задним числом.

## Миграция (Migration Gate — ждёт «go»)

`drizzle/0010_payments_locale.sql` (генерирует `drizzle-kit generate`):
```sql
ALTER TABLE "payments" ADD COLUMN "locale" text;
ALTER TABLE "payments" ADD CONSTRAINT "payments_locale_check" CHECK ("payments"."locale" IS NULL OR "payments"."locale" IN ('en', 'hy', 'ru'));
```
Не деструктивная: колонка необязательная, без default и без перезаписи строк; блокировка `payments` — на мгновение (без проверки старых строк долгой нет — все `null`).

Откат `scripts/rollback/0010_down.sql` (только по «go»): `DROP CONSTRAINT IF EXISTS payments_locale_check`, `DROP COLUMN IF EXISTS locale`, затем убрать строку 0010 из `drizzle.__drizzle_migrations` и запись из `drizzle/meta`. Теряются только сохранённые языки — письма гостям снова на EN. Код отката: вернуть `recipient()` к `'en'` до отката базы.

Применение: dev — `npm run db:migrate` после «go»; прод — Deploy (`release_command`) по апруву владельца.

## Файлы (ожидаемо)

- `src/lib/server/db/schema/payments.ts` — колонка и check.
- `drizzle/0010_payments_locale.sql`, `drizzle/meta/*` — миграция; `scripts/rollback/0010_down.sql` — откат.
- `src/lib/server/services/payments/create.ts` — запись `locale`.
- `src/lib/server/services/donations/mail.ts` — язык гостя из платежа.
- Тесты: `donations/effects.test.ts` (письмо гостю на `hy` / `ru`, `null` → EN, участник — язык аккаунта), `payments/create.test.ts` (язык сохранён), `payments/refund-letter.test.ts` (возврат гостю на его языке).
- Docs: `02` § 4 `payments` — строка `locale`; `questions.md` (вопрос 3 этапа 3 — решён), `decisions.md`.

## Не ломать

- Письмо участнику — на языке аккаунта, удалённому — не уходит (`07` § 5.2 п. 4).
- Создание доната и взноса: сумма с сервера, повторное использование `pending` (`reuse.ts`), блокировка двойного клика.
- Письмо о возврате любому виду платежа (`withRefundLetter`).
- Ручной платёж админа (гость без языка — письмо на EN).

## Проверка

- `npx vitest run src/lib/server/services/donations src/lib/server/services/payments`
- e2e `tests/e2e/donate.spec.ts`, `membership.spec.ts`

## Риск

`high` — миграция и платежи → `bugbot` + `security-review`.

## Читать

- `07` § 5.2 (донат: письмо, участник / гость) — прочитан.
- `02` § 4 `payments` — прочитан.

## Фазы

- [x] SPEC
- [ ] «go» на миграцию
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

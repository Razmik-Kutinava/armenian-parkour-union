# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`.

## Задача

5.1 — таблицы `event_registrations` и `consents` (миграция 0011). «go» владельца 2026-10-22.

Решения владельца (2026-10-22): статус `pending_payment` + поле `event_registrations.hold_until` (одно поле — и удержание места при оплате, и срок оплаты после очереди); `consents.review_note` (причина отказа); `consents.updated_at`. Индекс `payment_id` и проверку `place >= 1` — не добавлять.

## Migration Gate

- Меняется: enum `registration_status` (`registered`, `pending_payment`, `waitlist`, `cancelled`, `attended`, `no_show`), `consent_kind`, `consent_status`; таблицы `event_registrations` (unique(`event_id`, `user_id`), индексы `user_id`, (`event_id`, `status`); FK без каскада), `consents` (индексы `user_id`, (`kind`, `status`)).
- Откат: `scripts/rollback/0011_down.sql` — `DROP TABLE` обеих, `DROP TYPE` трёх; только по «go». Таблицы новые — на момент деплоя пусты.
- Применить: `parkour_dev`; прод — Deploy по апруву.

## Файлы (ожидаемо)

- `src/lib/server/db/schema/enums.ts` — три enum
- `src/lib/server/db/schema/registrations.ts`, `consents.ts`, `index.ts` — таблицы
- `drizzle/0011_registrations_consents.sql`, `scripts/rollback/0011_down.sql`
- `src/lib/server/db/registrations-schema.test.ts` — тесты схемы
- `docs/02-DATABASE.md` §§ Enum, 3, 9 — поля по решению

## Не ломать

- Удаление категории без регистраций (`services/events/categories.ts`) — работает как раньше; с регистрациями база не даст (FK), понятный отказ — 5.3 / 5.7.
- Существующие миграции 0000–0010 и их тесты схемы.

## Проверка

- `npx vitest --run src/lib/server/db`
- `npm run check`, `npm run lint`

## Риск

`high` (миграция).

## Читать

`02` § Enum, 3, 9 · `03` § 7, 13, 17 · `07` § 5.3 · `05` § 5, 10 · `06` § 5.10

## Фазы

- [x] SPEC
- [x] RED (`test: … [RED]`) — `2111929`, 5/5 падают: таблиц нет
- [x] GREEN (`feat: … [GREEN]`) — 0011 на `parkour_dev`; `src/lib/server/db` 23/23
- [x] REGRESS — Vitest 950/950, `check` 0, `lint` чистый
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

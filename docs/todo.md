# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

3.5 — фоновая сверка и истечение платежей (`07` § 7 п. 2, 3, 5), запуск по расписанию. Миграции нет.

Запуск (решение владельца 2026-10-19, гибрид): таймер в процессе каждые 5 мин, пока машина не спит (первый прогон через 30 с после старта), + GitHub Actions раз в час → `POST /api/cron/payments` с `Authorization: Bearer $CRON_SECRET` (догоняет, пока сайт спит).

Правила сверки:
- Кандидаты: `pending`, есть `provider_payment_id`, `created_at` в [now − 1 сут; now − 2 мин], старые первыми, не больше 100 за прогон.
- Провайдер — `providerById(payments.provider)`; не онлайн / нет (mock вне dev) — пропуск.
- `getStatus` → `applyProviderStatus` (тот же путь, что вебхук: сумма, переходы, эффекты, аудит без исполнителя).
- Срок `expires_at` истёк и провайдер говорит `pending` или `not_found` → `cancelled`, `failure_reason = 'expired'`, эффекты `cancelled` в той же транзакции, аудит `payment.status` без исполнителя. Провайдер недоступен — не отменять (вдруг оплачен), повтор в следующий прогон.
- `pending` старше суток (сверка не помогла, `07` § 8) — `needs_review = true` один раз + аудит; дальше не проверяется (админ — 3.9).
- Одна ошибка платежа не останавливает прогон; итог — счётчики `{ checked, applied, expired, flagged, failed }` + строка в лог. В процессе прогоны не перекрываются (single-flight); между машинами — идемпотентность через `FOR UPDATE` в `apply` / `expire`.
- `POST /api/cron/payments`: `CRON_SECRET` пуст или короче 32 символов → 404; неверный токен → 401 (сравнение за постоянное время); верный → 200 + счётчики JSON.

## Файлы (ожидаемо)

- `src/lib/server/services/payments/reconcile.ts` — `reconcilePayments(db, deps)`
- `src/lib/server/services/payments/expire.ts` — `expirePayment(db, id, now, effects)`
- `src/lib/server/services/payments/schedule.ts` — single-flight + таймер
- `src/lib/server/services/payments/index.ts` — `reconcileNow(db)` с `providerById`
- `src/lib/server/auth/cron.ts` — `cronAccess(header, secret)`
- `src/routes/api/cron/payments/+server.ts` — тонкий маршрут
- `src/hooks.server.ts` — `init`: таймер (не при `building`)
- `src/env.ts`, `.env.example` — `CRON_SECRET`; `.github/workflows/cron.yml` — раз в час
- тесты: `reconcile.test.ts`, `expire.test.ts`, `schedule.test.ts`, `auth/cron.test.ts`

## Не ломать

- Вебхук и `applyProviderStatus`: дубль, сумма, переходы — тесты 3.3–3.4 зелёные.
- `paid` только с подтверждением провайдера: сверка не ставит `paid` без `getStatus` с `paid` и верной суммой (K2).
- Неистёкший `pending` и `pending` с недоступным провайдером не отменяются.
- Поздняя оплата после истечения: `cancelled` → `paid` через вебхук работает.

## Проверка

- `npx vitest --run src/lib/server/services/payments src/lib/server/auth/cron`
- `npm run check`, `npm run lint`, `npm run test`

## Риск

`high` (платежи, `+server.ts`, `.github`, `.env.example`).

## Читать

- `07` § 4 (контракт: «Узнать статус»), § 7 (сверка, истечение, аудит `actor = null`), § 8 (нештатные), § 10 (переходы), § 15 (тест истечения).

## Фазы

- [x] SPEC
- [x] RED (`test: … [RED]`) — `7ea76b7`
- [x] GREEN (`feat: … [GREEN]`) — `47e3248`; e2e правка: вызов cron с `Content-Type: application/json` (без него SvelteKit 403)
- [x] REGRESS — Vitest 606/606; e2e 94 + 1 повтором (`auth` «sixth login attempt», отдельно зелёный)
- [ ] REVIEW — отложен владельцем: общий REVIEW нескольких задач позже (без push до него)
- [ ] DEPLOY (только по апруву владельца; до него — `CRON_SECRET` в Fly и GitHub)

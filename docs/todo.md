# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

3.4 Маршрут вебхуков `POST /api/webhooks/{provider}`: подпись, дедупликация, проверка суммы и валюты (`07` § 6). Применение статуса — готовый `applyProviderStatus` (3.3); здесь — приём запроса, журнал `payment_webhook_events`, коды ответа. Миграции нет (таблица с 3.1).

## Файлы (ожидаемо)

- `src/lib/server/services/payments/webhook.ts` — `receiveWebhook(db, provider, request, options)`: весь порядок `07` § 6 п. 2, возвращает HTTP-код.
- `src/lib/server/services/payments/webhook-body.ts` — чтение тела с лимитом размера (до `parseWebhook`).
- `src/lib/server/auth/rate-limit.ts` — новый лимит `webhookPerIp`.
- `src/routes/api/webhooks/[provider]/+server.ts` — тонкий: `providerById` → `receiveWebhook` → `Response`.
- Тесты: `webhook.test.ts` (с базой, в откатываемой транзакции), `webhook-body.test.ts`, `tests/e2e/webhooks.spec.ts` (маршрут на собранном сайте: `mock` и `manual` вне dev — 404).

## Правила (дефолты агента — владелец может поправить)

1. **Провайдер.** Только через `providerById` (вне dev `mock` → `null`). Неизвестный, офлайн (`manual`) или без `parseWebhook` → `404`, в базу ничего.
2. **Частота** (`07` § 14 п. 3): `consume(db, 'webhook:ip:<ip>', limits.webhookPerIp)`, 120 запросов в минуту с IP (настройка безопасности в коде, как остальные `limits`); сверх — `429`.
3. **Размер тела** — не больше 64 КБ до `parseWebhook`: `content-length` больше лимита или поток длиннее — `413`, провайдер не вызывается.
4. **Подпись и формат** — `parseWebhook` (`null` или исключение) → `400`, `console.warn`, в базу ничего (события нет).
5. **Журнал событий** (`07` § 6 п. 2.3, решение 3.1): `insert … on conflict (provider, event_id) do nothing`. Событие уже есть и `processed_at` заполнен → `200`, ничего не делать. Есть, но `processed_at is null` (прошлая обработка упала) → обработать снова. `payload` — `notice.raw` (очищает модуль провайдера, `07` § 14 п. 2, C12).
6. **Обработка** — `applyProviderStatus` (транзакция, блокировка строки, сумма и валюта, переходы, эффекты, аудит). Событие записывается **до** обработки отдельно, чтобы ошибка не стёрла его. Итог в событии: `processed_at = now`; `error`: `applied` / `unchanged` → `null`, `not_found` → `payment_not_found`, `mismatch` → `amount_mismatch`, `ignored` → `transition_ignored`. Ответ `200` во всех этих случаях (неизвестный платёж — тоже `200`, `07` § 6 п. 2.4).
7. **Ошибка обработки** (эффект упал, база) — `error` = текст ошибки (до 500 символов), `processed_at` пуст, ответ `500` — провайдер повторит, повтор безопасен (`07` § 6 п. 4).
8. **Без сессии** (`04` п. 5 разд. 5): маршрут не читает `locals.user`, права не проверяет — защита подписью. Тело ответа пустое.
9. **Уведомление админу** (неизвестный платёж, расхождение суммы) — в 3.4 только `error` в событии, `needs_review` у платежа и `console.warn`; письма / мониторинг — 8.7, список «Требуют проверки» — 3.9.

## Не делать в 3.4

`/dev/mock-pay` (страница оплаты `mock`; создать платёж из интерфейса пока нельзя — с 3.6 / 3.8), сверка и истечение (3.5), эффекты взноса (3.6), реальный провайдер и его формат запроса (3.13).

## Не ломать

- Сервис платежей 3.3: `apply*.test.ts`, `create*.test.ts`, `transitions.test.ts`.
- Провайдеры 3.2: `registry.test.ts`, `mock.test.ts`; схема 3.1: `payments-schema.test.ts` (триггер журнала вебхуков).
- Лимиты входа: `rate-limit.test.ts`, вход и регистрация (e2e `auth`).
- Весь Vitest зелёный (`npm run test`).

## Проверка

- `npx vitest run --project server src/lib/server/services/payments src/lib/server/auth/rate-limit.test.ts`
- `npm run check; npm run lint; npx playwright test tests/e2e/webhooks.spec.ts`

## Риск

`high` — платежи, вебхуки, `+server.ts` (bugbot + security-review).

## Читать

- `07` § 4 (контракт), § 6 (вебхуки), § 8 (нештатные), § 14 (безопасность), § 15 (тесты) — прочитаны, факты в «Правила».
- `02` `payment_webhook_events` — прочитан (append-only, unique(`provider`, `event_id`)). `04` разд. 5 п. 5 — вебхук без сессии.

## Открытые вопросы (не блокируют 3.4)

- Банки часто шлют вебхук формой (`application/x-www-form-urlencoded`) без заголовка `Origin`: проверка CSRF SvelteKit ответит `403` до маршрута. Решать в 3.13 (`csrf.trustedOrigins` или JSON у провайдера), когда станет известен формат.

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

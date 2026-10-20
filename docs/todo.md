# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки для общего REVIEW: 3.6b — `git show c3b6468:docs/todo.md`, 3.7 — `git show 2c0aee1:docs/todo.md`, 3.8 — `git show 8e2b410:docs/todo.md`, 3.9 — `git show b9582c3:docs/todo.md`, 3.10 — `git show 110eb1e:docs/todo.md`, 3.11 — `git show c6b737f:docs/todo.md`, 3.12 — `git show 26c7dc5:docs/todo.md`.

## Задача

3.13 — реальный провайдер: **VPOS.am** (посредник, деньги принимает банк — пока Ameriabank, банк может смениться; решение владельца 2026-10-20). Этот шаг — **модуль провайдера по открытой спецификации без доступов**: `https://api.vpos.am/openapi.yaml` (OpenAPI 3.1, v0.1.0). Песочница и боевая проверка малой суммой — после доступов (договор с банком + VPOS.am), отдельным шагом этой же задачи. Миграции нет (`payments.provider` — `text`).

Факты из спецификации (читать её заново не нужно):
- Базовый адрес `https://api.vpos.am`, `Authorization: Bearer <token>`; режим (песочница / боевой), банк и ключи банка привязаны к токену на стороне VPOS.am — адрес один.
    10|- Создать: `POST /v1/payment-sessions`, заголовок `Idempotency-Key` (≤ 160, обязателен), тело `merchantOrderId`, `amountMinor` (целое ≥ 1), `currency` (AMD / USD / EUR), `returnUrl` (один, https), `checkoutLanguage` (hy / ru / en), `customer` (email), `metadata`. Ответ 201 (повтор — 200) `PaymentSession`: `id`, `merchantOrderId`, `amountMinor`, `currency`, `status`, `checkoutUrl`. Ошибки: 401, 409 (ключ или заказ от другого запроса), 422, 503.
- Статус: `GET /v1/payments?paymentId=<id>` → `PaymentSession`; 404 — нет.
- Возврат: `POST /v1/payments/{id}/refunds`, `Idempotency-Key`, тело `amountMinor`, `currency`, `reason` (≤ 240). 200 — возвращено; 202 — деньги возвращены, но чек / проверка требуют оператора; 409 — нельзя; 422; 501 — возвраты не включены.
- Статусы VPOS: `created`, `pending_redirect`, `pending_payment`, `authorized`, `paid`, `failed`, `cancelled`, `reversed`, `partially_refunded`, `refunded`, `expired`, `status_unknown`, `disputed`.
- Вебхук `payment.status_changed`, JSON: `id` (событие), `type`, `livemode`, `createdAt`, `data.payment` (`id`, `merchantOrderId`, `provider`, `amountMinor`, `currency`, `status`, `fiscalStatus`). Подпись `X-VPOS-Signature: t=<unix>,v1=<hex>[,v1=…]` — HMAC-SHA256 от `<t>.<сырое тело>` секретом вебхука, допуск по времени 5 мин, при смене секрета несколько `v1` (подходит любой).

Правила модуля:
1. Контракт `07` § 4 (`OnlineProvider`): `createPayment`, `getStatus`, `parseWebhook`, `refund`; id провайдера — `vpos`; вебхук — `/api/webhooks/vpos` (маршрут уже есть).
2. Создание: `merchantOrderId` = наш `payments.id`, `Idempotency-Key` = `payment-<payments.id>` (повтор сети не создаёт второй оплаты), `returnUrl` = адрес успеха (у VPOS один адрес; `/payment/success` сам показывает отмену и ошибку по статусу из базы), язык = язык платежа, email — только если есть; описание — в `metadata`. Нет `checkoutUrl` в ответе — ошибка `rejected`.
3. Статусы → наши: `paid` → `paid`; `failed` → `failed`; `cancelled`, `expired` → `cancelled`; `refunded`, `reversed` → `refunded`; `created`, `pending_*`, `authorized`, `status_unknown` → `pending`; `partially_refunded`, `disputed` → `pending` (не трогать автоматически, предупреждение в лог; частичных возвратов в MVP нет — `07` § 11) — в «Известные проблемы».
    20|4. Вебхук: подпись (HMAC, сравнение за постоянное время, любой из `v1`, допуск 5 мин) → разбор схемы → `livemode` совпадает с настройкой окружения → уведомление; иначе `null` (400). Ключ дедупликации — `id` события из подписанного тела. Статусы «ожидания» → уведомление со статусом `pending` (200, без изменений), а не 400 (иначе VPOS повторяет бесконечно) — для этого `WebhookNotice.status` расширить до `ProviderStatus` (`apply` уже возвращает `unchanged` на `pending`).
5. `raw` чистится до записи (C12, `07` § 14 п. 2): только `id`, `merchantOrderId`, `provider`, `amountMinor`, `currency`, `status`, `fiscalStatus`, `livemode`, `createdAt`, `updatedAt`, `type`, `trigger`; без `customer`, `metadata`, чеков.
6. Ошибки сети и 401 / 403 / 429 / 5xx → `unreachable`; 404 → `not_found`; 409 / 422 → `rejected`. Возврат: 200 и 202 → `ok: true`; 409 / 422 / 501 → `ok: false`; сеть — исключение (админка покажет `provider_error`).
7. Сумма: у нас AMD — целые драмы (`lib/money.ts`), USD / EUR — центы. Что VPOS понимает под `amountMinor` для AMD — **не сказано** (вопрос владельцу → VPOS.am). Перевод — одна функция с явным множителем по валюте; по умолчанию ISO 4217 (AMD × 100), проверяется первой оплатой в песочнице. Ответ с другой суммой проходит проверку `apply` (расхождение → `failed` + проверка), деньги не активируются.
8. Валюты провайдера — пока только `AMD` (`07` § 13: по умолчанию AMD; USD / EUR — когда банк подтвердит).
9. Окружение (`07` § 14 п. 1, 4): `PAYMENT_VPOS_API_TOKEN`, `PAYMENT_VPOS_WEBHOOK_SECRET`, `PAYMENT_VPOS_LIVEMODE` (`true` — боевой). Нет токена или секрета — провайдер не регистрируется (вебхук 404, `PAYMENT_PROVIDER=vpos` → `PaymentConfigError`, как сейчас). `PAYMENT_VPOS_LIVEMODE=true` в `development` — провайдер не регистрируется (боевой нельзя в dev).
10. HTTP — через переданный `fetch` (как `mail/resend.ts`), время — через переданные часы: тесты без сети.

## Файлы (ожидаемо)

- `src/lib/server/services/payments/providers/vpos.ts` — `createVposProvider({ token, webhookSecret, livemode, fetch, now })`: создание, статус, возврат
- `src/lib/server/services/payments/providers/vpos-webhook.ts` — подпись и разбор вебхука
    30|- `src/lib/server/services/payments/providers/vpos-map.ts` — статусы, сумма, очистка `raw`
- `src/lib/server/services/payments/providers/vpos.test.ts`, `vpos-webhook.test.ts` — тесты на ответах из спецификации, `fetch` подменён
- `src/lib/server/services/payments/providers/registry.ts` — запись `vpos` из окружения (+ `registry.test.ts`)
- `src/lib/server/services/payments/providers/types.ts` — `WebhookNotice.status: ProviderStatus`
- `.env.example` — `PAYMENT_VPOS_*`
- `docs/07-PAYMENTS.md` § 13, `docs/questions.md` — решения владельца (разрешено 2026-10-20)

## Не ломать

- Цепочка на `mock` в dev и все тесты платежей (включая приёмочные 3.12) — без изменений поведения.
- Без `PAYMENT_VPOS_*` прод ведёт себя как сейчас: `/api/webhooks/vpos` — 404, онлайн-оплата выключена при пустом `PAYMENT_PROVIDER`.
    40|- Вебхук с неверной / старой подписью, чужим `livemode` или не той формы — 400 и ничего не меняет; дубль события — один раз (`receiveWebhook`).
- Ответ VPOS с другой суммой или валютой не даёт `paid` (`apply`).

## Проверка

- `npx vitest --run src/lib/server/services/payments`
- `npm run check`, `npm run lint`

## Риск

`high` — платежи и вебхуки, `.env.example`.
    50|
## Читать

- `07` § 4 (контракт), § 13 (решения), § 14 (безопасность) — прочитаны в SPEC; факты выше. Спецификация VPOS — выписана выше.

## Открытые вопросы (не блокируют модуль, блокируют боевую проверку)

1. `amountMinor` для AMD у VPOS — драмы или сотые (×100)? Спросить VPOS.am (info@vpos.am) до первой оплаты в песочнице.
2. Валюты USD / EUR — по договору с банком.
3. Вебхук в песочнице приходит только на публичный адрес: песочницу локально проверяем созданием оплаты и статусом (страница возврата и сверка ходят в `getStatus`), вебхук — на проде с тестовым токеном (`PAYMENT_VPOS_LIVEMODE=false`) после деплоя этапа 3.

## Фазы
    60|
- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] Песочница (после доступов) — создание, оплата тестовой картой, статус, возврат, вебхук
- [ ] Боевая проверка малой суммой (владелец, после деплоя)
- [ ] REVIEW — общим прогоном этапа 3, без push до него
- [ ] DEPLOY (только по апруву)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки для общего REVIEW: 3.6b — `git show c3b6468:docs/todo.md`, 3.7 — `git show 2c0aee1:docs/todo.md`, 3.8 — `git show 8e2b410:docs/todo.md`, 3.9 — этот файл до следующей задачи (раздел «Для общего REVIEW»).

## Задача

3.9 — админка платежей (`05` § 16, 17; `07` § 8–12; `04` § 3, 4, 5): список, карточка, ручное подтверждение, возврат, повтор квитанции, выгрузка CSV, «требуют проверки», назначения донатов. Миграции нет. REVIEW — в общем прогоне (без push).

Правила:
1. **Права.** Всё — `admin`: просмотр и CSV — `payments.read`, действия — `payments.manage`, назначения — `donations.config`. Сервисы сами проверяют право по `actor` (`04` § 5 п. 6) → `not_allowed`; маршрут — `requirePermission` в каждом `load` и action.
2. **Список** `/admin/payments`: колонки — дата (`created_at`), плательщик (участник — имя, гость — `donor_name`, нет — «Гость»), тип, сумма с валютой, статус, провайдер, отметка «требует проверки». Фильтры: тип, статус, провайдер (только встречающиеся), период (`from` / `to` — дни по Еревану, по `created_at`), «требуют проверки». Поиск — имя / email участника или гостя, номер платежа (UUID), ID у провайдера. Сортировка — дата, сумма. 25 на страницу.
3. **Карточка** `/admin/payments/[id]`: все поля платежа, плательщик (ссылка на участника), назначение, связанное членство (статус, период), кто подтвердил вручную, ответ провайдера (`provider_payload`, JSON), история из журнала (`entity_type = payment`). Действия — по статусу (ниже). Не UUID / нет — 404.
4. **Новый ручной платёж** `/admin/payments/new` (`07` § 9): тип — взнос или донат (`event_fee` — этап 5), сумма (в единицах валюты → `priceToMinor`), валюта (`CURRENCIES`), дата оплаты (не в будущем; `paid_at` = начало дня по Еревану), комментарий (обязателен — основание без провайдера). Плательщик: email участника (взнос — обязателен, участник существует и не удалён) или для доната гость — имя (обязательно), email (необязательно), «Не показывать имя»; назначение — активное или пусто. Создаётся `payments` с `provider = manual`, `status = paid`, `confirmed_by = admin`, комментарий — в `provider_payload` (`{ manual: { comment } }`) и в журнал; для взноса — новое `memberships` (`pending`) и связь. Эффекты `paid` — те же (`paymentEffects`: активация / продление, письмо с квитанцией; донат — благодарность). Журнал `payment.confirm_manual` (исполнитель, IP). Одна транзакция; письма — после коммита.
5. **Подтвердить по выписке** (карточка; `07` § 8 «деньги списаны, на сайте `pending`», § 10): статус `pending | failed | cancelled` → `paid` (`canTransition`), сумма не меняется, комментарий обязателен, `paid_at = now`, `confirmed_by`, `needs_review = false` (эффекты могут поставить снова); эффекты `paid`; журнал `payment.confirm_manual` (было / стало, комментарий). `event_fee` — отказ (этап 5). Строка под `FOR UPDATE`: вебхук после — `unchanged` / `ignored`.
6. **Возврат** (`07` § 11): только `paid` → `refunded`, причина обязательна, полный. Режим: `api` — у провайдера платежа (`providerById`) есть `refund`, есть `provider_payment_id`, платёж не подтверждён вручную → вызов `refund(id, amount, reason)`; отказ или ошибка → ничего не меняем, сообщение. Иначе `manual` — админ вернул деньги в банке и отмечает «Возврат выполнен». Затем `refunded_at`, эффекты `refunded` (взнос — членство `cancelled`), журнал `payment.refund` (причина, режим). Письмо о возврате — эффект `refunded` для всех типов (`withRefundLetter` в `paymentEffects`), так что и возврат от провайдера (вебхук) шлёт письмо; получатель — участник по аккаунту или email гостя; сроки зачисления — «зависят от банка».
7. **Повторить квитанцию** (`paid`, взнос или донат): взнос — `paidLetter` по членству этого платежа (нужны даты; нет — отказ), донат — `thanksLetter`; получателя нет (удалён, гость без email) → отказ; журнал `payment.receipt_resend`.
8. **«Требуют проверки»**: фильтр списка; в карточке «Проверено» — снять `needs_review`, комментарий обязателен, журнал `payment.review_resolved` (решение агента: иначе список только растёт).
9. **CSV** `GET /admin/payments/export?kind=membership|donation&from&to` (`07` § 12 п. 4): отдельно взносы и донаты, период — по `paid_at` (дни по Еревану), только оплаченные и возвращённые (`paid_at` есть), до 10 000 строк. Колонки: `paid_at`, `payment_id`, `status`, `payer_name`, `payer_email`, `amount` (в единицах валюты), `currency`, `provider`, `provider_payment_id`, `refunded_at`, `confirmed_by`; донат — ещё `purpose`, `is_anonymous`. Защита от формул — `toCsv`. Без `kind` — 400.
10. **Назначения донатов** `/admin/donation-purposes` (`05` § 17): список — название, активно, порядок, собрано (сумма `paid` донатов по валютам); создание и правка — название ×3 (EN обязателен), активно, порядок; скрытие — снять «активно», не удаляются. Журнал `donation_purpose.create` / `.update`. Кеш `/donate` — группа `settings` (`cache/admin-groups.ts`: `donation-purposes`, `payments` — ручной донат и возврат меняют публичный список).
11. Тексты — `i18n/messages/{en,ru}-payments-admin.ts`; HY — откат на EN. Карты e2e: `admin-access-map.ts`, `admin-audit-map.ts` (+ исполнители), фикстуры прав.

## Файлы (ожидаемо)

- `src/lib/server/services/payments/admin/` — `list.ts`, `card.ts`, `manual.ts`, `confirm.ts`, `refund.ts`, `review.ts`, `receipt.ts`, `export.ts`, `index.ts` (+ тесты, `test-support.ts`)
- `src/lib/server/services/payments/refund-letter.ts`, `effects.ts` (`withRefundLetter`); `services/donations/mail.ts` — экспорт получателя
- `src/lib/server/services/donations/purposes-admin.ts` (+ тест)
- `src/lib/validation/admin-payments.ts`, `donation-purposes.ts` (+ тесты)
- маршруты `admin/payments/{+page, [id], new, export}`, `admin/donation-purposes/{+page, new, [id]}`
- `src/lib/server/cache/admin-groups.ts`; `src/lib/i18n/messages/{en,ru}-payments-admin.ts`, `en.ts`, `ru.ts`, `{en,ru}-payment.ts` (письмо о возврате)
- `tests/e2e/admin-payments.spec.ts`, `admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-actions.ts` (+ `admin-audit-money.ts`), `admin-permissions-fixtures.ts`, `admin-permissions.spec.ts`

## Не ломать

- `paid` без провайдера — только явным действием админа с комментарием и записью в журнал; редактор / модератор / участник не открывают платежи и не вызывают действия ни страницей, ни прямым POST (K1, K2).
- Эффекты один раз: ручной платёж и подтверждение по выписке запускают `paid` один раз; повтор действия на уже `paid` — отказ; вебхук после — `unchanged`. Возврат — один раз (`refunded` конечный).
- Вебхук, сверка, страницы возврата, старт взноса и доната — без изменений (кроме письма о возврате на `refunded`).
- Email донора и плательщика — только в админке (`04` § 4); в CSV нет формул.

## Проверка

- `npx vitest --run src/lib/server/services/payments src/lib/server/services/donations src/lib/server/services/memberships src/lib/validation src/lib/server/cache src/routes/admin`
- `npx playwright test tests/e2e/admin-payments.spec.ts tests/e2e/admin-permissions.spec.ts tests/e2e/admin-audit.spec.ts tests/e2e/donate.spec.ts tests/e2e/webhooks.spec.ts`; `npm run check`, `npm run lint`, `npm run test`

## Риск

`high` (платежи: `paid` по действию админа, возврат через провайдера, эффекты членства, права, журнал).

## Читать

- `05` § 1, 2, 16, 17; `07` § 8–12, 14, 15; `04` § 3 (строки платежей), 4, 5; `02` § 4 (прочитаны в SPEC).

## Для общего REVIEW — что проверить в 3.9

Дифф: `git diff bf7cc09..HEAD -- src tests` (RED `d68de62`, GREEN `02833d0`). Риск `high` → bugbot + security-review параллельно, затем `/crit-audit`.

1. **`paid` без провайдера (K2)** — `services/payments/admin/manual.ts` и `confirm.ts`: только `payments.manage` (сервис проверяет `actor` сам, маршрут — `requirePermission`), комментарий обязателен (пустой → `invalid`), журнал `payment.confirm_manual` в той же транзакции, `confirmed_by`. Подтверждение — только `pending | failed | cancelled` по `canTransition`, строка `FOR UPDATE` (`support.ts` `lockPayment`); `event_fee` → `unsupported`.
2. **Эффекты один раз (K2)** — повтор подтверждения на `paid` → `wrong_status`; вебхук после ручного `paid` → `unchanged` (unit `confirm.test.ts`); возврат один раз (`refunded` конечный).
3. **Права (K1)** — `payments.read` / `payments.manage` / `donations.config` только у `admin`; карта `admin-access-map.ts` + фикстуры прав (редактор / модератор / участник — 403 на страницах, POST и CSV).
4. **Возврат** — `refund.ts`: режим `api` только если у провайдера есть `refund`, есть `provider_payment_id` и платёж не подтверждён вручную; отказ / исключение провайдера → ничего не меняем (`provider_error`); `manual` — отметка, деньги вернул админ. Журнал `payment.refund` (причина, режим).
5. **Письмо о возврате** — `payments/refund-letter.ts` `withRefundLetter` в `paymentEffects` для всех типов: теперь уходит и при `refunded` от вебхука (изменение поведения 3.4–3.7). Получатель — `recipient()` из `donations/mail.ts` (участник по аккаунту, гость — email доната).
6. **Личные данные (K4)** — email плательщика и донора только в админке (карточка, CSV); `provider_payload` показывается админу как есть. CSV — `toCsv` (формулы с `'`), BOM, `no-store`, ≤ 10 000 строк, без `kind` — 400.
7. **Кеш** — `cache/admin-groups.ts`: `payments`, `donation-purposes` → `settings` (ручной донат и возврат меняют публичный список `/donate`).
8. **Не K, решения агента** — «Проверено» снимает `needs_review` с комментарием (`payment.review_resolved`); комментарий ручного платежа — в `provider_payload.manual.comment` и журнал; `paid_at` ручного платежа — начало дня по Еревану; период членства от ручного взноса начинается от момента записи, а не от даты оплаты; сумма ручного взноса свободная (не сверяется с `membership_fee`); двойная оплата (вебхук + ручная запись) не обнаруживается; повтор квитанции взноса — только если у членства есть даты; HY — откат на EN. В GREEN поправлен локатор e2e (`exact: true`: чип фильтра тоже содержит имя), логика теста та же.

## Фазы

- [x] SPEC — `bf7cc09`
- [x] RED (`test: … [RED]`) — `d68de62`
- [x] GREEN (`feat: … [GREEN]`) — `02833d0`
- [x] REGRESS — Vitest 741/744: `audit-coverage` (таймаут) и `events/edit` отдельно зелёные; `hero/public` падает стабильно из-за часов машины (спешат на ~1,2 с относительно Neon, тест ждёт блок, закончившийся 1 с назад; hero не менялся); e2e зоны: `admin-payments` 3/3, `admin-permissions`, `admin-audit`, `donate`, `webhooks` — 14/14; `check`, `lint` чистые
- [ ] REVIEW — общим прогоном позже (решение 2026-10-19), без push до него
- [ ] DEPLOY (только по апруву)

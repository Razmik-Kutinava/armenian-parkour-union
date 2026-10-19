# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

3.6a — членский взнос, серверная часть (`07` § 5.1, `03` § 2): старт оплаты взноса, эффекты платежа для членства, ежедневная задача (истечение, напоминания), письма. Страницы `/join`, `/cabinet/membership`, `/dev/mock-pay` — 3.6b. Решения владельца — `decisions.md` 2026-10-19 (3.6). SPEC 3.5 — `git show 7ea76b7:docs/todo.md`.

Правила:
1. **Старт** `startMembershipPayment(db, userId, locale, deps)`: пользователь есть, не удалён, `status = active` (иначе `blocked`), email подтверждён (иначе `email_unverified`, `03` § 1 п. 2). Взнос `membership_fee` (`amount_minor` целое > 0, валюта из `CURRENCIES`, `period_months` целое 1…120) и `payment_wait_minutes` (целое 1…1440) — иначе `unavailable`; онлайн-оплаты нет — тоже `unavailable`. Сумма, валюта — только из настроек (C11). Под тем же advisory-lock, что `startOnlinePayment` (`payment:<user>:membership`): есть `pending` членство с живым `pending` платежом той же суммы, валюты и провайдера — оно (повтор отдаёт тот же адрес оплаты); иначе новое `pending` членство. После старта `memberships.payment_id` = платёж. Ошибка провайдера — платёж `failed`, членство остаётся `pending` (закроет ежедневная задача).
2. **Оплачен** (эффект `paid`, в транзакции смены статуса): строки пользователя и членства `FOR UPDATE`. Не активируем, платёж `needs_review` + аудит `membership.not_activated` с причиной: у платежа нет членства или пользователя / членство чужое / пользователь заблокирован или удалён (`07` § 8) / членство уже `active` или `expired`. Иначе `active`: `starts_at` = max(сейчас, самый поздний `ends_at` действующих членств пользователя), `ends_at` = `starts_at` + `period_months` (в SQL, `make_interval`); `payment_id` = платёж; `users.level` пуст → `novice` (аудит `user.level`, без исполнителя). Членство было `cancelled` (поздняя оплата) — активируем и `needs_review`. Аудит `membership.status` без исполнителя. Письмо об оплате — **после коммита**: сумма, дата, назначение и период, номер платежа, реквизиты (`07` § 12), ссылка на `/cabinet/membership`, язык — `users.locale`.
3. **Отменён** (`cancelled`: истёк или отмена): связанное членство `pending` → `cancelled` + аудит. **`failed`** — без эффекта (`07` § 5.1 п. 5). **Возврат** (`refunded`): связанное членство `active` / `expired` → `cancelled` + аудит (степень не трогаем, `03` § 2 п. 6; письмо о возврате — 3.9).
4. **После коммита**: эффект получает `after(job)`; `applyProviderStatus` и `expirePayment` выполняют задания после транзакции, ошибка задания — в лог, на результат не влияет; откат транзакции — задания не выполняются.
5. **Ежедневная задача** `runMembershipDaily(db, { now, send })`: (а) `active` с `ends_at <= now` → `expired` + аудит; (б) `pending` старше суток без `pending` платежа → `cancelled` + аудит; (в) напоминания: за 7 дней (`ends_at` в (now; now + 7 сут]) и за 30 (в (now + 7; now + 30 сут]) — только последнее членство пользователя (нет `active` с более поздним `ends_at`), пользователь активен и не удалён, отметка `reminded_7_at` / `reminded_30_at` ставится атомарно (`update … where … is null returning`) до отправки — повтор не шлёт второй раз. Итог `{ expired, closed, reminded }`.
6. **Маршрут** `POST /api/cron/memberships`: доступ — `cronAccess` (как `/api/cron/payments`), ответ — счётчики JSON. `cron.yml`: расписание `0 5 * * *` (09:00 Ереван) → этот маршрут; ежечасное — только сверка; ручной запуск — обе.
7. Seed: `payment_wait_minutes: 30`.

## Миграция 0008 (Migration Gate — «go» получен 2026-10-19)

- Что: `ALTER TABLE memberships ADD COLUMN reminded_30_at timestamptz, ADD COLUMN reminded_7_at timestamptz` (nullable, без значений по умолчанию; данных не трогает).
- Откат: `scripts/rollback/0008_down.sql` — `DROP COLUMN IF EXISTS` обоих полей (теряются только отметки напоминаний), затем удалить запись 0008 из `drizzle.__drizzle_migrations` и `drizzle/meta`.

## Файлы (ожидаемо)

- `src/lib/server/db/schema/payments.ts`, `drizzle/0008_*.sql`, `scripts/rollback/0008_down.sql`
- `src/lib/server/services/payments/effects.ts`, `apply.ts`, `expire.ts` — `after`; `settings.ts` — `paymentWaitMinutes`
- `src/lib/server/services/memberships/` — `fee.ts`, `start.ts`, `effects.ts` (+ активация), `daily.ts`, `mail.ts`, `index.ts`
- `src/routes/api/cron/memberships/+server.ts`, `.github/workflows/cron.yml`
- `src/lib/server/seed/settings.ts` (+ тест), `src/lib/i18n/messages/{en,ru}-membership.ts`
- тесты: `memberships/start.test.ts`, `effects.test.ts`, `daily.test.ts`, `fee.test.ts`, `payments/after-commit.test.ts`, `tests/e2e/cron-memberships.spec.ts`
- сделано: `memberships/{fee,start,activate,effects,log,mail,daily,reminders,index}.ts`, `payments/settings.ts`, `i18n/messages/{en,ru}-membership.ts`

## Не ломать

- Вебхук, сверка, истечение: тесты 3.3–3.5 зелёные; дубль вебхука не создаёт второго членства (K2, `07` § 15).
- Членство активируется только эффектом `paid` (подтверждение провайдера), сумма — только из настроек; при `amount_minor = 0` оплату не начинать.
- Продление не теряет оплаченных дней; истёкшее членство не трогает степень и баллы (`03` § 2 п. 5).
- Ошибка письма не откатывает оплату (`03` § 14).

## Проверка

- `npx vitest --run src/lib/server/services/memberships src/lib/server/services/payments src/lib/server/seed`
- `npm run check`, `npm run lint`, `npm run test`

## Риск

`high` (взносы, платежи, миграция, `+server.ts`, `.github`).

## Читать

- `07` § 5.1, 7, 8, 10, 11 п. 3, 12 п. 1, 15; `03` § 1 п. 2, § 2, § 14; `02` § 2 `memberships`, § 10 `site_settings`; `06` § 4.9, 5.3, 6 (для 3.6b).

## Фазы

- [x] SPEC
- [x] RED (`test: … [RED]`) — `f767e92`
- [x] GREEN (`feat: … [GREEN]`) — `3f4b5a8`; настройки (взнос, срок ожидания, период) старт и эффекты получают параметрами: тесты не пишут в общую `site_settings` (соседние тесты делают `DELETE` всей таблицы и ждали блокировок > 20 с); разбор настроек — чистые тесты `fee.test.ts`
- [x] REGRESS — Vitest 640/640; e2e зоны (cron, cron-memberships, webhooks) 8/8; полный e2e 97 + `admin-users.spec.ts:140` «grant a role» (известный, падает и до 3.2)
- [ ] REVIEW — общим прогоном позже (решение 2026-10-19), без push до него
- [ ] DEPLOY (только по апруву: миграция 0008, `db:seed` прода — `payment_wait_minutes`)

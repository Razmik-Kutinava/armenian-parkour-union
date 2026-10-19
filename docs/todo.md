# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

3.6b — членский взнос, страницы (`06` § 4.9, 5.3; `07` § 3, 5.1): `/join`, `/cabinet/membership`, `/dev/mock-pay/[id]`. Серверная часть — 3.6a (SPEC — `git show 3f4b5a8:docs/todo.md`). Решения — `decisions.md` 2026-10-19 (3.6).

Правила:
1. **Кнопка «Оплатить»** (одно действие `pay` на обеих страницах): гость → `/login?returnTo=`; иначе `startMembership(db, user.id, locals.locale)`; `ok` → `303` на `checkoutUrl`; отказ → сообщение по причине (`email_unverified` — «подтвердите email», `blocked` / `not_found` — как гость не бывает, общее; `unavailable` / `invalid` — «оплата сейчас недоступна»; `provider_error` — «не удалось, попробуйте снова»); `PaymentConfigError` → лог + «недоступна» (не 500). Сумма с формы не принимается (C11): форма без полей.
2. **`/join`** открыт всем: текст системной страницы `pages` slug `join`, если опубликована (заголовок и SEO — из неё; иначе заголовок из переводов). Блок взноса: сумма и срок из `membershipFee` (`null` → «размер взноса скоро появится», кнопки нет). Кнопка: гость → «Зарегистрироваться» (`/register`) и «Войти»; вошедший с действующим членством → «Вы уже в федерации» + ссылка на `/cabinet/membership`; иначе → «Оплатить». `/pages/join` → `301` на `/join`; в sitemap, каноническом адресе и ссылке админки страница `join` — `/join` (общая функция пути страницы вместо `slug === 'about'` в 4 местах).
3. **Seed**: `join` — системная страница (черновик, заголовок EN / HY / RU), в `SYSTEM_PAGE_SLUGS`.
4. **`/cabinet/*`**: общий `+layout.server.ts` — гость → `/login?returnTo=<путь>` (`requireUser` в `auth/guard.ts`). `/cabinet` (обзор) — 3.10, не делаем.
5. **`/cabinet/membership`**: сервис `getMembershipOverview(db, userId)` — только строки этого пользователя: `current` — `active`, `starts_at <= now < ends_at`; `paidUntil` — самый поздний `ends_at` среди `active` (продление вперёд); `waiting` — есть `pending` членство с `pending` платежом, срок которого не истёк («Ожидаем подтверждение платежа»); `history` — членства с `starts_at` (были оплачены), новые первыми, ≤ 50. Кнопка «Оплатить» / «Продлить» (есть действующее) — то же действие `pay`; при `waiting` повтор отдаёт тот же платёж (3.6a). Блок взноса — как на `/join`.
6. **`/dev/mock-pay/[id]`**: `if (!dev) error(404)` в load и action. Сервис `services/payments/mock-pay.ts`: `getMockCheckout(db, providerPaymentId)` — платёж `provider = 'mock'` (сумма, валюта, назначение, статус) или `null` → 404; `settleMockPayment(db, provider, providerPaymentId, status)` — `status` из `paid | failed | cancelled` (иное → 400), провайдер не mock (`null` / без `simulate`) → `not_found`; `simulate()` → подписанный запрос → `receiveWebhook` (весь путь: подпись, дедуп, `applyProviderStatus`, эффекты); mock не знает платёж (перезапуск сервера) → `not_found`. После — итог на странице и ссылка на `/cabinet/membership` (страницы возврата — 3.8).

## Файлы (ожидаемо)

- `src/lib/server/services/memberships/overview.ts` (+ `overview.test.ts`) — состояние членства для страниц
- `src/lib/server/services/payments/mock-pay.ts` (+ `mock-pay.test.ts`) — dev-оплата через вебхук
- `src/lib/page-path.ts` (+ тест) — путь страницы `pages` (`about` → `/federation`, `join` → `/join`); правки `pages/view.ts`, `seo/sitemap.ts`, `admin/pages/[id]/+page.server.ts`, `pages/[slug]/+page.server.ts`
- `src/lib/server/seed/pages.ts`, `src/lib/validation/pages.ts` (+ их тесты) — `join`
- `src/lib/server/auth/guard.ts` — `requireUser`
- маршруты: `[[lang=lang]]/(site)/join/`, `[[lang=lang]]/(site)/cabinet/+layout.server.ts`, `cabinet/membership/`, `(site)/pay-membership.ts` (общее действие), `dev/mock-pay/[id]/`
- `src/lib/components/site/MembershipFee.svelte` — блок взноса; `src/lib/i18n/messages/{en,ru}-membership.ts`
- `tests/e2e/membership.spec.ts`

## Не ломать

- Сумма — только из `membership_fee` (C11); при 0 / битой — кнопки нет, действие отвечает «недоступна»; оплата не начинается без входа и без подтверждённого email.
- Членство активируется только эффектом `paid` после подтверждения провайдера: `/dev/mock-pay` идёт через `receiveWebhook`, вне dev — 404 (и mock вне dev недоступен через `providerById`).
- Кабинет показывает только данные текущего пользователя (`04` § 5.3); гость → вход.
- Системные страницы (`about` → `/federation`, остальные `/pages/…`), sitemap и канонические адреса — как были.

## Проверка

- `npx vitest --run src/lib/server/services/memberships src/lib/server/services/payments src/lib/server/seed src/lib/validation/pages src/lib/page-path src/lib/server/services/seo`
- `npx playwright test tests/e2e/membership.spec.ts tests/e2e/pages.spec.ts tests/e2e/seo.spec.ts`; `npm run check`, `npm run lint`, `npm run test`

## Риск

`high` (взносы и платежи: действие старта оплаты, dev-маршрут оплаты; права кабинета).

## Читать

- `06` § 3 (маршруты), 4.9, 5.3, 9; `07` § 3, 5.1 (прочитаны в SPEC: кнопка по трём состояниям, «Ожидаем подтверждение платежа», ошибка оплаты — причина и «Попробовать снова»).

## Для общего REVIEW — что проверить в 3.6b

Дифф: `git diff 3941dd4..22e8eac -- src tests`. Риск `high` → bugbot + security-review.

1. **Сумма (K2, C11)** — `(site)/pay-membership.ts`: форма без полей, сумма только из `membership_fee` через `startMembership`; лишние поля формы ни на что не влияют.
2. **Кабинет (K1)** — `cabinet/+layout.server.ts` и `cabinet/membership/+page.server.ts`: `userId` только из сессии; действие `pay` само проверяет вход (layout действие не защищает); `getMembershipOverview` не отдаёт чужие строки.
3. **`/dev/mock-pay` (K2)** — `routes/dev/mock-pay/[id]/+page.server.ts`: `!dev` → 404 и в load, и в action; `settleMockPayment` не меняет статус мимо `receiveWebhook` и только для `provider = 'mock'`; статус из формы — только `paid | failed | cancelled`.
4. **Редирект** — `PayFeeForm.svelte`: `window.location.assign(result.location)`; адрес — только `checkoutUrl` провайдера или `/login?returnTo=<свой путь>`, без открытого редиректа из запроса.
5. **Отказы** — `PaymentConfigError` → 503 «недоступна» (не 500); `provider_error` → 502; гость → `/login?returnTo=`; e2e `membership.spec.ts` подменяет `membership_fee` в общей `parkour_dev` и возвращает в `afterAll` (риск гонки с другими спеками).
6. **Пути страниц** — `lib/page-path.ts`: `/pages/about` и `/pages/join` → 301, sitemap / canonical / ссылка админки как раньше; `join` в `SYSTEM_PAGE_SLUGS` (нельзя удалить, slug не меняется).
7. **Не K, решения агента** — `/join` открыт и без опубликованной страницы `join` (у `/federation` — 404); `paidUntil` считается только из последних 50 периодов; `/cabinet` (обзор) — 404 до 3.10; тексты HY — откат на EN.

## Фазы

- [x] SPEC — `3941dd4`
- [x] RED (`test: … [RED]`) — `be45bbe`
- [x] GREEN (`feat: … [GREEN]`) — `22e8eac`
- [x] REGRESS — Vitest 660/660; e2e зоны 37/37 (membership, webhooks, cron, cron-memberships, site-layout, pages, seo, content-visibility, i18n); полный e2e не гонялся; цепочка на dev с `mock` — скриптом: оплата → членство `active`, повтор «Оплатить» → тот же платёж
- [ ] REVIEW — общим прогоном позже (решение 2026-10-19), без push до него
- [ ] DEPLOY (только по апруву; вместе с 3.5–3.6a: миграция 0008, `db:seed` прода — `payment_wait_minutes`, страница `join`)

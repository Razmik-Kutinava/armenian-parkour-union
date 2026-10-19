# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятка для общего REVIEW 3.6b — `git show c3b6468:docs/todo.md` (раздел «Для общего REVIEW»).

## Задача

3.7 — донаты (`06` § 4.8; `07` § 3, 5.2, 12 п. 1; `03` § 10 п. 4; `04` § 3, 5.4): форма `/donate` (в том числе для гостя), назначения, письмо-благодарность с квитанцией, публичный список за флагом. Решения владельца — `decisions.md` 2026-10-19 (3.7). REVIEW — в общем прогоне (без push).

Правила:
1. **Настройки.** `site_settings.donation_limits` = `{ currency: 'AMD', min_minor: 1000, max_minor: 1000000 }` (seed). Разбор `parseDonationLimits`: целые, `1 ≤ min ≤ max ≤ INT_MAX`, валюта из `CURRENCIES`; иначе `null` → оплата недоступна. Флаг `feature_flags.donations_public_list === true` — только явное `true`.
2. **Форма** (`validation/donation.ts`, сервер): `amount` — текст (пробелы внутри убираются), `purposeId` — пусто или id, `isAnonymous` — чекбокс; гость — `donorName` (1–100) и `donorEmail` (email) обязательны; вошедший — имя и email из аккаунта, поля формы не берутся. Валюты в форме нет — из `donation_limits`.
3. **Сервис** `startDonationPayment(db, input, deps)` (`services/donations/start.ts`): сумма = `priceToMinor(amount, limits.currency)`, вне `[min, max]` или не число → `amount` (ничего не создаём); `deps.limits` / `waitMinutes` / `provider` нет → `unavailable`; вошедший удалён / не `active` → `unavailable`; назначение — только активное (иначе `invalid`); гость → `user_id = null`, `donor_name`, `donor_email`; вошедший → `user_id`, `donor_*` = null (`07` § 5.2 п. 4); `is_anonymous` из формы; срок — `payment_wait_minutes`; каждый донат — новый платёж (`startOnlinePayment`); провайдер не ответил → `provider_error`. Email подтверждать не нужно (`04` § 3: донат — всем).
4. **Лимит частоты**: `limits.donatePerIp` = 10 / час с IP (настройка безопасности, как `signUpPerIp`), считается после проверки формы; сверх → `limited` (429).
5. **Эффект** `donation.paid` (`services/donations/effects.ts`, в `paymentEffects`): только письмо после коммита (`after`), баллов и степени нет; получатель — `donor_email` / `donor_name` (язык EN — вопрос в `questions.md`) или `users.email` / `first_name ?? name` / `users.locale` (удалён — без письма). Текст: благодарность, сумма, дата, назначение (заголовок на языке письма или «Общие нужды федерации»), номер платежа, реквизиты `site_settings.requisites` (`07` § 12 п. 1). `failed` / `cancelled` / `refunded` — ничего (письмо о возврате для всех типов — 3.9). Дубль `paid` — эффект не повторяется (`applyProviderStatus`).
6. **Публичный список** `recentDonations(db, limit = 10)`: только `kind = donation`, `status = paid`, новые по `paid_at`; поля — имя, сумма, валюта, дата; email нет нигде; имя `null` («Аноним»), если `is_anonymous`, пользователь удалён или моложе 18 (`03` § 13); гость — `donor_name`, вошедший — `users.name`.
7. **`/donate`** открыт всем: заголовок и короткий текст из переводов, форма (быстрый выбор суммы — от минимума ×1, ×5, ×10, ×20 в пределах максимума; своя сумма; назначение — только если есть активные; вошедшему — «Донат от {имя} ({email})» без полей), подсказка с диапазоном; нет лимитов — «Пожертвования скоро откроются», формы нет. Действие `donate` → `303` на `checkoutUrl` (как `PayFeeForm`, через `window.location`), отказы — текстом у поля / над кнопкой. Список — блоком под формой при включённом флаге. `/donate` — в sitemap.
8. Страница возврата с благодарностью — 3.8 (`/payment/success`).

## Файлы (ожидаемо)

- `src/lib/server/services/donations/{settings,purposes,start,effects,mail,public,index}.ts` (+ `settings.test.ts`, `start.test.ts`, `effects.test.ts`, `public.test.ts`, `test-support.ts`)
- `src/lib/server/services/payments/effects.ts` — `donation` в `paymentEffects`
- `src/lib/validation/donation.ts` (+ тест); `src/lib/components/site/donation-presets.ts` (+ тест)
- `src/lib/server/auth/rate-limit.ts` — `donatePerIp`; `src/lib/server/seed/settings.ts` (+ тест) — `donation_limits`; `src/lib/server/services/seo/sitemap.ts` (+ тест) — `/donate`
- маршрут `[[lang=lang]]/(site)/donate/` (`+page.server.ts`, `+page.svelte`); `components/site/DonateForm.svelte`, `DonationList.svelte`; `i18n/messages/{en,ru}-donate.ts`
- `tests/e2e/donate.spec.ts`

## Не ломать

- Сумма доната — только после проверки диапазона на сервере (`07` § 5.2 п. 2); валюта — из настроек, не из формы; вне диапазона платёж не создаётся.
- Донат не меняет `paid` без провайдера, не даёт баллов / степени / членства; эффекты взноса (`membership`) работают как раньше.
- Email донора не попадает на страницу никогда; анонимные и несовершеннолетние — без имени (K4).
- Вошедший не может подставить чужой email / `user_id`: берутся из сессии и аккаунта.

## Проверка

- `npx vitest --run src/lib/server/services/donations src/lib/server/services/payments src/lib/server/services/memberships src/lib/validation/donation src/lib/components/site/donation-presets src/lib/server/seed src/lib/server/services/seo`
- `npx playwright test tests/e2e/donate.spec.ts tests/e2e/membership.spec.ts tests/e2e/seo.spec.ts`; `npm run check`, `npm run lint`, `npm run test`

## Риск

`high` (платежи: старт оплаты с суммой от пользователя, гостевая форма, эффект платежа, личные данные доноров).

## Читать

- `06` § 4.8; `07` § 3, 5.2, 8, 11 п. 3, 12 п. 1, 13, 15; `02` § 4 (`payments`, `donation_purposes`), seed (прочитаны в SPEC).

## Фазы

- [ ] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW — общим прогоном позже (решение 2026-10-19), без push до него
- [ ] DEPLOY (только по апруву; `db:seed` прода — `donation_limits`)

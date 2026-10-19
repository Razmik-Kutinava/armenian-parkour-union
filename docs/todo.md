# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки для общего REVIEW: 3.6b — `git show c3b6468:docs/todo.md`, 3.7 — `git show 2c0aee1:docs/todo.md` (раздел «Для общего REVIEW»).

## Задача

3.8 — страницы `/payment/success` и `/payment/cancel` (`07` § 1 п. 3, § 3 п. 7, § 7 п. 1, § 15; `06` § 3.3): статус платежа из базы, проверка у провайдера тем же путём, что вебхук, опрос статуса, понятные сообщения. REVIEW — в общем прогоне (без push).

    10|Правила:
1. **Адрес.** Провайдер возвращает на `{PUBLIC_SITE_URL}{/lang}/payment/success?pid=<payments.id>` и `.../payment/cancel?pid=...`; префикс языка — из `locale` платежа (`localizePath`, EN без префикса). Сейчас адреса без префикса — правка в `create.ts`.
2. **Сервис** `paymentForReturn(db, pid, deps)` (`services/payments/return.ts`): `pid` не UUID или платежа нет → `null` (страница 404). Платёж `pending`, у него есть `provider_payment_id`, провайдер онлайн (`providerOf`) и `allowCheck()` разрешил → `getStatus` → `applyProviderStatus` (идемпотентность, сумма, эффекты, аудит — как у вебхука и сверки). Ошибка провайдера (`not_found`, недоступен) — не ошибка страницы: лог, показываем статус из базы. Не `pending` — провайдера не спрашиваем. Истечение срока здесь не применяем (это сверка 3.5).
3. **Что отдаёт** — только `kind`, `status`, `amountMinor`, `currency`. Ни имени, ни email, ни `user_id`, ни назначения: `pid` (случайный UUID) знает только плательщик, проверки владельца нет — гость-донор без сессии тоже должен видеть итог.
4. **Лимит частоты** запросов к провайдеру: `limits.paymentReturnPerIp` = 20 / мин с IP (ключ `payment-return:ip:`), считается только когда проверка нужна (`pending`); сверх лимита — показываем статус из базы, без 429.
5. **Отмена не меняет статус.** `/payment/cancel` делает ту же проверку и показывает итог; сам платёж не отменяется (адрес возврата не подтверждение — `07` § 1 п. 3; `pending` закроет сверка по сроку). Переход «по поддельной ссылке» не даёт `paid` (`07` § 15).
6. **Страница** (`[[lang=lang]]/(site)/payment/{success,cancel}`, общий `load` и компонент `PaymentResult.svelte`), `noindex`, `cache-control: no-store`, не в sitemap. Сообщения по статусу:
   - `paid` — «Оплата получена» + по типу: взнос — «членство активно» и ссылка «Моё членство» (`/cabinet/membership`); донат — благодарность и «квитанция отправлена на email», ссылка на главную; `event_fee` — общее «спасибо».
   - `pending` на success — «Проверяем платёж…» и опрос: `invalidateAll()` каждые 3 с, до 5 раз; не дождались — «Платёж обрабатывается, мы отправим письмо»; без JS — ссылка «Обновить».
   - `pending` на cancel — «Оплата не завершена» (если деньги списаны — подтвердим и напишем) + «Попробовать снова».
   - `failed` — «Оплата не прошла» + «Попробовать снова»; `cancelled` — «Оплата отменена» + «Попробовать снова»; `refunded` — «Платёж возвращён».
   - «Попробовать снова»: взнос → `/cabinet/membership`, донат → `/donate`, событие → `/events` (регистрации — этап 5). Под заголовком — тип и сумма (`formatPrice`).
7. **`/dev/mock-pay`** (только dev): ссылка «Вернуться на сайт» ведёт как настоящий банк — `paid` → `/payment/success?pid=`, иначе → `/payment/cancel?pid=`.
    30|8. Тексты — `i18n/messages/{en,ru}-payment.ts`; HY — откат на EN.

## Файлы (ожидаемо)

- `src/lib/server/services/payments/return.ts` (+ `return.test.ts`), `index.ts` — `checkPaymentReturn(db, pid, ip)` (провайдер — `providerById`, лимит — `consume`)
- `src/lib/server/services/payments/create.ts` — язык в адресах возврата (+ `create.test.ts`)
- `src/lib/server/auth/rate-limit.ts` — `paymentReturnPerIp`
- маршруты `[[lang=lang]]/(site)/payment/{success,cancel}/+page.server.ts`, `+page.svelte`, общий `payment/return.ts`; `components/site/PaymentResult.svelte` (+ `payment-result.ts` — сообщения и ссылки по статусу, + тест)
- `src/lib/i18n/messages/{en,ru}-payment.ts`, `en.ts`, `ru.ts`; `src/routes/dev/mock-pay/[id]/+page.svelte`
- `tests/e2e/payment-return.spec.ts`

## Не ломать

    40|- Возврат на сайт не ставит `paid` сам: только ответ провайдера через `applyProviderStatus`; сумма не совпала → `failed` без эффектов (K2).
- Повтор страницы и опрос не запускают эффекты дважды (дубль → `unchanged`); вебхук и сверка работают как раньше.
- На странице нет личных данных плательщика (K4); чужой `pid` не меняет платёж (отмена ничего не отменяет).
- Старт оплаты взноса и доната (`/join`, `/cabinet/membership`, `/donate`) — без изменений, кроме языка в адресах возврата.

## Проверка

- `npx vitest --run src/lib/server/services/payments src/lib/components/site/payment-result src/lib/server/services/memberships src/lib/server/services/donations`
- `npx playwright test tests/e2e/payment-return.spec.ts tests/e2e/donate.spec.ts tests/e2e/membership.spec.ts tests/e2e/webhooks.spec.ts`; `npm run check`, `npm run lint`, `npm run test`

## Риск
    50|
`high` (платежи: страница запускает проверку статуса у провайдера и применение `paid` с эффектами; гость без сессии).

## Читать

- `07` § 1, 3, 7, 10, 14, 15; `06` § 3.3 (прочитаны в SPEC).

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
    60|- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW — общим прогоном позже (решение 2026-10-19), без push до него
- [ ] DEPLOY (только по апруву)

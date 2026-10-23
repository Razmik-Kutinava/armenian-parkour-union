# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы (REVIEW — общим шагом в конце этапа 5) — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`.

## Задача

5.4 — платное участие (`07` § 5.3): платёж `event_fee` к регистрации `pending_payment`, удержание места, освобождение по истечении, поздняя оплата, возврат. Только сервис — кнопка «Оплатить» на странице события — 5.5, баллы — 5.6, письма об оплате — 5.9, вкладка регистраций в админке — 5.7. Владелец 2026-10-22 / 2026-10-23: REVIEW этапа 5 — одним шагом в конце; здесь SPEC → RED → GREEN → REGRESS.

Решения агента (в рамках `07` § 5.3, 8, 10, 11; `03` § 7.4–7.5):
- **Старт оплаты** `startEventPayment(db, userId, eventId, locale, deps)`: только своя регистрация `pending_payment` с `hold_until > now`, событие `published` и не началось, пользователь активен. Сумма и валюта — из `events` (C11). Срок платежа — `min(payment_wait_minutes, до hold_until)`, не меньше минуты: платёж всегда истекает не позже удержания и не старше суток (сверка видит его). Блокируется только строка регистрации (`FOR UPDATE`), не событие: вызов провайдера не держит регистрации события. Повторное нажатие — тот же платёж (`pending`, тот же провайдер / сумма / валюта, не истёк); иначе новый, `event_registrations.payment_id` → новый. Отказы: `not_found`, `not_pending`, `hold_expired`, `closed`, `blocked`, `unavailable` (нет провайдера, `payment_wait_minutes`, цена 0), `invalid` (валюта не у провайдера), `provider_error` (платёж `failed`, регистрация ждёт дальше).
- **Эффекты `event_fee`** (в транзакции смены статуса, регистрация ищется по `payment_id = платёж`, порядок блокировок: платёж → событие → регистрация):
  - `paid`: `pending_payment` → `registered` (`hold_until` пусто). Поздняя оплата (регистрация `cancelled` / `waitlist`): событие `published`, не началось и есть место (общий лимит и категория) → `registered`; иначе платёж `needs_review` (`late_payment_no_seat`). Нет регистрации с этим платежом — `registration_missing`; участник заблокирован / удалён — `user_blocked`; регистрация уже активна (`registered` / `attended` / `no_show`) — `registration_already_active`. Каждая «проверка» — журнал `event_fee.review` (actor `null`, причина, регистрация).
  - `cancelled` (истёк или отменён у провайдера): регистрация `pending_payment` с истёкшим `hold_until` → `cancelled` + `fillFromWaitlist`, письма после коммита; удержание ещё идёт — ничего (можно оплатить заново).
  - `failed` — ничего (можно оплатить заново; место освободит удержание).
  - `refunded`: регистрация `registered` / `pending_payment` → `cancelled` + `fillFromWaitlist`; `attended` / `no_show` не трогаем (результаты прошедшего события). Письмо о возврате — уже есть для всех типов.
- **Освобождение по истечении** `releaseExpiredHolds(db, deps, now)`: `pending_payment` с `hold_until <= now` (и без платежа — не нажал «Оплатить», и после очереди) → `cancelled` + `fillFromWaitlist`. Платёж `pending` / `paid` — пропуск (сверка закроет или эффект активирует). Порядок блокировок: событие → регистрация, платёж читается без блокировки (опоздавший `paid` пойдёт поздней оплатой). Запуск — в `reconcileNow` после сверки (таймер 5 мин и `/api/cron/payments`), ответ cron — `+ released`.
- **Отмена участником** (5.3) + платёж: после коммита отмены — `pending` платёж → `cancelled` (`registration_cancelled`, журнал `payment.status`); `paid` → `needs_review` + журнал `event_fee.review` (`cancelled_by_member`): возврат решает админ (`03` § 7.5). Вне транзакции отмены — чтобы не брать блокировку платежа после блокировки события (иначе взаимная блокировка с эффектами).
- **Повтор после отмены** не трогает `payment_id` (5.3); новый «Оплатить» перепишет ссылку на новый платёж — старый оплаченный уже помечен «проверить» при отмене.
- **Ручное подтверждение** админом `event_fee` (`confirmPaymentManually`) — включить: те же эффекты (`07` § 9). Кнопка в карточке платежа — тоже. Ручная запись нового платежа `event_fee` (`recordManualPayment`, без привязки к регистрации) — не делаем, 5.7.

## Файлы (ожидаемо)

- `src/lib/server/services/registrations/` — `pay.ts` (старт), `payment-effects.ts` (эффекты), `release.ts` (истечение удержания), `settle-cancel.ts` (платёж после отмены участником), `cancel.ts`, `index.ts`, `test-support.ts` + тесты
- `src/lib/server/services/payments/` — `effects.ts`, `index.ts` (`reconcileNow`), `admin/confirm.ts`, `admin/test-support.ts`, `reuse.ts` (экспорт `checkoutOf`), `acceptance-event.test.ts`
- `src/routes/admin/payments/[id]/PaymentActions.svelte` — «Подтвердить вручную» для `event_fee`
- `src/lib/i18n/messages/{en,hy,ru}-registrations.ts` — описание платежа

## Не ломать

- Взнос и донат: эффекты, сверка, вебхук, ручное подтверждение (`payments/*.test.ts`, приёмочные цепочки).
- Сервис регистраций 5.3: допуск, лимит, очередь, отмена (`registrations/*.test.ts`).
- Лимит мест: поздняя оплата не превышает `capacity` (`07` § 15).
- Словари: `hy`, `ru` покрывают все ключи (`translate.test`).

## Проверка

- `npx vitest --run src/lib/server/services/registrations src/lib/server/services/payments src/lib/i18n`
- `npm run check`, `npm run lint`; REGRESS — весь Vitest

## Риск

`high` (платежи, лимит мест) — REVIEW в конце этапа 5.

## Читать

`07` § 5.3, 7, 8, 10, 11, 15 · `03` § 7 · сервис 5.3 (`registrations/*`)

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS — весь Vitest
- [ ] REVIEW — общим шагом в конце этапа 5 (решение владельца 2026-10-22)

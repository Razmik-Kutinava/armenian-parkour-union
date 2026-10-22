# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы (REVIEW — общим шагом в конце этапа 5) — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`.

## Задача

5.3 — сервис регистраций: условия допуска (`03` § 7.2), лимит и очередь ожидания, транзакции, отмена участником, перевод из очереди с письмом. Только сервис — страница события 5.5, админка 5.7, оплата 5.4, баллы 5.6, остальные письма 5.9. Владелец 2026-10-22: REVIEW этапа 5 — одним шагом в конце; здесь SPEC → RED → GREEN → REGRESS.

Решения агента (дефолты; `03` § 16 «по умолчанию», в `questions.md`):
- Настройки — ключ `site_settings.event_registration` = `{ hold_minutes: 30, offer_hours: 48, cancel_hours: 0 }` (seed добавит; битый / нет — эти же значения). `cancel_hours` у `03` § 7.5 без дефолта — 0: отмена до начала события.
- Допуск (порядок отказов): событие не видно (черновик, архив, `published_at > now`, удалено) или участник удалён — `not_found`; завершено / отменено — `closed`; уже есть живая регистрация — `already_registered`; окно — `not_open` / `closed`; заблокирован — `blocked`; email — `email_unverified`; членство — `no_membership`; у события есть категории — категория обязательна (`category_required`), чужая или лишняя — `category_invalid`; нет даты рождения — `birth_date_required`; младше 18 сегодня без действующего `parental` (`hasValidConsent`) — `parental_consent`; возраст на дату начала события (Ереван) вне `age_min…age_max` — `age_mismatch`.
- Место: занимают `registered`, `pending_payment`, `attended`, `no_show`. Лимиты — `events.capacity` и `event_categories.capacity`; любой полон — `waitlist`. Иначе бесплатное — `registered`, платное — `pending_payment` с `hold_until = now + hold_minutes` (платёж — 5.4).
- Транзакция: строка события `FOR UPDATE` первой (регистрации и отмены одного события идут по очереди). Повтор после отмены — та же строка: новый статус, категория, `registered_at = now`, результаты и платёж очищены.
- Отмена участником: свои `registered` / `pending_payment` — до `starts_at − cancel_hours`; `waitlist` — до начала. Статус `cancelled`, `hold_until` пусто. Освободилось место у опубликованного события — `fillFromWaitlist`.
- `fillFromWaitlist(tx, eventId, …)` (и для 5.4 / 5.7): очередь по `registered_at`, пропуская тех, чья категория полна; бесплатное — `registered`, платное — `pending_payment` с `hold_until = now + offer_hours`. Письмо «место освободилось» — после коммита, на языке участника, ошибка отправки не отменяет перевод. Повторно условия допуска при переводе не проверяются.
- Журнал действий не пишем (действие участника, не админа). Баллы за регистрацию / снятие при отмене — 5.6; платёж `pending_payment` при отмене — 5.4; возврат — решает админ.
- Повтор после отмены не трогает `payment_id` (старый платёж может требовать возврата; ссылки из `payments` на регистрацию нет — решить в 5.4). Гонка одновременных регистраций (тест с коммитами) — 5.10; здесь защита — блокировка строки события.

## Файлы (ожидаемо)

- `src/lib/server/services/registrations/` — `settings.ts`, `admission.ts` (чистая проверка), `admission-data.ts` (чтение под блокировкой), `seats.ts`, `register.ts`, `cancel.ts`, `waitlist.ts`, `mail.ts`, `index.ts`, `test-support.ts` + тесты
- `src/lib/server/seed/settings.ts` (+ test) — ключ `event_registration`
- `src/lib/i18n/messages/{en,hy,ru}-registrations.ts`, `{en,hy,ru}.ts`

## Не ломать

- Согласия 5.2 (`hasValidConsent`), членство (`getMembershipOverview`) — только читаем.
- Seed: добавляет только недостающие ключи.
- Словари: `hy`, `ru` покрывают все ключи (`translate.test`).

## Проверка

- `npx vitest --run src/lib/server/services/registrations src/lib/server/seed src/lib/i18n`
- `npm run check`, `npm run lint`; REGRESS — весь Vitest

## Риск

`high` (допуск несовершеннолетних, лимиты под гонкой) — REVIEW в конце этапа 5.

## Читать

`02` § 3 (`event_registrations`) · `03` § 7, 13, 16 · `04` § 3.1 · `07` § 5.3

## Фазы

- [x] SPEC
- [x] RED (`test: … [RED]`) — модулей `registrations/*` нет, ключа seed `event_registration` нет
- [x] GREEN (`feat: … [GREEN]`) — Vitest зоны 90/90 (registrations 31, seed, i18n); `check` 0, `lint` чистый
- [x] REGRESS — Vitest 1015/1015 (168 файлов); e2e не трогали (маршрутов нет)
- [ ] REVIEW — общим шагом в конце этапа 5 (решение владельца 2026-10-22)

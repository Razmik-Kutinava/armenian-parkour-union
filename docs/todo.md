# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы (REVIEW — общим шагом в конце этапа 5) — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`.

## Задача

5.5 — страница события: полный блок регистрации со всеми состояниями (`06` § 4.3). Кнопки «Зарегистрироваться» / «Встать в очередь» / «Оплатить участие» / «Отменить регистрацию», ожидание оплаты со сроком, отказы допуска. Баллы — 5.6, админка регистраций — 5.7, «Мои события» — 5.8, письма — 5.9. REVIEW — общим шагом в конце этапа 5; здесь SPEC → RED → GREEN → REGRESS.

Решения агента (в рамках `06` § 4.3, 9; `03` § 7, 13):
- **Состояние блока** вычисляет сервис `registrationView(db, userId | null, eventId, deps, now)` (`services/registrations/view.ts`), без блокировок; та же проверка — в `registerForEvent` при отправке. Состояния: `guest`; `mine` — своя регистрация: `registered` (и `attended` / `no_show`), `pending_payment` (срок `holdUntil`, истёк — «время на оплату истекло», без кнопки), `waitlist`; у каждой — `cancelUntil` (дата, до которой можно отменить, или `null` — поздно; правило то же, что в `cancelRegistration`); `refused` — первая причина отказа в порядке `checkAdmission` (окно → блокировка → email → членство → дата рождения → согласие родителя), без категории; категории есть, но возраст не подходит ни под одну — `age_mismatch`; `open` — допущенные по возрасту категории с пометкой «мест нет» и общее «мест нет» (кнопка «Встать в очередь»). Событие не `published` (завершено, отменено) — блока нет.
- **Платное событие при выключенной онлайн-оплате** (`onlineProvider` = `null` или нет `payment_wait_minutes`; сейчас так на проде): новая регистрация и очередь — отказ `payment_unavailable` («онлайн-оплата недоступна, регистрация на платное событие временно закрыта»), иначе место удерживалось бы без возможности оплатить. Уже существующая `pending_payment` показывает «Оплатить» — нажатие даёт «оплата недоступна». Проверка — и в блоке, и в `registerForEvent` (`deps.paymentsOn`, по умолчанию включено — тесты 5.3 / 5.4 не меняются).
- **Отказы допуска** — текстом с действием: членство — ссылка на `/join`; согласие родителя — `/cabinet/documents`; email — «подтвердите email» (ссылка на `/cabinet/profile`); дата рождения — `/cabinet/profile`; окно не началось — дата открытия.
- **Действия** (`events/[slug]/registration-actions.ts`): `register` (категория из формы), `pay` (провайдер — redirect на оплату, как взнос), `cancel`. Пользователь — только из сессии, событие — по slug из адреса (id из формы не берём). Гость — на вход с возвратом. Отказы — `fail` с причиной, сообщение у блока. Регистрация на платное — сначала «Зарегистрироваться» (место удерживается), затем «Оплатить участие» с оставшимся временем.
- **«Попробовать снова»** на `/payment/cancel` для `event_fee` — на страницу события (`eventSlugForPayment`: регистрация с этим платежом → slug, событие видно на сайте); иначе `/events`.
- Предпросмотр события в админке — без блока регистрации (только окно).

## Файлы (ожидаемо)

- `src/lib/server/services/registrations/` — `view.ts` (+ `view.test.ts`), `register.ts` (`paymentsOn`), `cancel.ts` (`cancelDeadline`), `admission-data.ts` (`readAdmission` без блокировки), `return-link.ts`, `index.ts` (`registrationViewNow`, `paymentsOnNow`)
- `src/lib/server/services/events/public.ts` — `id` категории в `PublicEvent`
- `src/routes/[[lang=lang]]/(site)/events/[slug]/` — `+page.server.ts`, `+page.svelte`, `registration-actions.ts`, `RegistrationBlock.svelte`, `RegisterForm.svelte`
- `src/lib/components/site/EventArticle.svelte` — место для блока (snippet)
- `src/lib/components/site/payment-result.ts` (+ test), `src/routes/[[lang=lang]]/(site)/payment/return.ts`
- `src/lib/i18n/messages/{en,hy,ru}-registrations.ts`
- `tests/e2e/event-registration.spec.ts`, `tests/e2e/events.spec.ts` (кнопка-заглушка → ссылка на вход)

## Не ломать

- Сервис регистраций и оплаты 5.3–5.4 (`registrations/*.test.ts`, `payments/acceptance-event.test.ts`).
- Страница события для гостя и предпросмотр в админке (`events.spec`), SEO и микроразметка.
- Страница возврата платежа для взноса и доната (`payment-result.test`, `payment-return.spec`).
- Словари: `hy`, `ru` покрывают все ключи (`translate.test`).

## Проверка

- `npx vitest --run src/lib/server/services/registrations src/lib/components/site src/lib/i18n`
- `npx playwright test tests/e2e/event-registration.spec.ts tests/e2e/events.spec.ts tests/e2e/payment-return.spec.ts`
- `npm run check`, `npm run lint`; REGRESS — весь Vitest

## Риск

`high` (права участника на свою регистрацию, платежи) — REVIEW в конце этапа 5.

## Читать

`06` § 4.3, 9 · `03` § 7, 13 · сервис 5.3–5.4 (`registrations/*`)

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REGRESS
- [ ] REVIEW — общим шагом в конце этапа 5 (решение владельца 2026-10-22)

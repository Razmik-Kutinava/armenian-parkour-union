# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы (REVIEW — общим шагом в конце этапа 5) — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`.

## Задача

5.7 — админка регистраций (`05` § 5). Делится на три шага (решение владельца 2026-10-23: разбить, REVIEW — общим шагом в конце этапа 5):

- **5.7a** — защита и отмена события (GREEN `d8bfcc0`, памятка ниже): понятный отказ при удалении категории и события с регистрациями; отмена события админом отменяет активные регистрации, снимает баллы за регистрацию, разбирает платежи.
- **5.7b (текущий)** — вкладка «Регистрации» (`registrations.read` / `registrations.manage`): список с фильтрами (статус, категория, оплачено), перевести из очереди, отменить регистрацию, добавить участника вручную (без баллов за регистрацию), экспорт CSV; редактор — только число.
- **5.7c** — «День события» (телефон: поиск, «пришёл» / «не пришёл» одним нажатием) и «Результаты» (место, оценка таблицей, «Завершить событие»); `awardEventResult` при «пришёл» и месте.

### 5.7b — SPEC

Права (`04` § 3, 4, 5.1): список и CSV — `registrations.read`, действия — `registrations.manage` (moderator, admin); модератору — имя и возраст, без email / телефона / даты рождения; email — только с `users.read_full` (admin), как в журнале баллов; платёж — только признак «оплачено», ссылка на платёж — с `payments.read`. Редактор (`events.write`) видит только число регистраций (страница события и колонка списка событий).

Решения агента 5.7b (в рамках `03` § 6.2, 7, `05` § 5):
- **Адрес** — раздел меню «Регистрации» (`/admin/registrations`, уже в меню, `decisions.md` 2026-10-07): список событий с числами → `/admin/registrations/[id]` (вкладка события; 5.7c — `…/[id]/day`, `…/[id]/results`), CSV — `GET /admin/registrations/[id]/export`. С карточки события админу — ссылка на вкладку.
- **Список**: участник, возраст на день события, категория, статус, оплачено (только платное событие), дата регистрации, «пришёл», место, оценка; фильтры `status`, `category`, `paid` (`1` / `0`); поиск по имени (admin — и по email); порядок — по дате регистрации (очередь), по возрастанию.
- **Перевести из очереди** (`waitlist` → место): только при свободном месте в событии и категории (иначе отказ `full` — сначала поднять лимит; правка лимита очередь сама не двигает); событие `published` (и после начала — для «Дня события»); бесплатное → `registered` + баллы за регистрацию (регистрация создана через сайт, `03` 6.2 п. 5); платное → `pending_payment`, срок оплаты `offer_hours`, письмо «место ваше» — как автоматический перевод. Журнал `registration.promote`.
- **Отменить регистрацию** сотрудником: `registered` / `pending_payment` / `waitlist`, без срока `cancel_hours`, причина обязательна; событие не `finished` / `cancelled` / `archived`; баллы за регистрацию — обратно до начала (`takeBackRegistration`), освободившееся место — очереди (`fillFromWaitlist`, письма после коммита); после коммита платёж: `pending` → `cancelled` (`registration_cancelled`), `paid` → «проверить» (`event_fee.review`, причина `cancelled_by_staff`). Журнал `registration.cancel` (статус до, причина). Письмо участнику — 5.9.
- **Добавить вручную**: участник по email или id; событие `published` (окно регистрации и начало не проверяются — «День события»); остальные условия `03` § 7.2 — как у участника (членство, email, согласие родителя до 18, категория и возраст, не заблокирован, ещё не зарегистрирован); нет места — отказ `full`; статус `registered` **без платежа и без баллов** за регистрацию (`03` 6.2 п. 5) — и на платном событии (оплату вне сайта сотрудник решает сам — **вопрос владельцу**); отменённая раньше строка переиспользуется. Журнал `registration.add`.

## Файлы 5.7b (ожидаемо)

- `src/lib/server/services/registrations/staff/` (новые): `list.ts` (список, фильтры, числа), `export.ts` (CSV), `promote.ts`, `cancel.ts`, `add.ts`, `index.ts` (обёртки с настройками и почтой); `admission.ts` — `checkStaffAdmission` (без окна); `settle-cancel.ts`, `fee-review.ts` — причина `cancelled_by_staff`
- `src/routes/admin/registrations/` (новые): `+page.server.ts`, `+page.svelte`, `[id]/+page.server.ts`, `[id]/+page.svelte`, `[id]/export/+server.ts`; `admin/events/+page.*`, `admin/events/[id]/+page.*` — число
- `src/lib/i18n/messages/{en,hy,ru}-registrations-admin.ts`
- `tests/e2e/admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-registrations.ts` (новый), `admin-permissions-fixtures.ts`
- тесты: `staff/list.test.ts`, `staff/export.test.ts`, `staff/actions.test.ts`, `registrations/points-staff.test.ts` (правила — проект `server-points`)

## Не ломать 5.7b

- Регистрация и отмена участником, очередь, платежи участия 5.3–5.6, отмена события 5.7a (`registrations/*.test.ts`, `payments/acceptance-event.test.ts`).
- Права: редактор и участник не видят список и не выполняют действия (`admin-permissions.spec`, `access-coverage`); модератору не уходят email и дата рождения.
- Порядок блокировок: событие → регистрации → пользователь; платёж — своей транзакцией после коммита.

## Проверка 5.7b

- `npx vitest --run src/lib/server/services/registrations src/routes/admin/access-coverage.test.ts`
- `npm run check`, `npm run lint`; REGRESS — весь Vitest, e2e `admin-permissions`, `admin-audit`, `events`, `event-registration`

## Фазы 5.7b

- [x] SPEC
- [x] RED — 6 файлов (`staff/{list,export,promote,cancel,add}.test.ts`, `points-staff.test.ts`) падают: модулей `staff/*` нет
- [x] GREEN — `services/registrations/staff/*`, `/admin/registrations` (+ `[id]`, `[id]/export`), число на `/admin/events` и карточке события, карты e2e; Vitest зоны 167/167, `check` 0, `lint` чистый
- [x] REGRESS — весь Vitest 1090/1090; e2e `admin-permissions` + `admin-audit` + `events` + `event-registration` 13/13
- [ ] REVIEW — общим шагом в конце этапа 5

Не сделано / для REVIEW и следующих шагов 5.7b:
- Письмо участнику об отмене регистрации сотрудником — 5.9.
- Правка лимита события очередь сама не двигает — сотрудник переводит вручную («Дать место»).
- Просмотр списка и выгрузка CSV в журнал не пишутся (как у остальных списков админки).
- Страница вкладки в браузере руками не проверялась: e2e открывает её модератором и админом (200) и выполняет все три действия через HTTP.

### 5.7a — памятка

Решения агента 5.7a (в рамках `03` § 6.2 п. 6, § 7 п. 8, `05` § 5 «Правила»):
- **Категория с регистрациями** (любой статус — строка ссылается внешним ключом) — `deleteEventCategory` → `'in_use'`, категория и журнал без изменений; в админке — сообщение у категории вместо 500.
- **Событие с регистрациями** (любая строка) — `deleteEvent` → `'has_registrations'`: «удалить нельзя, только отменить»; в админке — сообщение.
- **Отмена события** (`cancelEvent`, admin): в той же транзакции все `registered` / `pending_payment` / `waitlist` → `cancelled` (`hold_until` пусто); у бывших `registered` — `takeBackRegistration` (до начала — обратная запись, после — ничего). `attended` / `no_show` не трогаются. Очередь не двигается (событие уже `cancelled`). В журнал `event.cancel` — число отменённых регистраций. После коммита платежи участия: `pending` → `cancelled` (`failure_reason = event_cancelled`), `paid` → «проверить» (`event_fee.review`, причина `event_cancelled`) — возврат решает админ (`03` 7.8). Письма участникам — 5.9.

## Файлы 5.7a

- `src/lib/server/services/events/categories.ts`, `lifecycle.ts` — отказы, отмена
- `src/lib/server/services/registrations/event-cancel.ts` (новый) — отмена регистраций события; `settle-cancel.ts`, `fee-review.ts` — причина `event_cancelled`
- `src/routes/admin/events/[id]/+page.server.ts`, `categories.ts`, `+page.svelte`, `EventCategories.svelte` — сообщения
- `src/lib/i18n/messages/{en,hy,ru}-events.ts`
- тесты: `services/events/registrations-guard.test.ts`, `services/registrations/event-cancel.test.ts`, `services/registrations/points-event-cancel.test.ts` (правила — проект `server-points`)

## Не ломать 5.7a

- Отмена участником и платежи участия 5.3–5.6 (`registrations/*.test.ts`, `payments/acceptance-event.test.ts`).
- Действия событий 2.5 (`events/edit.test.ts`, `categories.test.ts`): статусы, журнал, права (`events.cancel` — только admin).
- Порядок блокировок: событие → регистрации → пользователь (`appendEntry`); платёж — своей транзакцией после коммита.

## Проверка 5.7a

- `npx vitest --run src/lib/server/services/events src/lib/server/services/registrations src/lib/server/services/payments`
- `npm run check`, `npm run lint`; REGRESS — весь Vitest, e2e `events`

## Риск (5.7a, 5.7b)

`high` (баллы, платежи, права, личные данные) — REVIEW в конце этапа 5.

## Читать (5.7a, 5.7b)

`03` § 6.2, 7 · `04` § 3, 4, 5.1 · `05` § 2, 5 · сервис регистраций 5.3–5.6

## Фазы 5.7a

- [x] SPEC
- [x] RED (`58c19cd`) — 5 из 7 падают (отказов нет, FK-ошибка, регистрации и платежи не трогаются); «возврат после отмены» и «после начала баллы остаются» — зелёные сразу (охрана)
- [x] GREEN — `registrations/event-cancel.ts` (`cancelEventRegistrations`, `settleEventPayments`, `hasRegistrations`), отказы `in_use` / `has_registrations`, `settleCancelledPayment(…, 'event_cancelled')`; Vitest зоны 315/315, `check` 0, `lint` чистый
- [x] REGRESS — e2e `events` + `event-registration` 8/8; весь Vitest 1070/1070 (первый прогон 1069/1070 — тест seed, см. ниже)
- [ ] REVIEW — общим шагом в конце этапа 5

Уточнения при GREEN / REGRESS:
- `seed/points-rules.test.ts` удалял правила баллов, а с 5.6 e2e `event-registration` оставляет в `parkour_dev` закоммиченные начисления `event_registration` со ссылкой на правило (`rule_id`) — удаление падало на внешнем ключе. Тест теперь не удаляет, а переименовывает коды внутри своей откатываемой транзакции. Не связано с 5.7a, проявилось первым полным Vitest после e2e 5.6.
- Отмена события после начала тоже отменяет активные регистрации (кто не отмечен «пришёл»), но баллы за регистрацию не снимаются (`03` 6.2 п. 6 — только до начала).
- Платёж участия при отмене события: `pending` отменяется, `paid` — «проверить» (`event_fee.review`, `event_cancelled`), после ручного возврата регистрация уже `cancelled` — эффект возврата ничего не меняет.

Не сделано / для REVIEW и следующих шагов:
- Письма участникам об отмене события — 5.9.
- Сообщение «отменено N регистраций» в админке не показывается — число только в журнале `event.cancel`.

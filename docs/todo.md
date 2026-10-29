# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.3 — заявка на книжку из кабинета; выдача, отказ, отзыв в админке; журнал действий; письма (`03` 19.1, 19.2, 19.9; `05` 28 «Книжки»; `06` 5.12 — только блок «Книжка»). Миграции нет: `volunteer_cards` из 0018.

## Файлы (ожидаемо)

- `src/lib/server/services/volunteer/card-rules.ts` (+ test) — чистые функции: чего не хватает для заявки (`email`, `membership`, `photo`, `privacy`), действительность (`03` 19.2) и почему нет, формат номера `APU-V-{год}-{0001}`
- `src/lib/server/services/volunteer/card-facts.ts` — чтение в транзакции: участник под блокировкой, членство (`paidUntil`), согласие `privacy` в силе; `federationEmail`
- `src/lib/server/services/volunteer/card-apply.ts` (+ test) — подача и повторная подача (та же строка → `pending`), письмо админу после коммита
- `src/lib/server/services/volunteer/card-decision.ts` (+ test) — выдать / отказать / отозвать: блокировка строки, условия заново при выдаче, номер под advisory lock, новый `public_token`, журнал, письмо участнику после коммита
- `src/lib/server/services/volunteer/card-mail.ts` — письма: заявка (админу, en), выдана, отказ, отзыв (участнику, его язык)
- `src/lib/server/services/volunteer/cards-admin.ts` (+ test) — список (фильтры, поиск, действительность в SQL), карточка; `card-own.ts` (+ test) — состояние для кабинета
- маршруты: `src/routes/admin/volunteer/cards/` (список, `[id]` с действиями `issue` / `reject` / `revoke`), `src/routes/[[lang=lang]]/(site)/cabinet/volunteer/` (блок «Книжка», действие `apply`); меню админки (`nav.ts`) и кабинета (`+layout.svelte`)
- переводы `{en,hy,ru}-volunteer-cards.ts` (админка, кабинет, письма); e2e-карты `admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-volunteer.ts`, `admin-permissions-volunteer.ts`; `tests/e2e/volunteer-cards.spec.ts`

## Решения агента (в пределах документов)

1. Действия «Выдать» / «Отказать» / «Отозвать» — в карточке книжки, а не в строке списка: фото (оно идёт в книжку) admin видит до выдачи. Список — очередь со ссылками.
2. Журнал: `volunteer_card.issue|reject|revoke`, `entity_type = 'volunteer_card'`; в `after` — статус, `userId`, номер, причина. Токен страницы проверки в журнал не пишется. Подача заявки в журнал не идёт (`03` 19.9 перечисляет только решения — как у доступа к курсу).
3. Условия заявки в порядке показа: `email` (подтверждён), `membership` (действующее), `photo` (`avatar_key`), `privacy` (до 18 — согласие в силе). Заблокированный — отказ `blocked`; удалённый — `not_found`. Без даты рождения — как взрослый (так же, как `consents/valid.ts` `kindsFor`).
4. Действительность (`03` 19.2): причины `status` (не `active`), `membership`, `blocked`, `privacy`; «действительна до» — `paidUntil` из `memberships/overview` (с оплаченным продлением). В SQL списка — то же выражение для фильтра «действительна».
5. Повторная подача (после `rejected` / `revoked`): `applied_at = now`, `reviewed_*` и `review_note` — `null`; номер и старый токен остаются до новой выдачи (книжка не `active` — страница проверки всё равно ❌). Подача при `pending` / `active` — `bad_state`; две одновременные первые подачи — unique `user_id` → `bad_state`.
6. Номер — при первой выдаче: год выдачи по Еревану, `pg_advisory_xact_lock(hashtext('volunteer_card_number'))`, max+1 по году (как `certificates/number.ts`). Токен — `newPublicToken()` (24 байта).
7. Письмо админу — на `site_settings.contacts.email`, по-английски, ссылка на карточку; адреса нет — предупреждение в лог, заявка создана. Письма участнику — его язык, ссылка на `/cabinet/volunteer`; у выдачи — номер и «действительна до». Ошибка почты решение не откатывает.
8. Карточка в 10.3: участник (ссылка на `/admin/users/{id}`), фото, возраст, email, статус, номер, даты, кто решил, причина, «действительна до» / почему нет, ссылка на страницу проверки (страница — 10.5). PDF — 10.4; приглашения, использования, фотоотчёты — 10.7–10.10; «Снять пометку» — 10.9.
9. Кабинет в 10.3: только блок «Книжка» (`06` 5.12, все состояния); у `active` и действительной — номер и «действительна до»; QR и PDF — 10.4. Недействительная из-за членства — кнопка «Продлить» → `/cabinet/membership`.

## Не ломать

- Права: модератор и редактор не открывают `/admin/volunteer/**` (403), участник — 404; участник видит и подаёт только свою книжку (id из сессии).
- Партнёры и плюшки (10.2), карты e2e остальных разделов, меню кабинета и админки.
- Согласия и членство: только чтение, их сервисы не меняются.

## Проверка

- `npx vitest run src/lib/server/services/volunteer src/lib/server/admin/nav.test.ts src/routes/admin/access-coverage.test.ts src/routes/admin/audit-coverage.test.ts`
- `npx playwright test tests/e2e/volunteer-cards.spec.ts`; `npm run check`, `npm run lint`

## Риск

`high` — права, личные данные (фото, возраст, email, данные до 18), журнал действий.

## Читать

- `03` § 19.1, 19.2, 19.9; `02` § 12 `volunteer_cards`; `05` § 28 «Книжки»; `06` § 5.12 (блок «Книжка»); `04` 5.1 (`volunteer.manage`)
- `zone-notes.md` § «Волонтёрство»
- образцы: `services/training/access.ts`, `access-decision.ts`, `access-mail.ts`, `access-list.ts` (членство в SQL), `access-facts.ts` (`federationEmail`), `certificates/number.ts`, `consents/valid.ts`; маршруты `admin/training/access`, `admin/consents/[id]`, `cabinet/training`

## Фазы

- [x] SPEC
- [x] RED
- [x] GREEN
- [ ] REVIEW (этапа)

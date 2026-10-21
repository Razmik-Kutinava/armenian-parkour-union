# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`.

## Задача

4.5 Кабинет `/cabinet/points`: баланс, журнал, подсказка «как заработать» из активных правил. REVIEW — общий в конце этапа 4 (решение владельца 2026-10-21), здесь — до REGRESS.

Требования (`06` § 5.6, `03` § 6):
- Баланс — `users.points_balance`; журнал — только свои записи (`user_id` из сессии, `04` § 5.3), новые сверху, по 25 на страницу.
- Колонки: дата, причина, источник, сумма (+/−), комментарий. Записи не правятся (`03` § 6.3): отменённая помечена «отменено», у `reversal` — «отмена записи от <дата>».
- Источник: тип источника переводом (сертификат / регистрация на событие / видео), у `manual` — «Федерация»; имя автора-сотрудника участнику не показываем. Название события / сертификата — с этапами 5–7.
- Фильтр: причина (enum) и период «с — по» по дням Еревана (`validDay`, `ZONE`, как в админке); чужие ключи URL игнорируются (`readListState`).
- «Как заработать»: активные правила с баллами > 0, название на языке страницы (откат на EN), баллы; сортировка — баллы по убыванию, затем код.
- Ссылка в магазин — нет: магазина нет до этапа 7 (ссылка дала бы 404); добавить в 7.
- Меню кабинета — пункт «Баллы»; обзор — ссылка «Журнал баллов» в карточке баллов (`06` § 5.1).

## Файлы (ожидаемо)

- `src/lib/server/services/cabinet/points.ts` — `listOwnPoints(db, userId, state)`, `howToEarn(db, locale)`, `pointsListOptions` кабинета
- `src/lib/server/services/cabinet/points.test.ts` — Vitest с базой
- `src/routes/[[lang=lang]]/(site)/cabinet/points/+page.server.ts`, `+page.svelte` (+ при необходимости компонент фильтра)
- `src/routes/[[lang=lang]]/(site)/cabinet/+layout.svelte` (меню), `cabinet/+page.svelte` (ссылка на журнал)
- `src/lib/i18n/messages/en-cabinet-points.ts`, `ru-cabinet-points.ts` (+ подключение в `en.ts` / `ru.ts`)
- `tests/e2e/cabinet-points.spec.ts` (`cabinet.spec.ts` уже 203 строки — не дописывать)

## Не ломать

- Участник видит только свой журнал; чужой `userId` из URL / формы не влияет (данные — из сессии).
- Гость на `/cabinet/points` — на вход с возвратом.
- Админский журнал `/admin/points` и его фильтры (`pointsConditions` переиспользуется — без изменений).
- Записи журнала только читаются: страница ничего не пишет в `points_ledger` / `users`.

## Проверка

- `npx vitest run src/lib/server/services/cabinet src/lib/server/services/points`
- `npx playwright test tests/e2e/cabinet-points.spec.ts tests/e2e/cabinet.spec.ts tests/e2e/admin-points.spec.ts`

## Риск

`high` (баллы, личные данные). Субагенты — в общем REVIEW этапа 4.

## Читать

- `06` § 5.1 (обзор — ссылка на журнал), § 5.6 (баллы)
- `03` § 6 (правила и журнал)

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW — общий в конце этапа 4
- [ ] DEPLOY (только по апруву владельца)

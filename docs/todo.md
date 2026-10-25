# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

8.1 Дашборд админки (`05` § 3): `/admin` показывает то, что требует внимания; каждый блок и счётчик — только тем, у кого есть право на раздел (`04` § 5.1).

Решения (агент, по `05` § 3):
1. «Требует действия» — видео `pending` (`videos.moderate`), согласия `pending` (`consents.review`), заказы `new` (`shop.orders_manage`), платежи «требуют проверки» `needs_review` (`payments.read`; `failed` — брошенная оплата, действия не требует), очередь ожидания на неотменённых, неудалённых, ещё не закончившихся событиях (`registrations.read`). Ссылки — на список с этим фильтром.
2. «Ближайшие события» — все роли: 3 опубликованных неудалённых, ещё не закончившихся, по началу; места / лимит и очередь как в `/admin/registrations`. Ссылка — регистрации (`registrations.read`), иначе редактирование (`events.write`).
3. «Главная сейчас» — `hero.write`: блоки, которые сейчас на главной (`shownHeroIds`), ссылка на `/admin/hero`.
4. «Последние регистрации» — `users.read_full` (admin): 10 последних неудалённых пользователей, имя, email, дата.
5. «Подозрительные баллы» — `points.adjust` (admin): записи за 7 дней по порогам `points_suspicious`, число и 5 последних, ссылка на журнал с фильтром.
6. «Короткая статистика» — `payments.read` (admin): пользователей (неудалённых), активных членств (`active`, `ends_at > now`, по людям), оплаченных платежей за текущий месяц по Еревану — по видам и валютам (число, сумма).

## Файлы (ожидаемо)

- `src/lib/server/services/dashboard/attention.ts` — счётчики «требует действия» по правам
- `src/lib/server/services/dashboard/events.ts` — ближайшие события и «главная сейчас»
- `src/lib/server/services/dashboard/admin.ts` — последние пользователи, подозрительные баллы, статистика
- `src/lib/server/services/dashboard/index.ts` — `getDashboard(db, viewer)`
- `src/lib/server/services/dashboard/*.test.ts` — тесты сервисов (дельты в откатываемой транзакции)
- `src/routes/admin/+page.server.ts`, `+page.svelte` (+ компоненты блоков) — страница
- `src/lib/i18n/messages/{en,hy,ru}-dashboard.ts` — тексты
- `tests/e2e/admin-dashboard.spec.ts` — блоки по ролям

## Не ломать

- Меню и шапка админки (`admin-shell.spec.ts`): дашборд — первый пункт, открыт всем сотрудникам.
- Участник и гость в `/admin` не попадают (404 / вход, `admin-access.spec.ts`).
- Модератор не видит email, суммы платежей и статистику; редактор — счётчики модерации.

## Проверка

- `npx vitest --run src/lib/server/services/dashboard`
- `npx playwright test admin-dashboard admin-shell`

## Риск

normal (чтение по правам, без записи; данные — только тем, у кого право на раздел)

## Читать

- `05` § 3 (прочитано: блоки и роли — выше)
- `04` § 5.1 — коды прав (`src/lib/server/auth/permissions.ts`)

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW

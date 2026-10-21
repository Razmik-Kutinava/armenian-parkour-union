# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`.

## Задача

4.4a — админка «Журнал баллов» `/admin/points` (`05` § 12): список с фильтрами, ручная корректировка, отмена записи, экспорт CSV. Миграции нет.
4.4 делится на два цикла SBR (как 1.10a/b, решено 2026-10-21): **4.4a** — журнал (этот todo); **4.4b** — `/admin/point-rules` (`05` § 13) + фильтр «подозрительное» с порогами в `site_settings` (`03` § 6.4; пороги — `decisions.md` 2026-10-21).

**Что делаем (4.4a):**
- **Список** `/admin/points` (`points.read`: moderator — только чтение, admin — с действиями), 25 на страницу, фильтры в URL (`readListState`), сортировка по дате и сумме. Колонки: дата, участник (имя + email, ссылка на карточку), сумма (+/−), причина (перевод enum `points_reason`), источник (`source_type` + короткий id), комментарий, кто выполнил (имя или «система»), отметка «отменена» (есть запись с `reversal_of_id` = эта).
- **Фильтры:** участник — поиск `q` по имени / email (или точный id); причина — enum; период `from` / `to` (дни по Еревану, `validDay`, как платежи); «ручные операции» — `created_by is not null`; «сумма больше N» — `abs(delta) > N` (целое ≥ 0, иначе фильтр игнорируется).
- **Ручная корректировка** `/admin/points/new` (admin): шаг 1 — email участника (GET `?email=`), страница показывает имя и текущий баланс; шаг 2 — сумма (+ или −, целое ≠ 0) и комментарий (обязателен), диалог подтверждения «было X → станет Y»; сервер — только `adjustPoints`; после — на той же странице сообщение «баланс X → Y» и ссылка в журнал с фильтром по участнику. Отказы сервиса (`insufficient_balance`, `not_found`, `invalid`) — понятная ошибка у формы.
- **Отмена записи** — action `?/reverse` на списке (admin): диалог с подтверждением и комментарием; кнопки нет у `reversal` и у уже отменённых; сервер — только `reverseEntry`; отказы (`already_reversed`, `not_reversible`, `insufficient_balance`) — сообщение.
- **Экспорт CSV** `GET /admin/points/export` — по текущим фильтрам, до 10 000 строк, BOM, `toCsv` (как платежи). Только admin: `requirePermission(…, 'points.adjust')` (решено 2026-10-21).
- Права — `requirePermission` в каждом load / action / endpoint; actor и IP — из сессии и запроса; сервис сам проверяет `points.adjust`.
- Журнал действий пишет сервис (`points.adjust`, `points.reverse`) — новые записи в `admin-audit-map.ts`; страницы и действия — в `admin-access-map.ts`.

## Файлы (ожидаемо)

- `src/lib/server/services/points/admin-list.ts` (+ `.test.ts`) — список, фильтры, признак «отменена», `pointsListOptions`
- `src/lib/server/services/points/admin-export.ts` (+ `.test.ts`) — выборка для CSV и `pointsCsv`
- `src/lib/server/services/points/member.ts` — участник по email (имя, баланс) для шага 1 корректировки
- `src/lib/validation/admin-points.ts` — Zod: корректировка, отмена
- `src/routes/admin/points/+page.server.ts`, `+page.svelte` (+ компонент строки / диалога отмены) — список и `?/reverse`
- `src/routes/admin/points/new/+page.server.ts`, `+page.svelte` — корректировка
- `src/routes/admin/points/export/+server.ts` — CSV
- `src/lib/i18n/messages/{en,hy,ru}-points-admin.ts` — тексты раздела
- `tests/e2e/admin-points.spec.ts`, `tests/e2e/admin-access-map.ts`, `tests/e2e/admin-audit-map.ts`
- `tests/e2e/admin-audit-points.ts` (+ `admin-audit-actions.ts`) — действия раздела для `admin-audit.spec`
- `tests/e2e/admin-permissions-fixtures.ts`, `admin-permissions.spec.ts` — враждебная форма с `delta` / `entryId`, баллы цели не меняются
- `src/lib/components/admin/FilterBar.svelte` — тип фильтра `number` (для «сумма больше N»)

## Не ломать

- Баллы пишет только `services/points` (`appendEntry`): маршруты не трогают `points_ledger` / `users.points_balance` напрямую; баланс ≥ 0, запись отменяется один раз.
- Модератор видит журнал, но корректировка, отмена и экспорт — 403 и по прямому POST / GET; редактор и участник — 403 на всё.
- Журнал действий: `points.adjust` / `points.reverse` с IP; `audit-coverage` и `access-coverage` зелёные.
- Остальная админка (меню, `users`, `payments`) и тесты сервиса баллов 4.3.

## Проверка

- `npx vitest run src/lib/server/services/points src/routes/admin` — сервис, список, `access-coverage` / `audit-coverage`
- `npx playwright test tests/e2e/admin-points.spec.ts tests/e2e/admin-access.spec.ts tests/e2e/admin-audit.spec.ts`

## Риск

`high` — баллы, права (`bugbot` + `security-review`).

## Читать

- `05 § 12` — колонки, фильтры, действия, модератор только читает (выписано выше)
- `03 § 6.3` — комментарий обязателен, отмена один раз, баланс ≥ 0, всё в `audit_log`
- `04` — `points.read` moderator + admin; `points.adjust` admin (строки 87–89, 151–153)
- `02 § 5` — поля `points_ledger`

## Фазы

- [x] SPEC
- [x] RED (`test: … [RED]`) — Vitest: 4 файла не находят модули, `access-coverage` / `audit-coverage` падают на новых записях карт; e2e не гонялись (нет маршрутов)
- [x] GREEN (`feat: … [GREEN]`) — Vitest зоны 41/41 (`audit-coverage` под параллельной нагрузкой — таймаут 20 с, отдельно зелёный), e2e `admin-points` + `admin-permissions` + `admin-audit` 7/7, `check` 0, eslint чистый. Попутно: `toCsv` не ставит `'` перед числами (иначе `-40` в CSV — текст); `FilterBar` — тип `number`; армянские тексты — откат на EN, как в других разделах
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

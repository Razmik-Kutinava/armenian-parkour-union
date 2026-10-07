# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

**1.10a** — админка «Пользователи» (`05` разд. 6) и «Админы и роли» (разд. 23) + сервис `audit.ts` (запись в той же транзакции). Объём — `decisions.md` 2026-10-07. Опасная зона: права, роли, блокировка.

- Список `/admin/users` (`users.read_limited`): имя, email, степень, роль, баллы, статус, дата; фильтры степень, роль, статус, возраст (до/от 18), город; поиск по имени, email, телефону. Модератор (`04` разд. 4, 6.5): без email и телефона (не отдаются, поиск по ним недоступен), видит только `member`. Значения фильтров — только из enum. Удалённые (`deleted_at`) не показываются.
- Карточка `/admin/users/[id]`: вкладка «Профиль» (модератор — без email, телефона, даты рождения: только возраст; данные родителя видит), вкладка «История действий» (только `audit.read`). Чужая роль ≥ своей для модератора → 404.
- Действия (admin, каждое с `requirePermission` и записью в `audit_log` с IP): правка профиля (`users.write`, без смены email), смена роли (`users.set_role`), блокировка с причиной / разблокировка (`users.block`, сессии удаляются), ручное подтверждение email, письмо сброса пароля (`users.write`).
- Создание `/admin/users/new` (`users.write`): email, имя, фамилия, дата рождения, родитель (до 18), телефон, город; письмо «задайте пароль» (Better Auth `requestPasswordReset`; тема письма — «задайте пароль», если у пользователя нет пароля).
- Правила `04` разд. 6: роль не себе, себя не блокировать, последний активный admin не понижается и не блокируется — активные админы считаются в транзакции с блокировкой строк (`for update`).
- `/admin/roles` (`users.set_role`): сотрудники (editor, moderator, admin) — имя, роль, последний вход (последняя `session.created_at`); выдать роль (поиск участника → роль → подтверждение), забрать роль (→ `member`).

## Файлы (ожидаемо)

- `src/lib/server/services/audit.ts` — `writeAudit`, `userHistory`
- `src/lib/server/services/users/list.ts` — список с фильтрами и видимостью по роли
- `src/lib/server/services/users/card.ts` — карточка с видимостью по роли
- `src/lib/server/services/users/account.ts` — роль, блокировка, подтверждение email (транзакция + аудит)
- `src/lib/server/services/users/edit.ts` — создание и правка профиля (+ аудит)
- `src/lib/server/services/users/staff.ts` — сотрудники, последний вход, поиск участника
- `src/lib/validation/admin-users.ts` — Zod: профиль, создание, роль, блокировка
- `src/lib/server/auth/index.ts` — тема письма «задайте пароль» без пароля
- `src/routes/admin/users/` (`+page*`, `new/`, `[id]/`), `src/routes/admin/roles/` — тонкие маршруты
- `src/lib/i18n/messages/{en,ru}-users.ts` — тексты разделов (подключаются в `en.ts`/`ru.ts`, чтобы не раздувать файлы)
- Тесты: `*.test.ts` рядом с сервисами и схемой (БД — в транзакции с откатом), `tests/e2e/admin-users.spec.ts`

## Не ломать

- Гость → вход, участник → 404, редактор → 403 на `/admin/users` и `/admin/roles` (страница и прямой POST в action).
- Заблокированный теряет доступ со следующего запроса; вход с блокировкой по-прежнему запрещён.
- Регистрация, вход, сброс пароля (письмо «сброс» у пользователя с паролем).
- Оболочка админки, язык из профиля (`admin-shell.spec`).

## Проверка

- `npm run test` (unit + БД), `npm run check`, `npm run lint`
- `npx playwright test tests/e2e/admin-users.spec.ts tests/e2e/admin-access.spec.ts tests/e2e/auth.spec.ts`

## Фазы

- [x] SPEC
- [x] RED (`test: … [RED]`) — `0bb4586`
- [x] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

1.7 Роли и права: `permissions.ts`, `can()`, `requirePermission()`, защита `/admin/*` (`04` разд. 5), защита от последнего админа и смены своей роли (`04` разд. 6). **Опасная зона: права.**

`/admin`: гость → `/login?returnTo=…`, `member` → 404 (решение 2026-10-06, `questions.md`). Нет права на раздел → 403 (`04` 5.4). Правила смены роли и блокировки — чистые функции; запись в БД, транзакция и аудит — 1.10 / 1.11.

## Файлы (ожидаемо)

- `src/lib/server/auth/permissions.ts` (+ тест) — матрица «право → роли» из `04` 5.1, `can()`, `isStaff()`
- `src/lib/server/auth/role-rules.ts` (+ тест) — смена роли и блокировка: только admin, не себе, не последний активный admin; moderator/editor не трогают равных и старших (`04` 6.2–6.5)
- `src/lib/server/auth/guard.ts` — `requireStaff()`, `requirePermission()` (redirect / 404 / 403)
- `src/routes/admin/+layout.server.ts`, `+page.svelte` — вход в админку (заглушка до 1.9)
- `tests/e2e/admin-access.spec.ts`

## Не ломать

- Участник и гость не открывают `/admin` ни страницей, ни прямым POST.
- Редактор без права не получает раздел (403), даже по прямой ссылке.
- Последний активный admin не может быть понижен или заблокирован; свою роль менять нельзя.
- Сценарии 1.5–1.6.

## Проверка

- `npm test` (матрица прав, правила ролей), `npm run test:e2e` (доступ к `/admin`)
- `npm run check`, `npm run lint`

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

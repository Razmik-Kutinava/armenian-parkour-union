# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

1.11 — аудит подключён ко всем действиям админки этапа 1: проверить и закрепить тестами.

Инвентарь (код 1.10): `users/[id]` — `update`, `role`, `block`, `unblock`, `confirmEmail`, `passwordLink`; `users/new` — `default`; `roles` — `grant`, `revoke`; `settings` — `default`. Все пишут `writeAudit` с IP. `POST /admin/locale` — язык своего интерфейса, не данные федерации: в журнал не пишется. GET (`audit/export`) ничего не меняет.

## Файлы (ожидаемо)

- `tests/e2e/admin-audit-map.ts` — карта «действие админки → коды журнала» и список осознанных исключений
- `src/routes/admin/audit-coverage.test.ts` — Vitest: каждое action и каждый не-GET endpoint админки есть в карте, лишних нет
- `tests/e2e/admin-audit.spec.ts` — Playwright: каждое действие из карты по HTTP → запись в `audit_log` с автором и IP; полнота исполнителей — проверкой типов

## Не ломать

- Права: редактор и модератор по-прежнему получают 403 на чужие действия (`admin-users.spec`, `admin-system.spec`)
- Запись в журнал — в одной транзакции с действием (сервисные тесты 1.10)
- `audit_log` неизменяем (`schema.test.ts`)

## Проверка

- `npm run test -- src/routes/admin/audit-coverage.test.ts`
- `npx playwright test tests/e2e/admin-audit.spec.ts`

## Риск

`normal` — в диффе только тесты, рабочий код не меняется.

## Читать

- `02` § `audit_log`: логировать баллы, степени, сертификаты, платежи, роли, блокировки, смену настроек
- `04` п. 17, 194: кто, что, было и стало, IP
- `05` § 22: журнал только для чтения

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

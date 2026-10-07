# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

**1.10b** — «Журнал действий» (`05` разд. 22) и «Настройки сайта» (разд. 21, объём — `decisions.md` 2026-10-07). Права: `audit.read`, `settings.write` (только admin).

- `/admin/audit`: колонки дата, кто, действие, объект, IP; фильтры: пользователь (поиск по имени / email автора), тип действия и объект (списки из имеющихся значений), период «с» / «по» (даты, время Еревана); 25 на страницу, новые сверху. Запись `/admin/audit/[id]`: «было» и «стало» рядом. Только чтение. Экспорт CSV с теми же фильтрами (`/admin/audit/export`), защита от формул в ячейках.
- `/admin/settings`: одна форма с группами «Основное» (`site_name`, `seo_description` — `{en,hy,ru}`, английский обязателен), «Контакты», «Соцсети», «Подвал» (текст), «Реквизиты» — схемы `validation/site-settings.ts`, ссылки только `https:`. Многоязычные поля — вкладки EN / HY / RU (все значения уходят с формой). Каждый изменённый ключ → `audit_log` `settings.update` с прежним и новым значением, в одной транзакции; без изменений — без записи.
- `FilterBar`: фильтр-дата (`type: 'date'`) с чипом.

## Файлы (ожидаемо)

- `src/lib/server/services/audit.ts` — `listAudit`, `auditFilterOptions`, `getAuditEntry` (+ тест)
- `src/lib/server/services/audit-csv.ts` — `toCsv` (+ тест)
- `src/lib/server/services/site-settings.ts` — `getAdminSettings`, `saveSettings` (+ тест)
- `src/lib/validation/site-settings.ts` — тексты ошибок; `site-settings-form.ts` — форма → объект, схема формы (+ тест)
- `src/lib/components/admin/FilterBar.svelte`, `LocalizedInput.svelte`
- `src/routes/admin/audit/` (`+page*`, `[id]/`, `export/+server.ts`), `src/routes/admin/settings/`
- `src/lib/i18n/messages/{en,ru}-system.ts`
- `tests/e2e/admin-system.spec.ts`

## Не ломать

- Редактор и модератор: 403 на `/admin/audit`, `/admin/settings`, экспорт и POST настроек.
- Подвал сайта читает те же ключи; битый ключ по-прежнему скрывает блок.
- `audit_log` только дописывается (триггер); «Пользователи» и «Роли» пишут журнал как раньше.

## Проверка

- `npm run test`, `npm run check`, `npm run lint`
- `npx playwright test tests/e2e/admin-system.spec.ts tests/e2e/admin-users.spec.ts tests/e2e/site-layout.spec.ts`

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`.
> **4.4a** (журнал `/admin/points`): RED `43b6ce9`, GREEN `1708d73`, REGRESS пройден; полный todo — `git show f9184bd:docs/todo.md`. REVIEW 4.4a и 4.4b — одним проходом, **после апрува владельца** (решение 2026-10-21).

## Задача

4.4b — админка «Правила баллов» `/admin/point-rules` (`05` § 13) + фильтр «подозрительное» в журнале `/admin/points` (`05` § 12, `03` § 6.4). Миграции нет: у `points_rules` уже есть `updated_by`, `updated_at`; новый ключ `site_settings.points_suspicious` — через seed.

**Что делаем:**
- **Список правил** `/admin/point-rules` (только admin — `points.rules`; пункт меню уже есть в `admin/nav.ts`): код, название (на языке интерфейса), баллы, активно, кем и когда изменено (имя из `updated_by` или «—» для seed, `updated_at` по Еревану). Сортировка по коду. Создания и удаления нет (`05` § 13).
- **Правка правила** `/admin/point-rules/[id]` (`points.rules`): название en / hy / ru (`LocalizedInput` + `localizedText(200)`: английский обязателен, hy / ru — по желанию, как во всех формах `05` § 1 п. 4; пустой язык убирается из `title`), баллы (целое 0…1 000 000; 0 — правило не начисляет, `03` § 6.2.3), активно (флажок). Код показывается, но не меняется: поля `code` в форме нет, лишнее поле в POST игнорируется. Сервис `updateRule(db, actor, id, values, { ip })` сам проверяет `points.rules`; в транзакции: строка `FOR UPDATE` → если ничего не изменилось — без записи и без журнала → иначе `UPDATE` (`updated_by` = actor, `updated_at` = now) + `audit_log` `points.rule_update` (`entity_type = points_rule`, `entity_id`, before / after — только изменённые поля, IP). Уже начисленные записи не меняются (баллы зафиксированы в `points_ledger.delta`, `03` § 6.2.4). Нет правила / битый id — 404.
- **Пороги «подозрительного»** — форма на той же странице `/admin/point-rules`, action `?/thresholds` (`points.rules`). Ключ `site_settings.points_suspicious` = `{ manual: true, min_amount: 100, burst_count: 5, burst_hours: 24 }` (decisions 2026-10-21) — добавляется в `SEED_SETTINGS` (только если ключа нет). Поля: «все ручные операции» (флажок), «сумма от» (целое 1…1 000 000 000), «записей у участника» (2…1000) «за часов» (1…720). Запись — через `writeSettings` (журнал `settings.update` с before / after). Ключа нет или он битый — используются значения по умолчанию из решения (фильтр не ломается), форма показывает их же.
- **Фильтр «подозрительное»** в `/admin/points` (`points.read`: модератор тоже) — флажок `suspicious=1` в URL (`pointsListOptions.filters`), работает и в CSV-экспорте (те же условия). Запись подозрительна, если выполнено **любое**: (а) `manual` включён и `created_by is not null` (как фильтр «ручные операции»: ручные корректировки и отмены админом); (б) `abs(delta) >= min_amount`; (в) запись входит в какое-либо окно `burst_hours` часов, где у этого участника `>= burst_count` записей (все записи всплеска, а не только с пятой). Пороги читаются из базы при каждом запросе списка / экспорта с этим фильтром.
- Права — `requirePermission` в каждом load / action; actor и IP — из сессии и запроса. Модератор и редактор: `/admin/point-rules` и её actions — 403 (и прямым POST).
- Новые страницы и actions — в `admin-access-map.ts`; actions — в `admin-audit-map.ts` (`points.rule_update`, `settings.update`) с исполнителями в `admin-audit-points.ts`; кеш: `'point-rules': []` в `cache/admin-groups.ts` (публичных данных нет).

**Предложено агентом (подтвердить владельцу, `questions.md`):** окно всплеска — «любые 24 ч, где у участника ≥ 5 записей, помечаются все записи всплеска»; ручные = `created_by` не пуст; баллы правила 0…1 000 000; страница правил — только admin (модератор правила не видит, как в меню); битый ключ порогов — значения по умолчанию.

## Файлы (ожидаемо)

- `src/lib/server/services/points/rules-admin.ts` (+ `.test.ts`) — `listRules`, `getRule`, `updateRule` (права, `FOR UPDATE`, журнал)
- `src/lib/server/services/points/suspicious.ts` (+ `.test.ts`) — `parseSuspicious`, `readSuspicious(db)`, `saveSuspicious(db, actor, values, ip)`, SQL-условие `suspiciousCondition(t)`
- `src/lib/server/services/points/admin-list.ts` (+ `admin-list.test.ts`), `admin-export.ts` — фильтр `suspicious`, пороги передаются в `pointsQuery`
- `src/lib/validation/admin-point-rules.ts` — Zod: правка правила, форма порогов (+ перевод в / из ключа)
- `src/lib/server/seed/settings.ts` (+ `settings.test.ts`) — ключ `points_suspicious`
- `src/routes/admin/point-rules/+page.server.ts`, `+page.svelte`, `[id]/+page.server.ts`, `[id]/+page.svelte`; `src/routes/admin/points/+page.svelte` — флажок фильтра
- `src/lib/i18n/messages/{en,hy,ru}-point-rules-admin.ts` (+ подключение в `{en,hy,ru}.ts`); `src/lib/server/cache/admin-groups.ts`
- `tests/e2e/admin-point-rules.spec.ts`, `admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-points.ts`, `admin-permissions-fixtures.ts` / `admin-permissions.spec.ts` (модератор POST правки — правило не изменилось)

## Не ломать

- Баллы пишет только `services/points` (`appendEntry`); правка правила меняет только будущие начисления — `points_ledger` не трогается, `awardPoints` берёт текущие `points` / `is_active` (тесты 4.3 `award.test.ts` зелёные). Тесты, меняющие `points_rules`, — через `setRules` (`LOCK TABLE`).
- Код правила неизменен (карта `RULE_SOURCES` и `awardPoints(rule: код)` завязаны на код).
- Журнал 4.4a: фильтры, корректировка, отмена, CSV, права модератора (только чтение) — `admin-list.test.ts`, `admin-points.spec.ts`.
- Остальные ключи `site_settings` (seed добавляет только недостающие; `writeSettings` пишет только переданный ключ); `audit-coverage` / `access-coverage` зелёные.

## Проверка

- `npx vitest run src/lib/server/services/points src/lib/server/seed src/routes/admin` — сервис, фильтр, seed, `access-coverage` / `audit-coverage`
- `npx playwright test tests/e2e/admin-point-rules.spec.ts tests/e2e/admin-points.spec.ts tests/e2e/admin-permissions.spec.ts tests/e2e/admin-audit.spec.ts`

## Риск

`high` — баллы (правила начисления), права, журнал действий (`bugbot` + `security-review`).

## Читать

- `05 § 13` — список: код, название, баллы, активно, кем и когда изменено; правка: название ×3, баллы, активно; код не меняется; каждое изменение — `audit_log`; создавать коды нельзя (выписано выше)
- `05 § 12` — фильтр «подозрительное» в журнале
- `03 § 6.2` (п. 3–4: 0 баллов / выключено — записи нет; изменение правила старые начисления не меняет), `03 § 6.4` (подозрительное: крупные, частые, ручные)
- `04` — `points.rules` только admin (строки 90, 153); `points.read` moderator + admin
- `decisions.md` 2026-10-21 — пороги и ключ

## Фазы

- [x] SPEC
- [x] RED (`5aa1544`) — Vitest: 3 набора не находят модули, seed без ключа, `access-coverage` / `audit-coverage` — нет маршрутов; остальное зелёное
- [x] GREEN — Vitest зоны 91/91 (`audit-coverage` под параллельной нагрузкой — таймаут 20 с, отдельно 4/4), e2e `admin-point-rules` + `admin-points` + `admin-permissions` + `admin-audit` 9/9, `check` 0, eslint / prettier чистые; `db:seed` dev — ключ уже был (создан e2e через форму, значения = по умолчанию). Армянские тексты раздела — откат на EN, как в других разделах админки
- [ ] REGRESS
- [ ] REVIEW (4.4a + 4.4b) — после апрува владельца
- [ ] DEPLOY (только по апруву владельца)

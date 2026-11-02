# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.9 — после мероприятия: отметка «пришёл» / «не пришёл» / «освободить», подведение итогов по сроку (`closed_at`), счётчик отказов подряд, предупреждение и пометка, порог в настройках, «Завершить» запрос; баллы `volunteer_participation` при `attended` (`09` п. 10.9; `03` § 19.5 п. 4–5, § 19.6, § 19.7 п. 1, § 19.9). Миграции нет (поля 0018 уже есть). Фотоотчёт — 10.10.

## Файлы (ожидаемо)

- `src/lib/server/services/volunteer/invite-close.ts` (+ test) — после `respond_by`: `closed_at`, `invited` → `expired` (молчание = отказ) или `excused` при полном наборе; учёт `decline_streak` для `declined`/`expired` (`counted_at`)
- `src/lib/server/services/volunteer/invite-mark.ts` (+ test) — admin: `attended` / `no_show` / `excused` у `accepted`; баллы `awardPoints(…, volunteer_participation)`; streak (+2 / 0 / reset); «Завершить» (`finished`)
- `src/lib/server/services/volunteer/card-flag.ts` (+ test) + правка `card-decision` / `settings.ts` — порог `decline_threshold`, `flagged_at`, письмо-предупреждение, «Снять пометку»; seed `site_settings.volunteer` + правила баллов; `RULE_SOURCES`
- `src/routes/admin/volunteer/requests/[id]/*` — UI явки (как «День события»), «Завершить»; карточка книжки — «Снять пометку»
- `src/routes/[[lang=lang]]/(site)/cabinet/volunteer/*` + i18n — плашка предупреждения; обзор «требует действия»
- `src/routes/api/cron/volunteer/+server.ts` (+ `cron.yml`) — фоновое закрытие открытых запросов с истёкшим `respond_by`

## Решения агента (в пределах документов)

1. Подведение по сроку — та же логика в cron и лениво при открытии карточки запроса / списке / перед отметкой явки (идемпотентно по `closed_at`).
2. Счётчик (19.6): один раз на приглашение (`counted_at`); `declined`/`expired` +1 при close; `no_show` +2 и `attended` → 0 при отметке; `excused` без изменений. Порог → `flagged_at` + письмо один раз, пока пометка стоит.
3. Баллы только при первом `attended` (source = invitation id); смена на `no_show` баллы не снимает (`03` 19.7 п. 1). `RULE_SOURCES.volunteer_participation` → `source_type: volunteer_invitation`. Правило и ключ `volunteer` — в seed (ещё нет).
4. Явка доступна с начала дня запроса по Еревану (`05` § 28); только у `accepted` после close (или после `respond_by`). Передумать явку до `finished` — да (как day-of у событий).
5. «Завершить»: статус `open` → `finished`; незакрытые по сроку — сначала close. Отмена уже в 10.8.
6. Журнал: `volunteer_request.finish`, `volunteer_invitation.mark` (или `attendance`), `volunteer_card.unflag`; настройки — через `writeSettings`.
7. Образцы: `registrations/staff/attendance.ts` + `points.ts`; close — `quiz-daily.ts` / cron training; streak+флаг — рядом с `card-decision`.

## Не ломать

- Баллы (K3): повтор `attended` не дублирует начисление (`points_ledger_source_once_key`); смена на `no_show` не создаёт reversal автоматически.
- Права (K1): модератор / редактор / участник не отмечают явку и не снимают пометку; чужое приглашение — отказ.
- 10.8: ответы до `respond_by`, лимит мест, отмена → `excused` без штрафа — без регресса; close не трогает уже `counted_at`.
- Append-only `perk_redemptions` / схема 0018 — без миграций.

## Проверка

- `npx vitest run src/lib/server/services/volunteer/invite-close.test.ts src/lib/server/services/volunteer/invite-mark.test.ts src/lib/server/services/volunteer/card-flag.test.ts`
- `npm run check`, `npm run lint`

## Риск

`high` — баллы (K3), `volunteer.manage`, `audit_log`, cron, письма и пометка с персональными данными (K1 / K4 / K5).

## Читать

- `03` § 19.5 п. 4–5; § 19.6; § 19.7 п. 1; § 19.9; § 6.1 (`volunteer_participation`)
- `05` § 28 «Запросы» (явка, «Завершить»); § 3 дашборд (счётчик помеченных)
- `06` § 5.12 «Предупреждение», «Приглашения» (явка), обзор кабинета
- `04` § 3.2 волонтёрство (явка, снять пометку), § 5.1 `volunteer.manage`
- `02` § 12 `volunteer_requests`/`volunteer_invitations`/`volunteer_cards` (streak, flagged); § 5 `points_rules` / ledger source; `site_settings.volunteer`
- `zone-notes.md` § «Волонтёрство» (10.8 → 10.9); § «Баллы» (`awardPoints`, `RULE_SOURCES`)
- образцы: `registrations/staff/attendance.ts`, `quiz-daily.ts`, `card-decision.ts`, `settings.ts`

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

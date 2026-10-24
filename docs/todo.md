# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`.

## Задача

6.2 Сервис экзаменов: назначение, условия допуска, результат, пересдача. «ебашь» владельца — 2026-10-24, без REVIEW на задаче. Без миграции.

Решения (по `03` разд. 2–4, `04` разд. 2, 5.1, 7, `05` разд. 7):
- Назначает и вносит результат — `exams.manage` (moderator, admin). Заявка самим участником — открытый вопрос (`questions.md`), в 6.2 нет.
- Назначение (`scheduleExam`): участник (не удалён), тип, дата, событие (необязательно, не удалено), экзаменатор (необязательно; только активный moderator / admin), заметки ≤ 2000. Строка участника `FOR UPDATE` — два одновременных назначения не дублируют.
- Отказ (жёстко): участник заблокирован; нет действующего членства (`05` 7); уже назначен экзамен того же типа; сдан экзамен того же типа и сертификат по нему ещё не выдан; пересдача раньше срока (`exams.retake_days` от `decided_at` последнего `failed` того же типа до даты нового); на степени меньше `exams.min_days_on_level` (только экзамены уровня).
- Предупреждение (`05` 7, «предупреждение, если степень не подходит»): `level_advanced` не у `novice`, `level_pro` не у `advanced` — назначение только с `confirmLevel`, в журнале — `warnings`. Пропуск уровня всё равно не даст степень: проверка — при выдаче сертификата (6.3).
- Пересдача — новая строка `exams` тем же `scheduleExam` после `failed` / `cancelled`.
- Результат (`recordExamResult`): только из `scheduled`; `passed` / `failed` — не раньше `scheduled_at`, оценка 0–999.99 (шаг 0.01), `examiner_id` пуст → кто внёс; `cancelled` — в любой момент, без оценки; комментарий дописывается к `notes`; `decided_at` = сейчас. Строка экзамена `FOR UPDATE`. Повтор — `already_decided`.
- Журнал: `exam.schedule`, `exam.result` (entity `exam`).
- Настройки: `site_settings.exams` = `{ retake_days: 0, min_days_on_level: 0 }` (seed; `03` 16 — УТОЧНИТЬ, по умолчанию без ограничений); нет или битое — нули. «С какого момента на степени»: `novice` — начало первого членства, `advanced` / `pro` — `issued_at` неотозванного сертификата уровня; неизвестно — не блокировать.
- Писем нет (`03` 14 их не требует).

## Файлы (ожидаемо)

- `src/lib/server/services/exams/admission.ts` (+ `.test.ts`) — чистая проверка допуска
- `src/lib/server/services/exams/settings.ts` (+ `.test.ts`)
- `src/lib/server/services/exams/facts.ts` — чтения для допуска
- `src/lib/server/services/exams/schedule.ts` (+ `.test.ts`), `result.ts` (+ `.test.ts`), `index.ts`, `test-support.ts`
- `src/lib/server/seed/settings.ts` (+ `.test.ts`) — ключ `exams`

## Не ломать

- Степень участника назначение и результат не меняют (`users.level` — только 6.3).
- Модератор не выдаёт сертификат; редактор и участник не назначают экзамен.
- Seed настроек: существующие ключи и значения владельца не перезаписываются.

## Проверка

- `npx vitest --run src/lib/server/services/exams src/lib/server/seed/settings.test.ts`
- `npm run check`, `npm run lint`

## Риск

high (степени — допуск к экзамену на степень, права).

## Читать

- `03` разд. 2.5, 3, 4, 16. `04` разд. 2 (экзаменатор = moderator), 5.1 `exams.manage`, 7 «Подача на экзамен». `05` разд. 7. `02` `exams`.

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW — общим шагом в конце этапа

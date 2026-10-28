# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

**9.7** (`09` этап 9): практика — задания в админке, отправка ссылки (YouTube, Google Drive), очередь проверки, возврат с комментарием, письма; блок «Практика» на портале.

Граница: без миграций (таблицы 9.1). Не входит: завершение курса и экзамен (9.8 — вызов из принятия видео), `/admin/training/attempts` и карточка участника в заявке, прогресс «принято N из M» в списке `/cabinet/training` (как и прогресс теста — после 9.8). Памятка 9.6 — `git show 979d522:docs/todo.md`.

Факты из документов (прочитаны, выписано):
- `03` § 18.4: практика открыта после сданного теста, до того задания — списком без формы. На каждое видимое задание — ссылка YouTube (в т. ч. «по ссылке») или Google Drive, файлы не принимаются, ссылка нормализуется. Одновременно одна `pending` или `approved` на задание; пока `pending` — можно заменить ссылку; после `rejected` — новая отправка, без лимита. Проверяет moderator / admin: «Принять» / «Вернуть» (комментарий обязателен); своё видео не проверяет. Принятая не отзывается.
- `03` § 18.1 п. 3–4: при `revoked` отправки остаются в истории; предпросмотр (`training.manage` без заявки) практику не сдаёт. § 18.5 п. 5: задание, скрытое или добавленное после завершения курса, на него не влияет.
- `03` § 18.6: решение по видео — в журнал и письмо участнику (после коммита).
- `04`: `training.manage` (admin) — задания; `training.review` (moderator, admin) — практические видео.
- `05` § 27: вкладка «Практические задания» (admin): название ×3, описание ×3 (что показать, требования, критерии), порядок, скрыть / вернуть. `/admin/training/practice` (moderator, admin): очередь — участник, курс, задание, ссылка, дата, статус; по умолчанию `pending`, старые сверху; фильтры курс, задание, статус. Просмотр: YouTube — плеер `youtube-nocookie`, Google Drive — «Открыть ссылку»; рядом описание и критерии, история прошлых отправок по заданию. Свои отправки — без кнопок.
- `06` § 5.11: `/cabinet/training/{course}/practice` — до теста список без формы; после — описание, поле ссылки с подсказкой «загрузите ролик с доступом по ссылке», статус (на проверке / принято / вернули с комментарием), история. Портал — блок «Практика». Обзор кабинета: видео вернули — «Переснимите задание».
- `02` § 11 / схема `training-progress.ts`: `practice_tasks` (`title`, `description` jsonb, `sort_order`, `hidden_at`), `practice_submissions` (`url` нормализован, `platform` `youtube | google_drive`, `status` `pending | approved | rejected`, `reviewed_by/at`, `review_note` — обязателен для `rejected`, `pending` ⇔ `reviewed_at` пуст; одна `pending` / `approved` на (задание, участник) — `23505`).

## Решения (агент)

1. **Задания** (`practice-tasks.ts`, `training.manage`): создать / изменить / скрыть / вернуть, журнал `practice_task.create|update|hide|restore` (update — before/after изменённых `title`, `sortOrder`, `descriptionChanged`; без изменений — без записи). Порядок — число (как у уроков), список — `sort_order`, затем создание. Название — любой один язык (≤ 200), описание — rich text, необязательно. **Картинки медиатеки в описании не принимаются** (`richTextSchema(null)`): учёта использования для заданий нет; YouTube-пример — можно. Удаления нет.
2. **Ссылка** (`practice-link.ts`, чистая): только https; YouTube — как `parseVideoUrl` (watch, youtu.be, shorts, embed) → `https://www.youtube.com/watch?v=ID`; Google Drive — `drive.google.com/file/d/ID/…`, `open?id=ID`, `uc?id=ID` → `https://drive.google.com/file/d/ID/view`; папки и прочее — `null`.
3. **Отправка** (`practice-submit.ts`): вход `openPortal` (нет — `not_found`, предпросмотр — `preview`); ссылка — `bad_url`; транзакция: блокировка `course_access` (`approved`), `exam_id` есть — `finished`; нет попытки `passed = true` — `quiz`; задание этого курса, не скрыто — иначе `not_found`; живая `approved` — `bad_state`; `pending` — замена ссылки (`replaced: true`); иначе новая `pending`. Журнал и письма нет (действие участника; в § 18.6 нет). Членство не проверяется (в § 18.4 нет).
4. **Решение** (`practice-review.ts`, `training.review`): комментарий ≤ 1000, для «Вернуть» обязателен (`invalid`); у «Принять» — необязателен, сохраняется в `review_note`. Блокировка строки; не `pending` — `bad_state`; своя — `own`. Журнал `practice_submission.approve|reject` (before `{status}`, after `{status, taskId, userId, reviewNote?}`), письмо участнику после коммита (его язык; название задания, комментарий, ссылка на страницу практики). Доступ участника не перепроверяется (закрытый доступ — отправки остаются в истории). **Для 9.8:** завершение курса — в этой транзакции после принятия.
5. **Чтение участника** (`practice-read.ts`): `practiceStatus(db, gate, userId)` → `{ state: 'open' | 'quiz' | 'finished' | 'preview', tasks: [{ id, title, description, current: { status, url, note } | null, history }], accepted, total }`; задания — видимые по порядку; `current` — последняя отправка; `accepted` — видимых с принятой.
6. **Очередь** (`practice-queue.ts`): `listPractice` — фильтры `status` (по умолчанию `pending`, `all`), `course`, `task`; старые сверху (`created_at`); страницами. `practiceDetail` — отправка, участник, курс, задание (название, описание), история этого участника по заданию (без текущей, новые сверху), `own`.
7. **Страницы**: админ — вкладка «Задания» `/admin/training/[id]/tasks` (`?/hide`, `?/restore`, поле `taskId`), `tasks/new`, `tasks/[taskId]` (`?/update`); очередь `/admin/training/practice`, карточка `/admin/training/practice/[id]` (`?/approve`, `?/reject`, поле `comment`); пункт меню «Практика» (`training.review`). Кабинет — `/cabinet/training/{course}/practice` (`?/submit`, поля `taskId`, `url`), блок «Практика» на портале, в обзоре у портала — «Переснимите задание» (есть вернутое видео без новой отправки по видимому заданию).
8. **Письмо** (`practice-mail.ts`): «Видео принято» / «Видео вернули» + комментарий; ссылка `/cabinet/training/{slug}/practice`.

## Файлы (ожидаемо)

- `src/lib/server/services/training/practice-link.ts`, `practice-tasks.ts`, `practice-submit.ts`, `practice-review.ts`, `practice-mail.ts`, `practice-read.ts`, `practice-queue.ts` (+ `practice-link.test.ts`, `practice-tasks.test.ts`, `practice-submit.test.ts`, `practice-review.test.ts`, помощники — `practice-test-support.ts`); `services/cabinet/overview.ts` (+ тест).
- `src/lib/validation/training-practice.ts`.
- `src/routes/admin/training/[id]/tasks/**`, `[id]/+layout.svelte`; `src/routes/admin/training/practice/**`; `src/lib/server/admin/nav.ts`, `components/admin/nav-icons.ts`.
- `src/routes/[[lang=lang]]/(site)/cabinet/training/[course]/practice/**`, `[course]/PracticeBlock.svelte`, `[course]/+page.server.ts`, `+page.svelte`; `cabinet/+page.svelte`.
- `src/lib/i18n/messages/{en,hy,ru}-training-practice.ts` (админка), `{en,hy,ru}-cabinet-practice.ts` (кабинет и письма).
- `tests/e2e/admin-audit-map.ts`, `admin-access-map.ts`, `admin-audit-practice.ts` (новый), `admin-audit-actions.ts`.

## Не ломать

- Портал, уроки и тест 9.5–9.6: `openPortal`, 404 без доступа; предпросмотр не сдаёт.
- Чужая отправка (подмена `id`) и задание чужого курса — `not_found`; своё видео сотрудник не проверяет.
- Модерация видео 7.2 (`videos`) не задета: практика — отдельная таблица, без баллов.

## Проверка

- `npx vitest run src/lib/server/services/training/practice-link.test.ts src/lib/server/services/training/practice-tasks.test.ts src/lib/server/services/training/practice-submit.test.ts src/lib/server/services/training/practice-review.test.ts src/lib/server/services/cabinet/overview.test.ts src/routes/admin/audit-coverage.test.ts` → PASS.
- `npm run check`, `npm run lint`.

## Риск

`high` — права (`training.review`, своё видео, чужая отправка, предпросмотр), журнал действий.

## Читать

- `03` § 18.1, 18.4–18.6; `05` § 27; `06` § 5.11; `02` § 11 (схема); `04` `training.*` (выписано); `zone-notes.md` § «Обучающий портал» (прочитано).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

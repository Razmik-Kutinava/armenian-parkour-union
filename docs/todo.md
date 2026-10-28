# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

9.12 (доделки этапа 9 после REVIEW, решения владельца 2026-10-28): карточка участника в заявке по `05` § 27 «Заявки» — попытки теста участника (ссылки на `/admin/training/attempts/{id}`), статус практики по заданиям, ссылка на экзамен, если курс завершён.

Решения (из `05` § 27, `04`; чего нет в документах — помечено «решение агента»):
1. Адрес — `/admin/training/access/[id]` (`id` — `course_access.id`), право `training.manage`, как у списка (`05`: «Заявки» — admin). Только чтение: журнал не пишется, `settleExpired` не зовётся, попытки и отправки не меняются. Неизвестный или не-uuid `id` — 404.
2. Действия (одобрить, отклонить, закрыть доступ, внеочередная попытка) остаются в списке, в карточке их нет (решение агента: не дублировать формы и диалоги; шаблон «список → карточка» соблюдён). В списке — ссылка «Карточка» в колонке действий у каждой строки.
3. Шапка: участник (ссылка `/admin/users/{userId}`; удалён мягко — имя как есть), курс, статус заявки, дата подачи (`created_at`), дата решения (`reviewed_at`, пусто — «—»), причина (`review_note`), внеочередных не использовано (`extra_attempts`).
4. Попытки: все попытки участника по этому курсу, новые сверху по `started_at` — начало, правильных / всего, результат (`resultOf`: сдал / не сдал / идёт / время вышло), внеочередная; строка — ссылка на `/admin/training/attempts/{id}`. Колонки и результат — общие с 9.11 (`attemptColumns`, `typed` / `resultOf` из `attempt-list.ts`), не новая формула. Нет попыток — пустое состояние.
5. Практика: видимые задания курса в порядке `taskOrder` (скрытые не показываются — как при завершении курса), у каждого — статус текущей отправки (живая или последняя вернутая: на проверке / принято / вернуто / нет отправки), ссылка на `/admin/training/practice/{submissionId}` текущей отправки, число отправок; сверху «принято N из M». Логика «текущей» — из `practice-read.ts` (`practiceStatus`), не новая.
6. Экзамен: `exam_id` есть — «Курс завершён» и ссылка на `/admin/exams/{examId}` (`exams.manage` у admin есть); нет — «Курс не завершён».
7. Меню не меняется (карточка — внутри «Заявок»). Переводы en / hy / ru (`hy` — по глоссарию `zone-notes.md` § «Обучающий портал», шаг 4).

## Файлы (ожидаемо)

- `src/lib/server/services/training/access-card.ts` (+ `access-card.test.ts`) — `accessDetail(db, id, now)`: шапка заявки, попытки (через `attemptColumns` / `typed`), практика (через `practiceStatus`), `examId`; `null` — 404.
- `src/routes/admin/training/access/[id]/+page.server.ts`, `+page.svelte` — карточка (образец — `training/attempts/[id]/`).
- `src/routes/admin/training/access/+page.svelte` — ссылка «Карточка» в колонке действий.
- `src/lib/i18n/messages/{en,hy,ru}-training-access.ts` — тексты `training.access.card.*` (файл > 120 строк — отдельный `*-training-access-card.ts` с подключением, как `*-training-attempts.ts`).
- `tests/e2e/admin-access-map.ts`, `tests/e2e/admin-permissions-training.ts` — страница `/admin/training/access/[id]` (`training.manage`) и подстановка `accessId` в `trainingPath`.

## Не ломать

- Editor, moderator (без `training.manage`) и участник — 403 / вход на `/admin/training/access/[id]`; карта прав e2e и `rights.test.ts` согласованы.
- Правильные ответы не уходят участнику: `quiz-secrets.test.ts` зелёный; карточка заявки ответов попытки не показывает (только ссылка на карточку попытки).
- Список заявок и его действия (approve / reject / revoke / extra) работают как раньше.
- Карточка ничего не пишет (нет журнала, нет закрытия истёкших попыток).

## Проверка

- `npx vitest run src/lib/server/services/training/access-card.test.ts src/lib/server/services/training/access-list.test.ts src/lib/server/services/training/quiz-secrets.test.ts`
- `npm run check`, `npm run lint`; e2e `admin-permissions` (training) — CI.

## Риск

`normal` — серверное чтение и страница админки; право существующее (`training.manage`), новых действий, миграций и журнала нет. В REVIEW этапа — общий уровень этапа 9 (`high`).

## Читать

- `05` § 27 «Заявки» (строки 405–408) — выписано выше: «Карточка участника в заявке: попытки теста, статус практики по заданиям, ссылка на экзамен, если курс завершён».
- `04` права: `training.manage` — admin; `training.review`, `exams.manage` — moderator, admin (сверено с `permissions.ts`).
- `02` § 11 `course_access` — выписано: `created_at`, `reviewed_at`, `review_note`, `extra_attempts`, `exam_id` (есть — курс завершён).
- `zone-notes.md` § «Обучающий портал», 9.7 (`practice-read.ts`), 9.8 (новая страница с `[id]` — строка в фикстуре и подстановка в `trainingPath`), 9.11 («Для 9.12»).

## Фазы

- [x] SPEC
- [x] RED `e84864b`
- [x] GREEN
- [ ] REVIEW (этапа 9)

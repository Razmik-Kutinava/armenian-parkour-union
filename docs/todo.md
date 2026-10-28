# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

9.15 (доделки этапа 9 после REVIEW, решения владельца 2026-10-28): картинки медиатеки в описании практического задания. Сейчас `taskFormSchema` чистит описание `richTextSchema(null)` — картинка из медиатеки молча отбрасывается при сохранении, подсказка формы так и говорит («в задании не сохраняются»), потому что использование файла заданиями не учитывалось (`zone-notes.md` § «Обучающий портал», 9.7).

Решения (чего нет в документах — помечено «решение агента»):
1. Как у урока: `taskFormSchema(mediaBaseUrl: string | null)` — функция, как `lessonFormSchema`; форма админки передаёт `R2_PUBLIC_URL || null`, импорт контента (`courseContentSchema(mediaBaseUrl)`) — тот же адрес. Без `R2_PUBLIC_URL` (`null`) картинки отбрасываются, как раньше.
2. `createTask` и `updateTask` блокируют строки `media` картинок описания `FOR SHARE` (`lockPageMedia(tx, values.description)`) в своей транзакции — параллельное удаление файла ждёт (`05` § 20). В `updateTask` — только если что-то меняется (после раннего `return 'ok'`), как в `updateLesson`.
3. Учёт использования: в `media/usage.ts` новый поиск `taskDescriptions` — `strpos(description::text, …)`, вид `practice_task` с `courseId`. **Скрытые задания тоже считаются** (решение агента): задания не удаляются, скрытое возвращается вместе с описанием — как архивные hero и товары. Значит, файл из описания любого задания курса удалить нельзя (`deleteMedia` → `inUse`).
4. Страница медиафайла `/admin/media/[id]`: ветка `practice_task` → ссылка `/admin/training/{courseId}/tasks/{id}`, подпись `media.usage.practice_task` (en «Practice task», ru «Практическое задание», hy «Գործնական առաջադրանք» — по глоссарию). Ветку ставить **до** `{:else if data.canOpenUsers}` — иначе ссылка уйдёт на `/admin/users/{id задания}`.
5. Подсказка `training.task.descriptionHint` (en / hy / ru) — по смыслу «Картинки — из медиатеки; пример движения — ссылкой на YouTube.»; комментарий в шапке `training-practice.ts` поправить.
6. Показ не меняется: кабинет (`PracticeTask.svelte`) и карточка проверки (`practice/[id]/+page.svelte`) выводят очищенный текст `{@html}`; хост медиа уже в CSP (уроки). Журнал — прежний (`descriptionChanged: true`), права — прежние (`training.manage`). Миграции нет.

## Файлы (ожидаемо)

- `src/lib/validation/training-practice.ts` — `taskFormSchema(mediaBaseUrl)`, шапка-комментарий.
- `src/routes/admin/training/[id]/tasks/form.ts` — `taskFormSchema(R2_PUBLIC_URL || null)` (как `lessons/form.ts`).
- `src/lib/validation/training-content.ts` — `taskFormSchema(mediaBaseUrl).shape`.
- `src/lib/server/services/training/practice-tasks.ts` — `lockPageMedia` в `createTask` / `updateTask` (131 → ~134 строки).
- `src/lib/server/services/media/usage.ts` — `taskDescriptions`, вид `practice_task` (122 → ~135).
- `src/routes/admin/media/[id]/+page.svelte` — ветка ссылки `practice_task` (155 → ~160).
- `src/lib/i18n/messages/{en,hy,ru}-training-admin.ts` — `media.usage.practice_task`; `{en,hy,ru}-training-practice.ts` — `training.task.descriptionHint`.
- Тесты (RED): новый `practice-task-media.test.ts` (не раздувать `practice-tasks.test.ts`, 111 строк) — картинка медиатеки в описании сохраняется схемой с адресом и находится `findUsages` как `{ kind: 'practice_task', id, courseId }`, у скрытого задания — тоже, `deleteMedia` → `inUse`; схема с `null` картинку отбрасывает. `content-import.test.ts` (177) — только если сменится вызов, строк не добавлять.

## Не ломать

- Задания: создание, правка, порядок, скрытие / возврат, журнал `practice_task.*`, правка без изменений — без записи (`practice-tasks.test.ts`, `practice-task-hide.test.ts`).
- Импорт контента курса: задания создаются, повтор пропускает (`content-import.test.ts`).
- Медиатека: учёт использования прочих видов (страницы, новости, события, hero, товары, уроки, аватары) и запрет удаления используемого файла (`media/edit.test.ts`, `lessons.test.ts`).
- Описание без картинок у участника и в карточке проверки — как раньше.

## Проверка

- `npx vitest run src/lib/server/services/training/practice-tasks.test.ts src/lib/server/services/training/practice-task-hide.test.ts src/lib/server/services/training/content-import.test.ts src/lib/server/services/training/lessons.test.ts src/lib/server/services/media/edit.test.ts`
- `npm run check`, `npm run lint`; e2e — CI.

## Риск

`normal` — валидация формы, сервис заданий и учёт использования медиа (запрет удаления используемого файла); прав, денег, баллов, степеней и миграций не трогает.

## Читать

- `05` § 20 (медиатека, «где используется») — только если в RED понадобится формулировка; правило выписано в решении 2.
- `zone-notes.md` § «Обучающий портал» 9.2 (картинки в уроке — `MediaUsage.kind = 'course_lesson'`), 9.7 (задания, `richTextSchema(null)`) — уже прочитано.
- Код: `lessons.ts` + `lessons.test.ts` (образец: `lockPageMedia`, тест «a library image in the lesson text…»), `pages/media.ts` (`lockPageMedia`), `media/usage.ts`, `media/edit.ts` (`deleteMedia`), `lessons/form.ts`.

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа 9)

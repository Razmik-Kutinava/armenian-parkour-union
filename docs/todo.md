# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

**9.5** (`09` этап 9): портал — уроки по темам, скачивание PDF по подписанной ссылке.

Граница: без миграций. Блоки «Тест» и «Практика» на портале и их страницы — 9.6 / 9.7 (ссылок на них пока нет, чтобы не вести на 404). Памятка 9.4 — `git show 3c9b48a:docs/todo.md`.

Факты из документов (прочитаны, выписано):
- `03` § 18.1 п. 4–5: портал открыт только при `approved`; сотрудники с правом управления порталом (`training.manage`) видят его без заявки — предпросмотр; блокировка закрывает портал.
- `03` § 18.2: видны уроки `published` без `deleted_at`, у видимых тем; порядок — `sort_order` темы, затем урока; прочтение не отслеживается. PDF — приватный бакет, подписанная ссылка на 5 минут, только участнику с доступом и сотрудникам.
- `06` § 3.2: `/cabinet/training/{course}` (портал), `/cabinet/training/{course}/lessons/{id}` (урок). § 5.11: урок — заголовок, текст, видео (YouTube внутри `body`), «Скачать PDF». Обзор `/cabinet` («Что требует действия»): заявка одобрена — «Открыть портал».
- `02` § 11: `body` — очищенный HTML по языкам; `file_key` / `file_name` — PDF урока.

## Решения (агент)

1. **Вход** `openPortal(db, viewer, slug)` (`services/training/portal-gate.ts`): участник — курс `published`, своя строка `course_access.status = 'approved'` (курс завершён — тоже открыт), участник `active` и не удалён → `{ course, preview: false }`. Иначе `training.manage` → `{ course, preview: true }` в любом статусе курса (проверить контент до публикации курса). Иначе `null` → 404 (существование курса не раскрываем).
2. **Уроки** (`portal.ts`): `portalTopics` — видимые темы по `sort_order` с опубликованными неудалёнными уроками по `sort_order`, затем `created_at`; темы без уроков не показываются; уроки без темы — последней группой без заголовка (тема не скрыта). Предпросмотр видит то же, что участник (черновики уроков — в админском предпросмотре 9.2).
3. **Урок** `portalLesson(db, viewer, slug, lessonId)`: те же условия видимости; чужого курса, черновик, удалён, в скрытой теме — `null`. Текст — `pickPortal(body, locale)` (как остальные тексты портала). `portalLessonPdfKey` — ключ того же урока или `null`.
4. **PDF**: `GET …/lessons/{id}/pdf` (`+server.ts`) — проверка входа на клик, 303 на подписанную ссылку (`lessonPdfLink`), как сертификат в `/cabinet/progress`; нет доступа, файла или бакета — 404. Ссылка на 5 минут не протухает на открытой странице.
5. **Предпросмотр**: плашка «Предпросмотр: вы видите портал как участник; тест и практику сдают только через заявку».
6. **Обзор кабинета**: `CabinetOverview.portals` — `{ slug, title }` курсов `published` с моей `approved` заявкой и пустым `exam_id`; в «Что требует действия» — «Доступ к курсу «…» открыт» и кнопка «Открыть портал». `allDone` — только когда нет ни действий, ни порталов.
7. **Переводы** — в `{en,hy,ru}-cabinet-training.ts`.

## Файлы (ожидаемо)

- `src/lib/server/services/training/portal-gate.ts`, `portal.ts` (+ `portal.test.ts`).
- `src/routes/[[lang=lang]]/(site)/cabinet/training/[course]/+page.server.ts`, `+page.svelte`; `…/[course]/lessons/[id]/+page.server.ts`, `+page.svelte`, `…/lessons/[id]/pdf/+server.ts`.
- `src/lib/server/services/cabinet/overview.ts` (+ test), `src/routes/[[lang=lang]]/(site)/cabinet/+page.svelte`.
- `src/lib/i18n/messages/{en,hy,ru}-cabinet-training.ts`.

## Не ломать

- Участник видит только курс со своей одобренной заявкой: `pending` / `rejected` / `revoked`, чужая заявка, черновик курса, блокировка — 404; подмена `lessonId` другого курса — 404.
- editor и moderator без заявки портала не видят (предпросмотр — только `training.manage`).
- Список `/cabinet/training` и решения 9.4; обзор кабинета — прежние действия.

## Проверка

- `npx vitest run src/lib/server/services/training/portal.test.ts src/lib/server/services/cabinet/overview.test.ts src/lib/server/services/training/cabinet-courses.test.ts` → PASS.
- `npm run check`, `npm run lint`.

## Риск

`high` — права (своя заявка, предпросмотр `training.manage`), приватный бакет, `+server.ts`.

## Читать

- `03` § 18.1, 18.2; `06` § 3.2, 5.11; `02` § 11 `course_lessons` (выписано); `zone-notes.md` § «Обучающий портал» (прочитано).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

**9.9** (`09` этап 9): контент курса тренера — 31 урок и 13 практических заданий из `training/trainer-course/` (вне git) загрузить в курс черновиками; публикует владелец после проверки.

Граница: без миграций, без правок самих текстов (они готовы, `check.py` — 0 замечаний). Курс `trainer` и 10 тем уже есть на dev (9.3, `import-quiz-bank.ts`). Не входит: публикация, ответы на вопросы README (владелец, методист, медик, юрист), прод (тем же скриптом с деплоем этапа 9). Памятка 9.8 — `git show 140aaf4:docs/todo.md`.

Факты (прочитано, выписано):
- `09` 9.9: уроки из 10 PDF (ru), 13 заданий — по модулю программ 1-го и 2-го года; загружаются черновиками, публикует владелец.
- `training/trainer-course/README.md`: `manifest.json` — курс, темы в порядке банка, уроки и задания (название + путь к HTML); тело урока — `course_lessons.body.ru`, описание задания — `practice_tasks.description.ru`; HTML — только `h2 h3 p br strong em ul ol li blockquote`.
- `zone-notes.md` § «Обучающий портал»: уроки — `createLesson` (`training.lessons`, журнал `course_lesson.create`), задания — `createTask` (`training.manage`, журнал `practice_task.create`, картинки медиатеки отбрасываются); импорт банка — образец (`question-import.ts`: одна транзакция, `dry` — откат, повтор пропускает имеющееся). Порядок уроков на портале — тема → `sort_order` → `created_at`; заданий — `sort_order` → `created_at`.

## Решения (агент)

1. **Сервис** `content-import.ts` `importCourseContent(db, actor, slug, content, { dry, ip })` — право `training.manage` (admin, у него и `training.lessons`); всё через `createTopic` / `createLesson` / `createTask` — каждая строка в журнале. Одна транзакция — всё или ничего; `dry` — откат с отчётом.
2. **Курс** должен быть (создаёт `import-quiz-bank.ts`: в манифесте нет настроек курса) — нет курса по slug → `not_found`, ничего не пишется. Тема — по названию на любом языке (как у банка); нет — создаётся в конец.
3. **Уроки** — `status = draft`, `sort_order` — позиция в теме по манифесту (0…n−1). **Задания** — статуса нет, видимые; `sort_order` — позиция в манифесте. Участник их не видит, пока курс `draft` (портал — только `published`); скрывать 13 заданий, чтобы владелец потом возвращал по одному, — не надо.
4. **Повтор** не дублирует: урок курса (не удалён) с тем же названием на любом языке — пропуск; задание курса с тем же названием — пропуск (скрытое тоже). Правки текстов после загрузки — только в админке.
5. **Файл**: `courseContentSchema(mediaBaseUrl)` (`validation/training-content.ts`) — темы с уроками (`title`, `body`) и задания (`title`, `description`); тело и описание — те же поля, что в формах админки (`lessonFormSchema().shape.body`, `taskFormSchema.shape.description`), пустое тело — ошибка. Весь файл проверяется до записи.
6. **Скрипт** `scripts/import-course-content.ts --manifest=… --course=trainer [--dry]`: читает манифест, тексты по путям рядом с ним, язык — `manifest.language`; актор — `TRAINING_ACTOR_EMAIL ?? SEED_ADMIN_EMAIL` (активный admin), `R2_PUBLIC_URL` — как в форме урока.

## Файлы (ожидаемо)

- `src/lib/server/services/training/content-import.ts` (+ `content-import.test.ts`) — загрузка.
- `src/lib/validation/training-content.ts` (+ тест в `content-import.test.ts`) — схема файла.
- `scripts/import-course-content.ts` — чтение манифеста и HTML, запуск.

## Не ломать

- Уроки и задания из админки (9.2, 9.7): создание, правка, журнал — без изменений.
- Имеющиеся уроки и задания курса не меняются и не дублируются при повторе.
- Курс, его настройки, темы и банк вопросов не трогаются.

## Проверка

- `npx vitest run src/lib/server/services/training/content-import.test.ts` → PASS.
- `npm run check`, `npm run lint`; на dev: `--dry`, затем загрузка, повтор — 0 новых.

## Риск

`normal` — серверная логика админки (контент), без прав, денег и личных данных; журнал — через существующие сервисы.

## Читать

- `09` 9.9; `training/trainer-course/README.md`; `zone-notes.md` § «Обучающий портал» (прочитано, выписано).

## Фазы

- [x] SPEC `a71aa57`
- [x] RED `50211e4`
- [x] GREEN — dev: `--dry` 31 / 13, загрузка 31 урок (черновики, 10 тем 9/8/7/1×7) и 13 заданий (видимые, порядок 0–12), журнал 31 + 13, размер текстов = файлы; повтор — 0 новых
- [ ] REVIEW (этапа)

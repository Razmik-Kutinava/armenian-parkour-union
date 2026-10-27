# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

**9.3** (`09` этап 9): админка — банк вопросов; импорт 100 вопросов из `training/trainer/Банк вопросов.pdf` с правками (54 — новый вариант, 18 — в тему 1-го года, 93 и другие по Положению — под правила портала, ссылки на разделы исправить). Скрипт читает подготовленный файл из `training/`, вопросы в git не попадают.

Граница: без миграций (`quiz_questions` — 9.1). Выдача теста — 9.6. Памятка 9.2 — `git show 52faf67:docs/todo.md`.

Факты из документов (прочитаны, выписано):
- `05` § 27 «Банк вопросов» (admin): таблица — №, тема, начало текста, правильный вариант, источник, скрыт; фильтры — тема, скрытые; поиск по тексту. Форма — тема, текст ×3, 2–6 вариантов ×3 с отметкой одного правильного, источник. Создать, редактировать, скрыть / вернуть; удаления нет. Под фильтром — «вопросов в теме / нужно в тесте».
- `02` § 11: `quiz_questions` — `topic_id` not null (тема своего курса, составной FK), `text` jsonb, `options` `[{en,hy,ru}, …]` 2–6, `correct_index` с 0 внутри, `source` text null, `hidden_at`, `created_by`. Многоязычные поля портала — **хотя бы один любой язык**, показ — язык страницы → `ru` → `en` (решение 2026-10-27).
- `03` § 18.3: в тест — видимые вопросы видимых тем, поровну по темам. § 18.6: в журнал — создание и правка вопроса (в т. ч. правильного ответа) и скрытие.
- Банк (PDF): 10 блоков = 10 материалов курса (УТП 1, 2, 3 года, педагогика, планирование, первая помощь, EAP, Safeguarding, Положение об аттестации, Этический кодекс), по 4 варианта, правильный + «(источник)». Правки — `questions.md` этап 9 (54, 93, 18), `decisions.md` 2026-10-27.

## Решения (агент)

1. **Язык портала (дефект 9.2):** формы 9.2 требуют EN (`localizedText`, `requireEnIfAny`) — против решения 2026-10-27; русский контент (банк, 9.9) не сохранится. Общая схема `portalText(max)` — хотя бы один язык (иначе `training.error.anyLanguage`), показ `pickPortal` — язык страницы → `ru` → `en` → `hy`. Применить: курс (название; описание — можно пусто), тема, урок (название, текст — без «EN, если есть другой»), вопрос. Поля EN в формах — не `required`.
2. **Права:** банк — `training.manage` (admin). Вкладка «Вопросы» в карточке курса — только admin.
3. **Адреса:** `/admin/training/[id]/questions` (список; `?topic=`, `?hidden=1`, `?q=`), `/questions/new`, `/questions/[questionId]` (форма + `?/hide`, `?/restore`).
4. **Форма:** тема — тема этого курса (скрытая допустима, иначе `bad_topic`); текст — простой, ≤ 1000; варианты — 6 строк в форме, пустые строки (все языки пусты) отбрасываются, номер правильного пересчитывается; правильный — заполненная строка (`training.error.correct`); итог 2–6 (`training.error.options`); вариант ≤ 300; у каждого варианта есть все языки текста вопроса (`training.error.optionLang`); источник ≤ 200, необязателен.
5. **Сервис `questions.ts`:** `createQuestion`, `updateQuestion`, `setQuestionHidden`; право внутри, отказ — код (`not_allowed | not_found | bad_topic | bad_state`). Журнал в той же транзакции: `quiz_question.create` (after — всё), `update` (before / after только изменённых: `topicId`, `text`, `options`, `correctIndex`, `source`; без изменений — без записи), `hide | restore` (повтор — `bad_state`). Правка скрытого вопроса разрешена.
6. **Список `question-list.ts`:** все вопросы курса по `sort_order` темы, `created_at`, `id`; № — место в этом порядке (не меняется от фильтров); фильтры и поиск (без регистра, по всем языкам текста) — в памяти (банк — сотни строк). Счётчики: видимых вопросов в видимых темах всего / `quiz_size`; по выбранной теме — видимых в ней / `ceil(quiz_size / видимых тем)`; не хватает — предупреждение.
7. **Импорт:** логика — `services/training/question-import.ts` (весь файл проверяется до записи; курс по `slug` — нет: создаётся `createCourse` из блока `course` файла, есть: настройки не трогаются; темы — по совпадению названия на любом языке, иначе `createTopic` в порядке файла; вопрос с тем же `text` в курсе — пропуск; остальное — `createQuestion`). Всё через сервисы — журнал пишется. Скрипт `scripts/import-quiz-bank.ts --file=… [--dry]`, актор — `TRAINING_ACTOR_EMAIL ?? SEED_ADMIN_EMAIL` (активный admin), как `fill-system-pages.ts`. Повторный запуск добавляет только новые вопросы; правки — через админку.
8. **Данные:** `training/trainer/quiz-bank.json` (вне git) — агент из PDF: 54 — «Желание спать» → «Покраснение кожи»; 18 — в тему 1-го года, источник по программе 1-го года; 93 — «за полгода»; 86–93 сверить с Положением и правилами портала (27 / 25, 30 дней, 3 за полгода); источники — «<урок>, раздел N» по тексту материалов. Импорт на dev; на прод — с деплоем этапа 9.
9. **Переводы:** `{en,hy,ru}-training-questions.ts`, подключаются в `*-training-admin.ts` (`en.ts` > 200 строк не трогаем).

## Файлы (ожидаемо)

- `src/lib/validation/training.ts` (+ test) — `portalText`, `questionFormSchema`; `src/lib/i18n/localized.ts` — `pickPortal`.
- `src/lib/server/services/training/questions.ts`, `question-list.ts`, `question-import.ts` (+ тесты), `test-support.ts`.
- `src/routes/admin/training/[id]/questions/**`, `[id]/+layout.svelte` (вкладка); формы и страницы 9.2 — `pickPortal`, EN не `required`.
- `scripts/import-quiz-bank.ts`.
- `src/lib/i18n/messages/{en,hy,ru}-training-questions.ts`, `*-training-admin.ts`.
- `tests/e2e/admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-training.ts`, `admin-permissions-training.ts`.

## Не ломать

- Права и журнал прочих разделов (`access-coverage`, `audit-coverage`, `admin-permissions.spec.ts`); editor не видит вкладку и адреса банка.
- Курсы, темы, уроки 9.2 с английским текстом сохраняются как раньше; счётчик «вопросов» в темах и списке курсов.
- Вопрос не удаляется; тема вопроса — только своего курса.

## Проверка

- `npx vitest run src/lib/server/services/training src/lib/validation/training.test.ts src/routes/admin/access-coverage.test.ts` → PASS.
- `npm run check`, `npm run lint`; импорт на dev: `npx tsx scripts/import-quiz-bank.ts --file=training/trainer/quiz-bank.json` (100 вопросов, повтор — 0 новых).

## Риск

`high` — права новых адресов (`training.manage`), журнал правильного ответа (`03` § 18.6).

## Читать

- `05` § 27, `02` § 11, `03` § 18.3, 18.6 (выписано); `zone-notes.md` § «Обучающий портал» (прочитано); `questions.md` этап 9, `decisions.md` 2026-10-27 (выписано).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] Данные: `quiz-bank.json`, импорт на dev
- [ ] REVIEW (этапа)

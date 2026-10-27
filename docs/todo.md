# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

**9.2** (`09` этап 9): админка портала — курсы (настройки теста и допуска), темы, уроки с PDF в приватном бакете.

Граница: без миграций (таблицы 9.1). Банк вопросов — 9.3, заявки — 9.4, портал участника — 9.5, задания практики — 9.7, счётчики дашборда — 9.8. Колонки «вопросов / заданий / заявок» в списке курсов считаются по таблицам 9.1 (пока нули).

Факты из документов (прочитаны, выписано):
- `05` § 27: адреса `/admin/training`, `/admin/training/{course id}`; список курсов — название, вид экзамена, статус, уроков, вопросов, заданий, заявок `pending`; форма — slug, вид экзамена, название и описание ×3, статус; настройки теста (вопросов, правильных + процент, минут, пауза дней, попыток за период, период дней); допуск (членство, мин. возраст, мин. степень); изменение настроек — в журнал. Вкладки карточки: «Темы» (admin: название ×3, ↑ / ↓, скрыть / вернуть, в строке — уроков и видимых вопросов), «Уроки» (`training.lessons`: по темам; тема, название ×3, текст — редактор новостей, PDF до 10 МБ в приватный бакет, тип по сигнатуре, порядок, статус, предпросмотр; удаление мягкое).
- `04`: `training.lessons` — editor, admin; `training.manage` — admin; `training.review` — moderator, admin.
- `03` § 18.2: PDF — приватный бакет, ключ `training/<course id>/<uuid>.pdf` (`02`); § 18.6: в журнал — изменение настроек курса (остальное в 9.2 — по правилу админки «каждое действие — в карту журнала»).

## Решения (агент)

1. **Права:** три кода `training.*` в `permissions.ts` по `04`. `/admin/training` (список) — `training.lessons` (editor видит курсы только чтобы попасть в уроки; «Новый курс» — только при `training.manage`); `new`, `[id]` (курс), `[id]/topics` — `training.manage`; `[id]/lessons/**` — `training.lessons`. Меню — пункт «Обучение» в группе «Участники», право `training.lessons` (moderator — с 9.7). Общий `[id]/+layout.server.ts` — `training.lessons`, шапка курса и вкладки по правам.
2. **Курс (форма):** slug (`slugSchema`, уникален), вид экзамена (`EXAM_KINDS`), название ×3 (EN обязателен, ≤ 200), описание ×3 — простой текст ≤ 2000, необязательно (EN, если есть другой язык), статус `draft | published | archived`. Тест: вопросов 1–200, правильных 1–«вопросов», минут 1–600, пауза 0–365 дней, попыток 1–50, период 1–3650 дней. Допуск: членство (галочка), мин. возраст — пусто или 1–99, мин. степень — пусто или `novice | advanced | pro`. Процент рядом с порогом — в браузере.
3. **Журнал:** `course.create` (after — настройки), `course.update` (before / after только изменённых полей; пустое сохранение — без записи); `course_topic.create | update | reorder | hide | restore`; `course_lesson.create | update | delete`; PDF прикреплён / убран — `course_lesson.update` с полем `file`. `?/pdfSign` — в `NOT_AUDITED` (только ссылка на загрузку).
4. **Темы:** новая — в конец (`max(sort_order) + 1`); ↑ / ↓ — обмен с соседом среди всех тем курса (скрытые тоже), темы курса блокируются `FOR UPDATE`, порядок перенумеровывается 0…n−1. Скрыть / вернуть — `hidden_at`; повтор — `bad_state`. Счётчики: уроков без `deleted_at`, вопросов без `hidden_at`.
5. **Уроки:** тема — пусто или тема этого курса (иначе `bad_topic`; скрытая допустима — готовят заранее); текст ×3 — `richTextSchema` как у новостей, картинки из медиатеки берутся `FOR SHARE` (`lockPageMedia`), поиск использования файла — `course_lesson` в `media/usage.ts` (кроме удалённых); порядок 0–9999; статус ×3. Удаление — `deleted_at`, файл остаётся в бакете. Список — по `sort_order` темы (без темы — в конце), затем урока.
6. **PDF:** только у сохранённого урока (на странице урока). `pdfSign` — урок есть в курсе, `application/pdf`, 1 байт–10 МБ → ключ `training/<course id>/<uuid>.pdf` и подписанный PUT; `pdfComplete` — ключ этого курса, объект есть, ≤ 10 МБ, сигнатура `%PDF-` (иначе объект удаляется), затем в транзакции с блокировкой урока — `file_key` / `file_name` + журнал; прежний файл удаляется после коммита (ошибка — только в лог). `pdfRemove` — то же, без нового файла. Нет бакета — понятная ошибка, не 500. Ссылка на просмотр — `presignGet` на 5 минут.
7. **Предпросмотр:** `/admin/training/[id]/lessons/[lessonId]/preview` — сохранённая версия в любом статусе (название, текст, ссылка на PDF), `training.lessons`.
8. **Кеш:** `training: []` в `cache/admin-groups.ts` (портал публично не кешируется).
9. **Переводы:** `en-training-admin.ts` + `hy` / `ru` (вычитка — носитель языка).

## Файлы (ожидаемо)

- `src/lib/server/auth/permissions.ts` (+ test), `src/lib/server/admin/nav.ts`, `src/lib/components/admin/nav-icons.ts`, `src/lib/server/cache/admin-groups.ts` (+ test).
- `src/lib/validation/training.ts` (+ test).
- `src/lib/server/services/training/` — `courses.ts`, `course-list.ts`, `topics.ts`, `lessons.ts`, `lesson-list.ts`, `lesson-files.ts` + тесты; `services/media/usage.ts`.
- `src/routes/admin/training/**` — список, `new`, `[id]` (курс, `topics`, `lessons`, `lessons/new`, `lessons/[lessonId]`, `preview`).
- `src/lib/i18n/messages/{en,hy,ru}-training-admin.ts`, `{en,hy,ru}.ts`.
- `tests/e2e/admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-training.ts`, `admin-audit-actions.ts`, `admin-permissions-training.ts`, `admin-permissions.spec.ts`.

## Не ломать

- Права прочих разделов админки и карта прав / журнала (`access-coverage`, `audit-coverage`, `admin-permissions.spec.ts`).
- Удаление файла медиатеки: файл в тексте урока не удаляется (`findUsages`).
- Приватный бакет согласий и сертификатов — без изменений `storage/r2.ts`.

## Проверка

- `npx vitest run src/lib/server/services/training src/lib/validation/training.test.ts src/lib/server/auth src/lib/server/cache src/routes/admin/access-coverage.test.ts` → PASS.
- `npm run check`, `npm run lint`; e2e (по возможности) — `admin-permissions.spec.ts`, `admin-audit.spec.ts`.

## Риск

`high` — права (`permissions.ts`, новые `training.*`).

## Читать

- `05` § 27, `04` § 5.1 (`training.*`), `03` § 18.1–18.2, 18.6 (выписано); `zone-notes.md` § «Обучающий портал», § «Согласия и приватные файлы», § «Контент и админка» (прочитано).

## Фазы

- [x] SPEC
- [x] RED (`aa7b6c5`)
- [x] GREEN
- [ ] REVIEW (этапа)

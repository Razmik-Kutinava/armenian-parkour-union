# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

**9.8** (`09` этап 9): завершение курса — автоматический экзамен `passed`, письма участнику и админу, счётчики на дашборде; сертификат — существующий поток. Сюда же — прогресс «тест / принято N из M» в `/cabinet/training` (отложен из 9.6 / 9.7).

Граница: без миграций (`course_access.exam_id` unique, `exams` — есть с 9.1 / 6.1). Не входит: `/admin/training/attempts`, карточка участника в заявке (попытки, практика, ссылка на экзамен), тесты 9.10. Памятка 9.7 — `git show e192962:docs/todo.md`.

Факты из документов (прочитаны, выписано):
- `03` § 18.5: курс завершён, когда тест сдан и по каждому видимому заданию есть принятая отправка; проверка — в той же транзакции, что последнее событие (отправка теста или принятие видео). Создаётся `exams`: `kind = courses.exam_kind`, `result = passed`, `score` — процент правильных в сданной попытке, `decided_at = now()`, `examiner_id` — кто принял последнее видео, `notes` — «Обучающий портал: тест X/Y, практика N/N»; `id` — в `course_access.exam_id` (unique — дважды не создаётся). После коммита — письмо участнику («Курс пройден, ждёт выдачи сертификата») и админу (`site_settings.contacts.email`). Сертификат — admin из карточки экзамена (§ 4, без изменений). Задание, скрытое или добавленное после завершения, на завершённый курс не влияет.
- `03` § 18.6: в журнал — создание экзамена по итогам курса (актор — тот, чьё действие завершило курс); письма «курс завершён» — участнику и админу.
- `05` § 3: «Требует действия» с этапа 9 — заявки на курсы (admin), практические видео на проверке, курсы завершены и ждут сертификата (admin); счётчик — только с правом на раздел.
- `06` § 5.11: `approved` — «Открыть портал» и прогресс: тест (не сдан / сдан, дата пересдачи), практика (принято N из M); курс завершён — «Курс пройден, ждёт выдачи сертификата»; после выдачи — ссылка на сертификат в `/cabinet/progress`.
- `04`: `training.manage` (admin), `training.review` (moderator, admin), `certificates.issue` (admin), `exams.manage` (moderator, admin).

## Решения (агент)

1. **Завершение** — `course-complete.ts` `completeCourse(tx, courseId, userId, actorId, deps)` → письма (пустой массив — не завершён). Под блокировкой `course_access`: строка `approved` и `exam_id` пуст (иначе — ничего; закрытый доступ курс не завершает), есть попытка `passed = true`, принято = видимых заданий (видимых нет — курс завершает один тест: «по каждому видимому» пусто). Экзамен: `scheduled_at = decided_at = now` (в списке экзаменов сортировка и период — по `scheduled_at`, без него экзамен уходит в конец), `score = correct / total × 100` (2 знака), `examiner_id` — `reviewed_by` последней принятой отправки по видимым заданиям (нет — `null`), `notes` — на английском из переводов (`Training portal: quiz X/Y, practice N/N`; адрес федерации тоже без языка — решение 3.7). Журнал `exam.course_complete` (entity `exam`, after — `kind`, `score`, `courseId`, `userId`, `examinerId`, `notes`).
2. **Вызовы**: `reviewPractice` после «Принять» (актор — проверяющий, его IP); `closeAttempt` при `passed` — и в `submitAttempt`, и в ленивом `settleExpired` (актор — участник; IP — из маршрута теста, у ленивого закрытия `null`). `closeAttempt` возвращает список писем.
3. **Порядок блокировок**: `submitPractice` берёт `course_access`, затем отправку; `reviewPractice` теперь так же — сначала `course_access` участника (по курсу задания), потом строку отправки (иначе взаимоблокировка «замена ссылки против принятия»).
4. **Письма** (`course-complete-mail.ts`): участнику — на его языке, ссылка `/cabinet/training`; админу — EN, на `contacts.email`, ссылка на карточку экзамена `/admin/exams/{id}` (там «Выдать сертификат»); адреса нет — только участнику.
5. **Дашборд** (`attention.ts`): `training_requests` (`training.manage`, `/admin/training/access`, заявки `pending`), `practice` (`training.review`, `/admin/training/practice`, отправки `pending`), `training_finished` (`certificates.issue`, `/admin/exams?certificate=course` — экзамен `passed` из `course_access.exam_id` без живого сертификата, участник не удалён). Фильтр `certificate=course` — в списке экзаменов (`exams/awaiting.ts`, общее условие со счётчиком).
6. **Прогресс в `/cabinet/training`** (`cabinet-courses.ts` + `cabinet-progress.ts`): у `approved` — `progress { quizPassed, retakeAt, accepted, total }` (`retakeAt` — из `quizState` при `wait`); у `finished` — `certified` (живой сертификат на экзамен курса) → ссылка на `/cabinet/progress`.

## Файлы (ожидаемо)

- `src/lib/server/services/training/course-complete.ts`, `course-complete-mail.ts`, `cabinet-progress.ts` (+ `course-complete.test.ts`); правки — `practice-review.ts`, `quiz-close.ts`, `quiz-submit.ts`, `cabinet-courses.ts` (+ тест), `quiz-submit.test.ts`.
- `src/lib/server/services/exams/awaiting.ts`, `exams/list.ts` (+ `awaiting.test.ts`); `services/dashboard/attention.ts` (+ тест).
- `src/routes/[[lang=lang]]/(site)/cabinet/training/CourseCard.svelte`, `[course]/test/+page.server.ts` (IP); `src/routes/admin/exams/+page.svelte` (фильтр).
- `src/lib/i18n/messages/{en,hy,ru}-training-complete.ts`, `{en,hy,ru}-cabinet.ts`, `{en,hy,ru}-dashboard.ts`, `{en,hy,ru}-exams-admin.ts`.

## Не ломать

- Тест и практика 9.6–9.7: результат и письмо теста, повторная отправка — один раз; решение по видео, своё видео, чужая отправка.
- Экзамен создаётся один раз (`exam_id` unique + `exam_id` пуст под блокировкой); завершённый курс не завершается снова.
- Выдача сертификата 6.3 по экзамену `passed` — без изменений; степень и баллы не трогаются.

## Проверка

- `npx vitest run src/lib/server/services/training/course-complete.test.ts src/lib/server/services/training/practice-review.test.ts src/lib/server/services/training/quiz-submit.test.ts src/lib/server/services/training/cabinet-courses.test.ts src/lib/server/services/exams/awaiting.test.ts src/lib/server/services/exams/list.test.ts src/lib/server/services/dashboard/attention.test.ts` → PASS.
- `npm run check`, `npm run lint`.

## Риск

`high` — создание экзамена (путь к сертификату и степени), журнал действий, права счётчиков.

## Читать

- `03` § 18.5–18.6; `05` § 3, § 27; `06` § 5.11; `02` § 11 (схема — по коду); `04` `training.*`, `certificates.issue` (выписано); `zone-notes.md` § «Обучающий портал» (прочитано).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

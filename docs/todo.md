# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

9.13 (доделки этапа 9 после REVIEW, решения владельца 2026-10-28): скрытие практического задания завершает курс у одобренных участников, у которых скрытое было последним непринятым (тест сдан, все остальные видимые задания приняты). Сейчас курс у них висит до следующего события (`zone-notes.md` § «Обучающий портал», 9.8 «Известное»).

Решения (чего нет в документах — помечено «решение агента»):
1. Только скрытие (`hidden = true`). Возврат задания ничего не завершает и не отменяет: завершённый курс от заданий не зависит (`03` § 18.5 п. 5).
2. Кандидаты — все `course_access` этого курса со статусом `approved` и пустым `exam_id`; каждый проходит через `completeCourse` (он сам проверяет сданный тест и «принято = видимых»). Новой формулы завершения нет.
3. Порядок блокировок портала (`zone-notes` 9.8): при скрытии сначала `course_access` кандидатов (`FOR UPDATE`, по `id`), потом строка задания (`lockTask`). Иначе взаимная блокировка с `submitPractice` (держит заявку, вставка отправки берёт ключевую блокировку задания). Возврат — как сейчас.
4. Актор экзамена и журнала `exam.course_complete` — админ, скрывший задание (`03` § 18.6 п. 1: «тот, чьё действие завершило курс»); `examiner_id` — как в `completeCourse` (кто принял последнее видимое). `hidden_at` и `now` экзамена — одно время.
5. Письма «курс завершён» (участнику и на `contacts.email`) — после коммита; ошибка отправки — `console.warn`, экзамен остаётся (как в `reviewPractice`).
6. Статус курса и участника не проверяется — как у остальных событий завершения (решение агента).
7. Ответ админу не меняется (`'ok'`), сообщения «завершено у N» нет — в `05` его нет (решение агента).
8. Сигнатура: `setTaskHidden(db, actor, courseId, taskId, hidden, deps)`, `deps = { send, siteUrl, ip, now? }` вместо `ip`.

Хвост документов (на закрытие этапа, владельцу): `03` § 18.5 п. 1 — добавить третье событие проверки «скрытие задания админом».

## Файлы (ожидаемо)

- `src/lib/server/services/training/practice-tasks.ts` — `setTaskHidden`: `deps`, блокировка заявок до задания, завершение кандидатов, письма после коммита.
- `src/lib/server/services/training/course-complete-hide.ts` (новый, если `practice-tasks.ts` уходит за 120 строк) — `lockOpenAccess(tx, courseId)` и цикл `completeCourse` по кандидатам.
- `src/lib/server/services/training/practice-task-hide.test.ts` (новый) — RED: скрыли последнее непринятое → экзамен, `exam_id`, журнал с админом, два письма; не последнее / тест не сдан / доступ закрыт / курс уже завершён → ничего; возврат → ничего; другой курс не задет.
- `src/lib/server/services/training/race.test.ts` (+ `race-support.ts` при нужде) — скрытие и отправка видео параллельно: без `40P01`, экзамен не больше одного.
- `src/routes/admin/training/[id]/tasks/+page.server.ts` — `send: sendMail`, `siteUrl: PUBLIC_SITE_URL`, `ip`.
- `practice-tasks.test.ts`, `rights.test.ts` — новая сигнатура (`deps` вместо `IP`).

## Не ломать

- Скрытие и возврат: журнал `practice_task.hide|restore`, повтор — `bad_state`, чужой курс — `not_found`, editor и moderator — `not_allowed` (`practice-tasks.test.ts`, `rights.test.ts`).
- Экзамен по курсу — не больше одного (`exam_id` unique, двойная блокировка `race.test.ts`); завершённый курс не завершается снова.
- Завершение при «Принять» и сдаче теста (`course-complete.test.ts`) — как раньше.
- Участник без сданного теста или с непринятым видимым заданием курс не получает.

## Проверка

- `npx vitest run src/lib/server/services/training/practice-task-hide.test.ts src/lib/server/services/training/practice-tasks.test.ts src/lib/server/services/training/course-complete.test.ts src/lib/server/services/training/rights.test.ts src/lib/server/services/training/race.test.ts`
- `npm run check`, `npm run lint`; e2e — CI.

## Риск

`high` — создаёт экзамен `passed` (путь к сертификату и степени), журнал, новый порядок блокировок в транзакции; прав и миграций не меняет.

## Читать

- `03` § 18.5 (п. 1 — условия и транзакция; п. 5 — скрытие после завершения не влияет), § 18.6 п. 1 (актор экзамена) — выписано выше.
- `zone-notes.md` § «Обучающий портал»: 9.7 (`practice-tasks.ts`), 9.8 (`completeCourse`, порядок блокировок, «Известное» про скрытие), 9.10 (`race.test.ts`, уборка по курсу).
- Образец зависимостей и писем — `practice-review.ts` (`ReviewDeps`, отправка после коммита), маршрут `admin/training/practice/[id]/+page.server.ts`.

## Фазы

- [x] SPEC
- [x] RED `8571b5e`
- [x] GREEN

Итог: кандидаты и цикл завершения — `course-complete-hide.ts` (`lockOpenAccess`, `completeAfterHide`). Гонка в `race.test.ts` — только «скрытие первым, отправка ждёт» (`race` не даёт перемежать шаги, взаимную блокировку не воспроизвести — порядок держит код); в RED она показала, что отправка видео проходила на только что скрытое задание (читала его до коммита скрытия), теперь — `finished`.
- [ ] REVIEW (этапа 9)

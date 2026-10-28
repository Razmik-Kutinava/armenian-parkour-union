# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

9.14 (доделки этапа 9 после REVIEW, решения владельца 2026-10-28): «Принять» видео — только если ссылка не менялась с момента показа карточки проверяющему; иначе отказ «ссылка изменилась, обновите страницу». Сейчас участник может заменить ссылку `pending`-отправки, пока проверяющий смотрит карточку, — и тот примет уже новую, не просмотренную (`zone-notes.md` § «Обучающий портал», 9.7 «Известное»).

Решения (чего нет в документах — помечено «решение агента»):
1. Сравнивается сама ссылка: карточка отдаёт в форму решения показанную `url` (скрытое поле `url` через `fields` у `ConfirmDialog`), сервис сравнивает её со `practice_submissions.url` строки под блокировкой. Хранимая ссылка уже нормализована (`normalizePracticeUrl`), карточка показывает её же — сравнение строгое, без повторной нормализации. Замена A → B → A — ссылка та же, принимать можно (ровно то, что видел проверяющий). Миграции нет.
2. Проверка и для «Вернуть» (решение агента): комментарий написан про показанное видео; вернуть не просмотренную ссылку — участник теряет отправку и пересдаёт без причины. Владелец может сузить до «Принять».
3. Новый отказ `changed` у `reviewPractice`; порядок проверок: права → комментарий → `id` → (блокировки) → нет строки `not_found` → `own` → не `pending` — `bad_state` → ссылка не та — `changed`. Решение уже есть — важнее, чем «ссылка изменилась».
4. Поле `url` пустое или его нет — `changed` (наша форма шлёт его всегда; запрос в обход формы не принимает непоказанное).
5. При `changed` ничего не пишется: статус `pending`, журнала и писем нет, курс не завершается.
6. Сравнение — после `accessOf(..., true)` и `FOR UPDATE` строки отправки: `submitPractice` держит тот же порядок (заявка → строка), поэтому замена и решение строго по очереди — либо замена раньше (решение видит новую ссылку → `changed`), либо решение раньше (замена видит `approved` → `bad_state`, после `rejected` — новая строка).
7. Маршрут: `url` из формы → `ReviewInput.url`; `changed` → `fail(400, { message: 'training.practice.error.changed' })`; тексты en / hy / ru — «Участник заменил ссылку. Обновите страницу и посмотрите новое видео.» (по смыслу; hy — по глоссарию `zone-notes` шаг 4).
8. `ReviewInput = { action, comment, url }` — `url` обязателен (необязательный открыл бы обход проверки). В тестах сервиса — `url: YT(1)` (ссылка `insertSubmission` по умолчанию).

## Файлы (ожидаемо)

- `src/lib/server/services/training/practice-review.ts` — `ReviewInput.url`, отказ `changed`, сравнение под блокировкой (сейчас 122 строки, станет ~127 — в норме до 200).
- `src/lib/server/services/training/practice-review.test.ts` — RED: другая ссылка → `changed`, строка `pending`, журнала и писем нет (и для «Вернуть»); пустая → `changed`; та же → `ok`; решённая + другая ссылка → `bad_state`.
- `src/lib/server/services/training/practice-review-race.test.ts` (новый; `race.test.ts` уже 200 строк — не дописывать) — замена ссылки (`submitPractice`) и «Принять» по старой параллельно через `portalRaceDb`: либо `changed` и строка `pending` с новой ссылкой, либо принята старая и замена — `bad_state`; принятой непоказанной ссылки нет.
- `src/routes/admin/training/practice/[id]/+page.server.ts` — поле `url`, `REFUSED.changed`.
- `src/routes/admin/training/practice/[id]/+page.svelte` — скрытое `url` в `ConfirmDialog` (`fields`).
- `src/lib/i18n/messages/{en,hy,ru}-training-practice.ts` — `training.practice.error.changed`.
- Сигнатура в тестах: `course-complete.test.ts`, `race.test.ts`, `rights.test.ts` (константа `approve` / вызов — `url: YT(1)`, строк не добавлять: первые два > 200); e2e `tests/e2e/admin-audit-practice.ts` — `url` в `?/approve` и `?/reject` (иначе аудит-e2e получит 400).

## Не ломать

- «Принять» и «Вернуть» по показанной ссылке — как раньше: статус, журнал `practice_submission.approve|reject`, письмо участнику, завершение курса после последнего принятого (`practice-review.test.ts`, `course-complete.test.ts`).
- Отказы `own`, `bad_state`, `not_allowed`, `not_found`, `invalid` — прежние (`practice-review.test.ts`, `rights.test.ts`).
- Двойное «Принять» двумя проверяющими и завершение курса — один экзамен (`race.test.ts`).
- Отправка и замена ссылки участником (`practice-submit.test.ts`) — не меняются.

## Проверка

- `npx vitest run src/lib/server/services/training/practice-review.test.ts src/lib/server/services/training/practice-review-race.test.ts src/lib/server/services/training/course-complete.test.ts src/lib/server/services/training/race.test.ts src/lib/server/services/training/rights.test.ts`
- `npm run check`, `npm run lint`; e2e (`admin-audit` практики) — CI.

## Риск

`high` — «Принять» ведёт к экзамену `passed` (путь к сертификату и степени), журнал, порядок блокировок в транзакции решения; прав и миграций не меняет.

## Читать

- `03` § 18.4 п. 4–5 (решение проверяющего) — только если в RED понадобится формулировка; остальное выписано выше.
- `zone-notes.md` § «Обучающий портал»: 9.7 (`practice-submit`, `practice-review`, «Известное» про замену), 9.8 (порядок блокировок), 9.10 (`race-support.ts`, уборка по курсу) — уже прочитано.
- Код: `practice-review.ts`, `practice-submit.ts`, `practice-queue.ts` (`practiceDetail` — `url` в карточке), `ConfirmDialog.svelte` (`fields`), `race.test.ts` (образец гонки).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа 9)

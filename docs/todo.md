# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

Долг этапа 6 — заявка на экзамен из кабинета (`questions.md` 2026-10-26: участник подаёт сам; `04` § 7 / § 9 п. 4). Сейчас экзамен назначает только сотрудник (`scheduleExam`); статуса заявки нет.

## Решения SPEC

1. **Модель — новая таблица `exam_applications`**, не расширение `exams` / `exam_result`.
   - Причина: `exam_result` = исход сдачи (`scheduled|passed|failed|cancelled`); заявка — отдельный жизненный цикл до назначения. Образец: `course_access`, `volunteer_cards`.
   - Поля: `id`, `user_id`, `kind` (`exam_kind`), `status` (`exam_application_status`: `pending|approved|rejected`), `review_note` (причина отказа, видна участнику; обязательна при `rejected`), `reviewed_by`, `reviewed_at`, `exam_id` (FK `exams` null unique — после назначения), `created_at`, `updated_at`.
   - Ограничение: unique(`user_id`, `kind`) — одна строка на пару; повтор после `rejected` → снова `pending` (как портал).
   - Индекс: (`status`, `created_at`) для очереди админки.

2. **Кто подаёт / какой kind.** Только следующий экзамен степени из `nextLevelStep`: `novice` → `level_advanced`, `advanced` → `level_pro`. `trainer` / `judge` из кабинета progress **не** подаются (тренер — портал 9.8; судья — вне этой задачи). Сотрудник по-прежнему может назначить любой kind через `/admin/exams/new`.

3. **Условия допуска (сервер).** Тот же `checkExamAdmission` + `readExamFacts`, `at = now`. Заявка создаётся только если `refusal === null` **и** нет `level_mismatch` (для самоподачи «не та степень» — отказ, не предупреждение). Иначе форма показывает, чего не хватает (`blocked`, `no_membership`, `already_scheduled`, `awaiting_certificate`, `retake_too_soon` + дата, `level_too_recent` + дата, неверный уровень); action не пишет строку. Уже есть `pending` / `approved` без закрытого цикла — `bad_state`. Блокировка / нет пользователя — отказ.

4. **UX кабинет `/cabinet/progress`.** В блоке шкалы (`LevelScale` / next): при `step = exam` и условиях ок — кнопка «Подать заявку»; при отказе — текст как сейчас + без кнопки; при своей `pending` — статус «Заявка на рассмотрении»; при `rejected` — причина + кнопка подать снова (если условия снова ок). Список экзаменов без заметок/экзаменатора — как сейчас. Action `?/apply` в `progress/+page.server.ts` (user id только из сессии).

5. **Админка.** Право `exams.manage` (moderator + admin), проверка в сервисе.
   - Список заявок: фильтр/вкладка на `/admin/exams` (`?applications=1` или `status=pending` заявок) + счётчик дашборда `exam_applications` → тот же список.
   - **Одобрение = назначение:** из заявки → форма как `/admin/exams/new` (дата, событие, экзаменатор, заметки, `confirmLevel` при warning) → внутри вызывает `scheduleExam`; успех → заявка `approved`, `exam_id`, audit `exam_application.approve`. Прямое назначение с `/admin/exams/new` без заявки **остаётся**; если была `pending` на (user, kind) — автоматически `approved` + `exam_id` в той же транзакции (или сразу после insert).
   - **Отказ:** причина обязательна → `rejected`, audit `exam_application.reject`, письмо участнику.
   - Editor / member / гость — не видят и не могут решить (сервер).

6. **Письма** (после коммита, ошибка не ломает операцию).
   - Новая заявка → на `site_settings.contacts.email` (как портал/книжка), ссылка `/admin/exams?…`.
   - Отказ → участнику (причина + `/cabinet/progress`).
   - При назначении отдельного письма нет (как у текущего `scheduleExam`).

7. **Аудит.** Подача участником в журнал **не** пишется (как `applyForCourse` / `applyForCard`). Пишутся решения: `exam_application.approve` / `exam_application.reject` (entity `exam_application`). `exam.schedule` — как сейчас.

8. **Migration Gate (0019).**
   - Вперёд: enum `exam_application_status`; таблица `exam_applications` + FK + unique(`user_id`,`kind`) + unique(`exam_id`) where not null + индекс (`status`,`created_at`).
   - Откат `scripts/rollback/0019_down.sql`: `DROP TABLE exam_applications`; `DROP TYPE exam_application_status`.
   - Данные: пустая таблица, прод-совместимо. Ждать **«go»** до RED/миграции на dev.

9. **Вне scope.** 3.13 / банк; правка канона `02`/`03`/`04` (расхождение `03` § 4 п. 1 vs решение владельца — факт в `questions.md`; правку docs — отдельной просьбой); заявка на trainer/judge; отмена заявки участником; блок «требует действия» на обзоре кабинета (`06` § 5.1 — известный долг 6.8).

## Файлы (ожидаемо)

1. `src/lib/server/db/schema/enums.ts` + `certification.ts` — enum и таблица.
2. `drizzle/0019_exam_applications.sql` + `scripts/rollback/0019_down.sql` (+ schema-тест по образцу 0012).
3. `src/lib/server/services/exams/apply.ts` (+ `apply.test.ts`) — подача из кабинета.
4. `src/lib/server/services/exams/application-decide.ts` (+ тест) — reject; связка approve при `scheduleExam`.
5. `src/lib/server/services/exams/schedule.ts` / `list.ts` (+ admin list заявок) — авто-закрытие pending; список для админки.
6. `src/routes/.../cabinet/progress/+page.server.ts` + `LevelScale.svelte` (или сосед) — кнопка / статусы / i18n.
7. `src/routes/admin/exams/*` + `dashboard/attention.ts` — очередь и счётчик.

## Не ломать

1. `scheduleExam` без заявки — по-прежнему работает; условия допуска и `confirmLevel` те же.
2. Выдача сертификата / смена степени / портальный экзамен (`course_access.exam_id`) — без изменений.
3. Кабинет progress: чужие id не читаются; PDF/QR только свои.
4. Moderator не выдаёт сертификат; editor не управляет экзаменами.

## Проверка

- `npx vitest run src/lib/server/services/exams/apply.test.ts src/lib/server/services/exams/application-decide.test.ts` (и затронутые schedule/list при изменении).
- `npm run check` && `npm run lint`.
- Happy: условия ок → заявка `pending` → письмо админу; staff назначает → `approved` + строка `exams`; отказ без условий / без права — отказ на сервере.
- Отказ: нет членства / уже scheduled / pending / level_mismatch → заявка не создаётся.

## Риск

`high` — миграция, права `exams.manage`, audit, письма, личные данные в админке.

## Читать

- `02` § enum + `exams` (131–146)
- `03` § 3–4 (степени, экзамены)
- `04` § 7 (подача на экзамен), § 9 п. 4
- `05` § 7 (админка экзаменов)
- `06` § 5.5 (progress), § 6 (письма)
- `zone-notes` § «Экзамены и сертификаты», § «Кабинет»
- код: `exams/admission|schedule|facts`, `cabinet/progress*`, образцы `training/access.ts`, `volunteer/card-apply.ts`

## Фазы

- [x] SPEC
- [x] RED — `feaf8de`
- [x] GREEN
- [ ] REVIEW (одиночная задача — после GREEN, база = коммит перед RED `feaf8de^`; **без** bugbot/security-review по просьбе владельца: свой проход по диффу + crit-audit)

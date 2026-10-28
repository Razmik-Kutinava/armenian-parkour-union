# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

9.11 (доделки этапа 9 после REVIEW, решения владельца 2026-10-28): `/admin/training/attempts` — список попыток теста и карточка попытки по `05` § 27 «Попытки»; лимит — из настроек курса (`attempts_limit` за `attempts_period_days`, у `trainer` — 3 за 180 дней), не зашит в код.

Решения (из `05` § 27, `04`, `02` § 11; чего нет в документах — помечено «решение агента»):
1. Право — `training.review` (moderator, admin; `04`: «просмотр попыток»). Действий на странице нет, журнал не пишется (только чтение). Внеочередная попытка — по-прежнему в «Заявках» (`training.manage`).
2. Список: участник, курс, начало, правильных / всего, результат (сдал / не сдал / идёт / время вышло), внеочередная. Новые сверху по `started_at` (решение агента: журнал попыток, а не очередь), страницы по `PAGE_SIZE`, поиск по имени — как в очереди практики.
3. Фильтры: курс, результат (`passed` / `failed` / `running`; `running` = `passed is null`, в т. ч. истёкшие и ещё не закрытые), период — `from` / `to` по `started_at` в днях Еревана (как `posts/list.ts`). Неизвестные значения — игнор.
4. Карточка `/admin/training/attempts/[id]`: участник, курс, начало, окончание (`submitted_at` или `expires_at`), правильных / всего, порог (`pass_count` попытки), результат, внеочередная; вопросы со снимка — текст, варианты в порядке попытки, ответ участника, правильный ответ, отметка верно / неверно / без ответа.
5. Идущая попытка (`passed is null` и `expires_at > now`) — в карточке только «идёт до …», без вопросов и ответов (решение агента: модератор не видит правильные ответы, пока участник сдаёт). Истёкшая, но не закрытая — вопросы, сохранённые ответы и правильные показываются, результат «время вышло, не закрыта» (закроет участник при визите или 9.16); страница ничего не закрывает и не пишет.
6. Лимит в карточке (по настройкам курса, на сейчас): «обычных попыток за последние {attempts_period_days} дн.: N из {attempts_limit}», «внеочередных доступно: {extra_attempts}» (из `course_access`; заявки нет — 0). Счёт — `quiz-rules.ts` (`attemptsLeft` / окно), не новая формула.
7. Неизвестный или не-uuid `id` — 404. Участник удалён мягко — попытка видна (имя как есть).
8. Меню: «Попытки» в группе «Обучение», `training.review`; переводы en / hy / ru.

## Файлы (ожидаемо)

- `src/lib/server/services/training/attempt-list.ts` (+ `attempt-list.test.ts`) — `attemptListOptions`, `attemptFilter`, `listAttempts`, `attemptDetail` (карточка + лимит через `quiz-rules.ts`).
- `src/routes/admin/training/attempts/+page.server.ts`, `+page.svelte` — список (образец — `training/practice/`).
- `src/routes/admin/training/attempts/[id]/+page.server.ts`, `+page.svelte` — карточка.
- `src/lib/server/admin/nav.ts` (+ `nav.test.ts`) — пункт `trainingAttempts`.
- `src/lib/i18n/messages/{en,hy,ru}-training-practice.ts` или новый `*-training-attempts.ts` — тексты `training.attempts.*`, `admin.nav.trainingAttempts`.
- `tests/e2e/admin-access-map.ts`, `tests/e2e/admin-permissions-training.ts` — две страницы `training.review`, попытка в фикстуре и подстановка `[id]`.

## Не ломать

- Правильные ответы не уходят участнику: `quiz-secrets.test.ts` зелёный; в админке ответы — только `training.review`, у идущей попытки — не показываются.
- Editor (только `training.lessons`) и участник — 403 / вход на `/admin/training/attempts` и карточке; карта прав e2e и `rights.test.ts` согласованы.
- Очередь практики и заявки работают как раньше (общие `accessCourses`, меню).
- Страница не меняет попытки (нет `settleExpired`, нет записи в журнал).

## Проверка

- `npx vitest run src/lib/server/services/training/attempt-list.test.ts src/lib/server/admin/nav.test.ts src/lib/server/services/training/quiz-secrets.test.ts`
- `npm run check`, `npm run lint`; e2e `admin-permissions` (training) — только если CI не прогонит (по `sbr.mdc` — CI).

## Риск

`normal` — серверное чтение и страницы админки; право существующее (`training.review`), новых действий, миграций и журнала нет. В REVIEW этапа — общий уровень этапа 9 (`high`).

## Читать

- `05` § 27 «Попытки» (строки 415–417) — выписано выше.
- `04` таблица `training.*` (строки 176–178) — выписано: `training.review` — moderator, admin, «просмотр попыток».
- `02` § 11 `quiz_attempts` (строки 627–645) — выписано: снимок `[{question_id, text, options, correct_index}]`, `answers` по порядку вопросов, `is_extra` вне лимита.
- `zone-notes.md` § «Обучающий портал», 9.6 (`quiz-rules.ts`, `quiz-facts.ts`) и REVIEW (новый вызывающий чтений — только за `requirePermission`).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа 9)

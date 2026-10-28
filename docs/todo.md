# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

9.16 (доделки этапа 9 после REVIEW, решение владельца (9) 2026-10-28 — `decisions.md`): ежедневное закрытие брошенных попыток теста с письмом. Сейчас просроченная попытка закрывается только лениво — `settleExpired` (`quiz-close.ts`) при открытии портала, страницы теста или старте; участник, который не вернулся, письма с результатом не получает, попытка в базе остаётся «идущей» (`zone-notes.md` § «Обучающий портал», 9.6 «Известное»).

Решения (чего нет в документах — помечено «решение агента»):
1. Миграции нет: хватает текущих полей — идущая и просроченная = `quiz_attempts.passed is null and expires_at <= now`.
2. Закрытие — тот же `settleExpired` на каждую пару (курс, участник), без второй реализации: результат по сохранённым ответам (`03` § 18.3 п. 4, решение 9.6 (3)), `submitted_at = expires_at`, письмо с результатом и датой пересдачи после коммита, сданная может завершить курс (`completeCourse`, актор — участник, `ip = null`). Порядок блокировок прежний: заявка → строки попыток; гонка с ленивым закрытием — второй видит `passed is not null` и ничего не делает. Решение владельца «как несданные» читается как «не отправлена участником, попытка потрачена»: по `03` § 18.3 п. 4 результат считается по сохранённым ответам, так же, как при ленивом закрытии (решение агента — иначе итог зависел бы от того, кто закрыл раньше: участник или cron).
3. Кого закрывает (решение агента): только тех, у кого портал открыт участнику (`openPortal`, 9.5) — курс `published`, заявка `approved`, участник `active`, не удалён. Остальные (доступ закрыт, участник заблокирован или удалён, курс снят с публикации) — как сейчас: не закрываются и письма не получают (письмо вело бы на портал, который им закрыт); вернётся доступ — закроет ленивый путь.
4. Сервис `quiz-daily.ts` — `runQuizDaily(db, deps)` → `{ closed, failed }`: выборка пар `distinct (course_id, user_id)` вне транзакции, затем `settleExpired` по каждой (своя транзакция). Ошибка одной пары — `console.error` + `failed + 1`, остальные продолжаются (решение агента: одна битая строка не держит всех). `settleExpired` начинает возвращать число закрытых (вызывающие сейчас результат не читают). Повтор — `{ closed: 0 }`, писем нет.
5. Маршрут `POST /api/cron/training` — как `certificates`: `cronAccess` + `CRON_SECRET`, тонкий, `deps = { send: sendMail, siteUrl: PUBLIC_SITE_URL }`, ответ — JSON сводки; `console.info('training daily: …')`. GET — 405 (только `POST`).
6. `cron.yml`: job `training` в ежедневном расписании (`0 5 * * *`, 09:00 по Еревану), как `certificates`; шапку-комментарий дополнить. Значит, письмо о брошенной попытке приходит в пределах суток. Журнала нет (закрытие попытки не в `03` § 18.6 п. 1 — как у ленивого), кроме `exam.course_complete` при завершении курса — прежний.

## Файлы (ожидаемо)

- `src/lib/server/services/training/quiz-daily.ts` — новый, `runQuizDaily` (~45 строк).
- `src/lib/server/services/training/quiz-close.ts` — `settleExpired` возвращает число закрытых (137 → ~139).
- `src/routes/api/cron/training/+server.ts` — новый маршрут (как `cron/certificates`).
- `.github/workflows/cron.yml` — job `training`, шапка.
- Тесты (RED): новый `quiz-daily.test.ts` — брошенные попытки двух участников в разных курсах закрываются (`passed` по сохранённым ответам, `submitted_at = expires_at`), по письму каждому; сохранены верные ответы — сдана, курс без заданий завершается (экзамен); идущая в срок не тронута; заявка `revoked`, участник `blocked` / удалён, курс `draft` — не тронуты, писем нет; повтор — 0 закрытых и 0 писем. Тест идёт в `inRollback` против общей dev-базы: проверять **свои** строки и письма, счётчик сводки — `≥`. Новый e2e `tests/e2e/cron-training.spec.ts` (как `cron-certificates.spec.ts`): без токена и с чужим — 401, с верным — 200 и `{ closed, failed }`, GET — 405.

## Не ломать

- Ленивое закрытие при открытии портала / страницы теста и старте (`quiz-submit.test.ts` «an attempt left past its time…», `quiz-start.test.ts`).
- Отправка, двойная отправка, завершение курса тестом (`quiz-submit.test.ts`, `course-complete*.test.ts`, `race.test.ts`).
- Остальные cron-задачи: `payments`, `memberships`, `certificates` и их расписание в `cron.yml` (`cron*.spec.ts`, `cron.test.ts`).

## Проверка

- `npx vitest run src/lib/server/services/training/quiz-daily.test.ts src/lib/server/services/training/quiz-submit.test.ts src/lib/server/services/training/quiz-start.test.ts`
- `npx playwright test tests/e2e/cron-training.spec.ts`; `npm run check`, `npm run lint`; остальной e2e — CI.

## Риск

`high` — новый `+server.ts` (доступ по `CRON_SECRET`) и инфраструктура (`.github/workflows/cron.yml`); логика закрытия — прежний `settleExpired`, прав, денег, баллов, миграций не трогает.

## Читать

- `03` § 18.3 п. 2, 4 (попытка потрачена, после срока — по сохранённым ответам), § 18.6 п. 2 (письмо с результатом) — уже прочитано, выписано в решениях 2 и 6.
- `zone-notes.md` § «Обучающий портал» 9.5 (условия портала), 9.6 (`settleExpired`, порядок блокировок), 9.8 (`completeCourse`) — уже прочитано.
- Код: `quiz-close.ts`, `quiz-facts.ts` (`accessOf`), `portal-gate.ts` (условия решения 3), `quiz-test-support.ts`, `quiz-submit.test.ts` (образец), `certificates/daily.ts` + `routes/api/cron/certificates/+server.ts` + `tests/e2e/cron-certificates.spec.ts` (образец крона), `auth/cron.ts`.

## Фазы

- [x] SPEC
- [x] RED `d36430d`
- [x] GREEN

Итог: `runQuizDaily` (`quiz-daily.ts`) — пары с брошенными попытками при открытом портале → `settleExpired` (теперь возвращает число закрытых), ошибка пары — `failed`; `POST /api/cron/training`; job `training` в `cron.yml` (09:00 по Еревану). Тесты сервиса против Neon локально 16–25 с — таймаут 60 с, как в `rights.test.ts`.
- [ ] REVIEW (этапа 9)

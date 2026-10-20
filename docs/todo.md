# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, факты спецификации, чек-лист ревью) — `git show c0779a9:docs/todo.md`; общий REVIEW этапа 3 — `git show 26c7dc5:docs/todo.md` и ссылки в его шапке.

## Задача

4.3 — сервис баллов: начисление по правилу, ручная корректировка, `reversal`, проверка баланса; всё в транзакции с обновлением `users.points_balance`. Миграции нет (схема — 0009, `db/schema/points.ts`). Админка (4.4), кабинет (4.5) и вызовы из сертификатов / регистраций / видео (этапы 5–7) — не в этом шаге.

Факты (`02` § 5, `03` § 6.1–6.3, `04` 5.1, 5 п. 6):
- Начисление — только сервисом: запись в журнал + баланс в одной транзакции (`03` 6.2.1). Повтор за тот же источник — тихий пропуск (6.2.2). Правило выключено или 0 баллов — записи нет (6.2.3). Размер — из правила в момент начисления, пишется в `delta` (6.2.4).
- Ручная корректировка — `reason = manual`, комментарий обязателен, право `points.adjust` (только admin), запись в `audit_log` с IP (6.3.1, 6.3.3; `04` § 6 п. 6).
- Отмена — `reversal` на противоположную сумму со ссылкой `reversal_of_id`, одна запись — один раз (6.3.2), право `points.adjust` (`04`: отмена — admin).
- Баланс не уходит ниже нуля — операция отклоняется (6.3.4; в базе — check `users_points_balance_non_negative`).
- Сервис сам проверяет право по `actor` (`04` § 5 п. 6), как `payments/admin/support.ts`.

Решения шага (документы прямо не говорят — предлагаю так, в отчёте владельцу):
1. Правило → `reason` и `source_type` — фиксированная карта в коде (коды правил фиксированы `02` § 5): `certificate_*` → `certificate` / `certificate`; `event_registration` → `event_registration` / `event_registration`; `event_participation` → `event_participation` / `event_registration`; `event_place_1..3` → `event_place` / `event_registration`; `video_approved` → `video` / `video`. Вызывающий передаёт код правила, `userId`, `sourceId` — `source_type` без `source_id` невозможен.
2. Дубль — `INSERT … ON CONFLICT DO NOTHING` (пустой `returning` = дубль), а не перехват `23505`: транзакция вызывающего не ломается, савепоинт не нужен.
3. Баланс — строка `users` блокируется (`FOR NO KEY UPDATE`), новый баланс считается до записи; < 0 → отказ `insufficient_balance` без записи. Check в базе — страховка.
4. Правило с баллами ≤ 0 — записи нет (`skipped`): правила начисляют, а не списывают; списание — только вручную.
5. Отменить `reversal` нельзя (`not_reversible`); отмена, уводящая баланс в минус (баллы уже потрачены), — отказ `insufficient_balance`.
6. Ручная сумма — целое, ≠ 0, в пределах `integer` Postgres; иначе `invalid`. Пустой комментарий (после `trim`) — `invalid`. Удалённый пользователь — `not_found`; заблокированному корректировать можно.
7. Журнал: `points.adjust` и `points.reverse`, `entityType = 'user'`, `entityId` = пользователь (видно во вкладке «История» карточки), `before` / `after` — баланс, плюс `delta`, `comment`, id записи.
8. Системная отмена по источнику (регистрация отменена до начала, `03` 6.2.6) — на этапе 5, через то же ядро отмены.

## Файлы (ожидаемо)

- `src/lib/server/services/points/ledger.ts` — ядро: `appendEntry(tx, entry)` — блокировка пользователя, проверка баланса, вставка без дубля, обновление баланса
- `src/lib/server/services/points/award.ts` — `awardPoints(tx, { rule, userId, sourceId })` — системное начисление внутри транзакции вызывающего; карта правил
- `src/lib/server/services/points/adjust.ts` — `adjustPoints(db, actor, { userId, delta, comment }, { ip })`
- `src/lib/server/services/points/reverse.ts` — `reverseEntry(db, actor, { entryId, comment }, { ip })`
- `src/lib/server/services/points/support.ts` — право `points.adjust`, комментарий, типы результата (`index.ts` не нужен — у сервиса нет зависимостей от окружения)
- тесты с базой (откат): `award.test.ts`, `adjust.test.ts`, `reverse.test.ts`, обвязка `test-support.ts` (правила меняет под `LOCK TABLE points_rules` — тест seed удаляет все правила разом, иначе возможна взаимная блокировка)

## Не ломать

- Схема 0009 и её тесты (`db/points-schema.test.ts`), seed правил (`seed/points-rules.test.ts`).
- Баланс на обзоре кабинета (`cabinet/overview`) и в карточке пользователя админки — читают `users.points_balance`.
- Журнал действий: существующие записи и `audit-coverage` / `access-coverage` (новых маршрутов нет).

## Проверка

- `npx vitest --run src/lib/server/services/points src/lib/server/db/points-schema.test.ts src/lib/server/seed`
- `npm run check`, `npm run lint`

## Риск

`high` — баллы, журнал действий.

## Читать

- `02` § 5, `03` § 6.1–6.3, `04` 5.1 и § 5 п. 6 — прочитаны в SPEC, факты выше.

## Открытые вопросы (не блокируют шаг)

1. Решения 4–6 выше — подтвердить владельцу (по умолчанию так).
2. Лимит одобренных видео в месяц (`03` 6.2.7) и пороги «подозрительного» (6.4) — ключи `site_settings` (`questions.md`, этап 4) — нужны в 4.4 / этапе 7, не здесь.

## Фазы

- [x] SPEC — `220a72f`
- [x] RED — `9fe7d69` (19 новых, все падали на «not implemented» заглушек)
- [x] GREEN — зона 47/47 с первого прогона (новых 19 + схема + seed), `check` 0, `lint` чистый
- [x] REGRESS — весь Vitest 879/880 (`hero/public` — часы машины, известно)
- [ ] REVIEW — `bugbot` + `security-review`

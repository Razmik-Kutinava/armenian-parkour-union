# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.8 — запросы на волонтёров (`09` п. 10.8; `03` § 19.5 п. 1–3, 6–7, § 19.9; `05` § 28 «Запросы»; `06` § 5.12 «Приглашения»; `04` § 3.1, § 5.1 `volunteer.manage`, § 7): создание черновика, рассылка и досылка, «Пойду» / «Не могу», лимит мест, срок ответа, отмена запроса. Миграции нет (0018 уже есть).

## Файлы (ожидаемо)

- `src/lib/server/services/volunteer/requests-admin.ts` (+ test) — список/карточка, create/update черновика, «Разослать» / «Дослать», правка `places`/`respond_by` после `open`, «Отменить»; audit; письма после коммита
- `src/lib/server/services/volunteer/invite-answer.ts` (+ test) — «Пойду» / «Не могу» владельца: lock строки запроса, лимит `accepted`, срок `respond_by`, действительная книжка
- `src/lib/server/services/volunteer/invite-own.ts` (+ test) — приглашения в кабинете (открытые / прошедшие)
- `src/lib/server/services/volunteer/request-mail.ts` — письмо приглашения и отмены принявшим
- `src/routes/admin/volunteer/requests/*` — список, `/new`, `/{id}`; пункт меню; карты access/audit/permissions
- `src/routes/[[lang=lang]]/(site)/cabinet/volunteer/*` — блок приглашений + actions; i18n `*-volunteer*.ts`

## Решения агента (в пределах документов)

1. Образцы: админка — `partners-admin.ts` / карточки; гонка мест — `registrations` (lock события / запроса первым); письма — `card-mail.ts` после коммита.
2. Кого звать при рассылке: действительная книжка сейчас (`cardValidity` / `card-sql` из 10.3); досылка — только у кого ещё нет строки приглашения, пока `now < respond_by` и статус `open`.
3. «Пойду»: `accepted` ≤ `places` в той же транзакции с `FOR UPDATE` строки запроса; мест нет / срок вышел / книжка недействительна — отказ; «Не могу» при полном наборе — да; передумать до срока — да.
4. Отмена (`cancelled`): все приглашения → `excused`; письмо только принявшим (`03` 19.5 п. 6, 19.9 п. 2). «Завершить» и явка — 10.9.
5. Фоновая `closed_at` (`invited` → `expired` / `excused` при полном наборе) и учёт `decline_streak` — 10.9 (одна операция с п. 19.6). В 10.8 после `respond_by` ответы сервер отклоняет; статусы `invited`/`accepted`/`declined` до подведения не трогаем.
6. Журнал: `volunteer_request.create|update|publish|invite_more|cancel` (entity `volunteer_request`); правка мест/срока — `update`. Ответ участника в audit не пишем.
7. Карточка книжки admin: read-only список приглашений — если влезает без раздувания `card-detail`; иначе отложить (основной UI — `/admin/volunteer/requests/[id]`).

## Не ломать

- Гонка за последнее место (K5): два «Пойду» одновременно — один `accepted`, второй отказ; без превышения `places`.
- Права (K1): модератор / редактор / участник не открывают `/admin/volunteer/requests` и не шлют; чужое приглашение в кабинете — отказ (подмена `id`).
- 10.3–10.7: книжки, PDF, QR, кассир, `markPerk` / `reversePerk`, журнал использований — без регресса.
- Append-only `perk_redemptions` и схема 0018 — без миграций.

## Проверка

- `npx vitest run src/lib/server/services/volunteer/requests-admin.test.ts src/lib/server/services/volunteer/invite-answer.test.ts src/lib/server/services/volunteer/invite-own.test.ts`
- `npm run check`, `npm run lint`

## Риск

`high` — гонка мест (как регистрации), `volunteer.manage`, `audit_log`, письма с персональными данными, чужие приглашения (K1 / K4 / K5).

## Читать

- `03` § 19.5 п. 1–3, 6–7; § 19.9 п. 1–2; § 19.2 (действительность для рассылки и ответа)
- `05` § 28 блок «Запросы»
- `06` § 5.12 «Приглашения»; § 6 ссылка писем → `/cabinet/volunteer`
- `04` § 3.1 (ответ на приглашение), § 5.1 `volunteer.manage`, § 7 строка ответа, § 8 (чужие приглашения)
- `02` § 12 `volunteer_requests`, `volunteer_invitations`
- `zone-notes.md` § «Волонтёрство» (`cardValidity`, `card-sql`); § «Регистрации» — образец lock мест
- образцы: `partners-admin.ts`, `card-mail.ts`, `registrations` (lock + race)

## Фазы

- [x] SPEC
- [x] RED `9d04cd3`
- [x] GREEN
- [ ] REVIEW (этапа)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.11 — тесты безопасности и гонок волонтёрства: подмена токена/`id`, кнопка «Отметить» без доступа и при отключённом, одновременные отметки разовой плюшки, гонка за последнее место, права (`09` п. 10.11; `04` § 8; `03` § 19.4 п. 3–4, § 19.5 п. 3). Миграции нет.

## Файлы (ожидаемо)

- `src/lib/server/services/volunteer/race-support.ts` — сессии как `registrations/race-support` / `shop/race-support`: коммит в тест-БД, уборка книжек/отметок/приглашений
- `src/lib/server/services/volunteer/perk-mark-race.test.ts` — два кассира / две сессии бьются за последнюю отметку `single` (лимит 1) → ровно одна запись
- `src/lib/server/services/volunteer/invite-answer-race.test.ts` — два «Пойду» на последнее место → один `accepted`, второй `full`
- `src/lib/server/services/volunteer/perk-mark.test.ts` — добить: подмена токена книжки / `perkId`; отключённый кассир → `cashier_gone` (если ещё нет)
- `tests/e2e/volunteer-cashier.spec.ts` — уже: гость без cookie без кнопки; при дыре — отключённый доступ без «Նշել» / отказ POST
- права: уже `tests/e2e/admin-permissions-volunteer.ts` + карты access/audit — не ломать; Vitest подмены `invitationId` / `reportId` уже в `invite-answer` / `report-*`

## Решения агента (в пределах документов)

1. Гонки коммитят (как регистрации/магазин/практика): `race()` держит lock, пока второй ждёт; уборка по id, ledger/audit не трогать.
2. Разовая: `usesLimit: 1`, два разных кассира того же партнёра (не idempotency 1 мин одного телефона) — один `ok`, второй `no_uses_left`.
3. Последнее место: `places: 1`, два приглашённых, параллельный `accepted` — один `ok`, второй `full`.
4. Подмена: чужой/битый `public_token`, чужой `perkId`/`partnerId`, чужой `invitationId`/`reportId` — отказ без побочных записей.
5. Без cookie / отключённый: UI без «Отметить»; сервис `markPerk` при `disabled_at` → `cashier_gone`.
6. Права admin-only `volunteer.manage` — покрыты e2e этапа; в 10.11 не расширять матрицу, только убедиться что сценарии из `04` § 8 зелёные в зоне задачи.

## Не ломать

- Права (K1): модератор/редактор/участник не открывают `/admin/volunteer/*`; чужие invite/report id в кабинете — отказ.
- Отметки: идемпотентность 1 мин того же кассира; append-only `perk_redemptions`; отмена — только `reversePerk`.
- Гонки регистраций/магазина/практики: общий `race-support` регистраций не ломать; волонтёрский — свой или тонкая обёртка.
- 10.1–10.10 сценарии и схема 0018 без миграций.

## Проверка

- `npx vitest run src/lib/server/services/volunteer/perk-mark.test.ts src/lib/server/services/volunteer/perk-mark-race.test.ts src/lib/server/services/volunteer/invite-answer-race.test.ts`
- `npm run check`, `npm run lint`

## Риск

`high` — права (K1), гонки отметок и мест (K5), cookie кассира / отключение доступа.

## Читать

- `03` § 19.4 п. 3–4; § 19.5 п. 3
- `04` § 8 (минимум тестов волонтёрства); § 3.1–3.2 (кассир / admin-only)
- `zone-notes.md` § «Волонтёрство» (mark, invite-answer, locks)
- образцы гонок: `registrations/race.test.ts`, `registrations/race-support.ts`, `shop/race-cancel.test.ts`, `training/practice-review-race.test.ts`

## Фазы

- [x] SPEC
- [x] RED `3f611b2`
- [x] GREEN `12414b2`
- [ ] REVIEW (этапа)

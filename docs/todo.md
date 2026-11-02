# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.7 — учёт использований плюшек (`09` п. 10.7; `03` § 19.4 п. 5, § 19.9 п. 1; `05` § 28 «Использования» + карточка книжки; `06` § 5.12 «Мои использования»; `04` § 3.2, § 5.1 `volunteer.manage`): история в кабинете; журнал и сводка по партнёрам в админке; отмена обратной записью (`perk_redemptions`); экспорт CSV. Миграции нет (0018 уже есть).

## Файлы (ожидаемо)

- `src/lib/server/services/volunteer/perk-reverse.ts` (+ test) — admin-отмена: lock книжки, insert с `reversal_of_id` / `comment` / `created_by`, без `cashier_id`; журнал `perk_redemption.reverse`; один раз
- `src/lib/server/services/volunteer/redemptions-admin.ts` (+ test) — список, фильтры, сводка по партнёрам за период, CSV
- `src/lib/server/services/volunteer/card-own.ts` (+ test, `PerksBlock` / кабинет) — «Мои использования» владельца (дата, партнёр, плюшка, пометка «отменено»)
- `src/routes/admin/volunteer/redemptions/*` — журнал, сводка, «Отменить», CSV; пункт меню; карты access/audit/permissions
- `src/lib/server/services/volunteer/card-detail.ts` (+ страница карточки) — блок использований книжки
- `src/lib/i18n/messages/*-volunteer*.ts` — кабинет и админка (en / ru / hy)

## Решения агента (в пределах документов)

1. Образец отмены — `points/reverse.ts`; образец журнала/CSV — `points/admin-list.ts` + `admin-export`; кабинет — как `cabinet/points` (своё по сессии).
2. «Отменить» только у строки-отметки (`cashier_id` не null, `reversal_of_id` null) без существующей обратной; комментарий обязателен (`03` 19.4 п. 5). Повтор / отмена обратной → отказ.
3. Сводка (`05` § 28): за период — отметок по каждой плюшке и уникальных книжек; отменённые в счёт не входят (как `uses30Days` в `partner-list.ts`).
4. Журнал аудита: `perk_redemption.reverse`, `entity_type = 'volunteer_card'`; id отметки / обратной — в after; отметка кассира в audit не дублируется (`03` 19.9 п. 1).
5. Кабинет показывает все использования своей книжки (и после недействительности — `03` 19.2 п. 3); чужие id не принимаются.
6. Карточка книжки — тот же список использований (read-only + ссылка/действие «Отменить» через журнал или прямо, если удобнее на карточке — основной UI отмены на `/admin/volunteer/redemptions`).

## Не ломать

- Append-only `perk_redemptions` (K5): UPDATE/DELETE нет; отмена — только insert; unique `reversal_of_id`.
- Права (K1): модератор / редактор / участник не открывают журнал и не отменяют; кассир не отменяет.
- Остаток разовой после отмены возвращается (`03` 19.4 п. 5) — `visiblePartners` / `markPerk` считают через net redemptions.
- 10.4–10.6: PDF, страница проверки, cookie кассира, `markPerk` без регресса.

## Проверка

- `npx vitest run src/lib/server/services/volunteer/perk-reverse.test.ts src/lib/server/services/volunteer/redemptions-admin.test.ts src/lib/server/services/volunteer/card-own.test.ts`
- `npm run check`, `npm run lint`

## Риск

`high` — обратная запись и остаток разовых (как баллы), `volunteer.manage`, `audit_log`, персональные данные в журнале (K1 / K4 / K5).

## Читать

- `03` § 19.2 п. 3, § 19.4 п. 5, § 19.9 п. 1
- `05` § 28 (карточка книжки — использования; блок «Использования»)
- `06` § 5.12 («Мои использования»)
- `04` § 3.2 (журнал / обратная запись), § 5.1 `volunteer.manage`
- `02` § 12 `perk_redemptions`
- `zone-notes.md` § «Волонтёрство» (append-only, `markPerk`, отмена — 10.7)
- образцы: `points/reverse.ts`, `points/admin-list.ts`, `cabinet/points.ts`, `partner-list.ts` (uses30Days)

## Фазы

- [x] SPEC
- [x] RED `1e5cbdc`
- [x] GREEN
- [ ] REVIEW (этапа)

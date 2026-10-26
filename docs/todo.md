# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

Этап 8, доработка 5.10 (решение владельца 2026-10-26, `questions.md` этап 5): допуск при переводе из очереди. Сейчас `fillFromWaitlist` и «Дать место» сотрудником условия допуска заново не проверяют — место может получить несовершеннолетний, чьё согласие истекло, пока он ждал, заблокированный или с закончившимся членством (против `03` § 15).

Решения (агент):
1. Проверка — те же условия участника, что у ручного добавления (`checkStaffAdmission`: статус, email, членство, категория, дата рождения, согласие до 18, возраст категории; без окна регистрации — человек уже в очереди). Удалённый аккаунт — не допускается.
2. Автоматический перевод: не прошедший пропускается, его строка остаётся `waitlist` (место в очереди сохраняется, как сейчас у полной категории); письма ему нет; место уходит следующему допущенному.
3. «Дать место» сотрудником: отказ с причиной (`parental_consent`, `no_membership`, `blocked`…) — сообщения в админке уже есть (`outcome.ts`); ничего не меняется, журнала нет.
4. Данные — `readMember` + `readAdmission(…, lock = false)` (строка регистрации уже заблокирована вызывающим).

## Файлы (ожидаемо)

- `src/lib/server/services/registrations/waitlist-admission.ts` — новое: `promotionRefusal(tx, event, row, now)` → `Refusal | 'deleted' | null`
- `src/lib/server/services/registrations/waitlist.ts` — пропуск не прошедших
- `src/lib/server/services/registrations/staff/promote.ts` — отказ с причиной, `PromoteResult` + `Refusal`
- `src/lib/server/services/registrations/waitlist.test.ts`, `staff/promote.test.ts` — тесты

## Не ломать

- Перевод из очереди: первый допущенный получает место, письмо на его языке; платное — `offer_hours`; полная категория пропускается (тесты `waitlist.test`).
- «Дать место» сотрудником: только на свободное место, журнал `registration.promote` (тесты `promote.test`).
- Отмена участником / сотрудником, снятие удержания, возврат оплаты — все зовут `fillFromWaitlist`.

## Проверка

- `npx vitest --run src/lib/server/services/registrations/waitlist.test.ts src/lib/server/services/registrations/staff/promote.test.ts src/lib/server/services/registrations/release.test.ts src/lib/server/services/registrations/cancel.test.ts`

## Риск

high (допуск несовершеннолетних, `03` § 13, 15)

## Читать

- `03` § 7 п. 2–3 (прочитано: условия допуска; первый из очереди — автоматически), § 13 п. 2, § 15 («несовершеннолетнего без одобренного согласия — никогда»)

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

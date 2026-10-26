# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

Этап 8, доработка 5.9 (решение владельца 2026-10-26, `questions.md` этап 5): три письма участнику — ручное добавление сотрудником, отмена регистрации сотрудником, снятие места из-за неоплаты (истёк `hold_until`).

Решения (агент):
1. Ручное добавление — то же письмо «Вы зарегистрированы» (`registeredLetter`, ссылка на «Мои события»), после коммита. Отказ — без письма.
2. Отмена сотрудником — новое письмо «Регистрация отменена» (любой отменённый статус: место, ожидание оплаты, очередь). Причину сотрудника не пишем (как у отмены события: внутренний комментарий). Оплаченному (`registered` с платежом) — та же строка о возврате, что у отмены события. Ссылка — «Мои события».
3. Неоплата — новое письмо «Время на оплату вышло»: регистрация отменена, место ушло следующему; ссылка — страница события (можно записаться снова, если места есть). Удержание, оставленное сверке (платёж `pending`), — без письма.
4. Письмо не ушло — только `console.warn`, изменение остаётся (`sendLetters`).

## Файлы (ожидаемо)

- `src/lib/server/services/registrations/mail.ts` — `staffCancelledLetter`, `holdExpiredLetter`
- `src/lib/server/services/registrations/staff/add.ts` — `mail?: LetterDeps`, письмо после коммита; `staff/index.ts` — `addNow`; маршрут `src/routes/admin/registrations/[id]/+page.server.ts` — `addNow`
- `src/lib/server/services/registrations/staff/cancel.ts` — письмо отменённому
- `src/lib/server/services/registrations/release.ts` — письмо снятому
- `src/lib/i18n/messages/{en,ru,hy}-registrations.ts` — тексты
- Тесты: `letters-staff.test.ts` (новый)

## Не ломать

- Ручное добавление: условия допуска, `full`, журнал `registration.add` (`staff/add.test`, `points-staff.test`).
- Отмена сотрудником: очередь получает место и письмо, платёж — «проверить» (`staff/cancel.test`).
- Снятие удержания: платёж у провайдера — не трогаем; первый в очереди — письмо о месте (`release.test`, `acceptance-event.test`).

## Проверка

- `npx vitest --run src/lib/server/services/registrations/letters-staff.test.ts src/lib/server/services/registrations/staff/add.test.ts src/lib/server/services/registrations/staff/cancel.test.ts src/lib/server/services/registrations/release.test.ts`

## Риск

normal (письма; права и данные не меняются)

## Читать

- `questions.md` этап 5 (прочитано: добавить все три письма)
- `zone-notes.md` § «Регистрации и события», 5.9 (прочитано: `eventLetter`, письма после коммита)

## Фазы

- [x] SPEC
- [x] RED `ab67953`
- [x] GREEN — Vitest задачи + `add`, `cancel`, `release`, `acceptance-event`, `points-staff`, `translate` 30/30; check 0, eslint и prettier чистые. Старые проверки точного списка адресатов (`staff/cancel`, `release`, `acceptance-event`) — плюс письмо самому участнику; в `release` и `acceptance-event` — только свои адреса (в `parkour_dev` есть чужие просроченные удержания от гонок)
- [ ] REVIEW (этапа)

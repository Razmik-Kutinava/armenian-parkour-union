# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы (REVIEW — общим шагом в конце этапа 5) — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`.

## Задача

5.7 — админка регистраций (`05` § 5). Делится на три шага (решение владельца 2026-10-23: разбить, REVIEW — общим шагом в конце этапа 5):

- **5.7a (текущий)** — защита и отмена события: понятный отказ при удалении категории и события с регистрациями; отмена события админом отменяет активные регистрации, снимает баллы за регистрацию, разбирает платежи.
- **5.7b** — вкладка «Регистрации» (`registrations.read` / `registrations.manage`): список с фильтрами (статус, категория, оплачено), перевести из очереди, отменить регистрацию, добавить участника вручную (без баллов за регистрацию), экспорт CSV; редактор — только число.
- **5.7c** — «День события» (телефон: поиск, «пришёл» / «не пришёл» одним нажатием) и «Результаты» (место, оценка таблицей, «Завершить событие»); `awardEventResult` при «пришёл» и месте.

Решения агента 5.7a (в рамках `03` § 6.2 п. 6, § 7 п. 8, `05` § 5 «Правила»):
- **Категория с регистрациями** (любой статус — строка ссылается внешним ключом) — `deleteEventCategory` → `'in_use'`, категория и журнал без изменений; в админке — сообщение у категории вместо 500.
- **Событие с регистрациями** (любая строка) — `deleteEvent` → `'has_registrations'`: «удалить нельзя, только отменить»; в админке — сообщение.
- **Отмена события** (`cancelEvent`, admin): в той же транзакции все `registered` / `pending_payment` / `waitlist` → `cancelled` (`hold_until` пусто); у бывших `registered` — `takeBackRegistration` (до начала — обратная запись, после — ничего). `attended` / `no_show` не трогаются. Очередь не двигается (событие уже `cancelled`). В журнал `event.cancel` — число отменённых регистраций. После коммита платежи участия: `pending` → `cancelled` (`failure_reason = event_cancelled`), `paid` → «проверить» (`event_fee.review`, причина `event_cancelled`) — возврат решает админ (`03` 7.8). Письма участникам — 5.9.

## Файлы (ожидаемо)

- `src/lib/server/services/events/categories.ts`, `lifecycle.ts` — отказы, отмена
- `src/lib/server/services/registrations/event-cancel.ts` (новый) — отмена регистраций события; `settle-cancel.ts`, `fee-review.ts` — причина `event_cancelled`
- `src/routes/admin/events/[id]/+page.server.ts`, `categories.ts`, `+page.svelte`, `EventCategories.svelte` — сообщения
- `src/lib/i18n/messages/{en,hy,ru}-events.ts`
- тесты: `services/events/registrations-guard.test.ts`, `services/registrations/event-cancel.test.ts`, `services/registrations/points-event-cancel.test.ts` (правила — проект `server-points`)

## Не ломать

- Отмена участником и платежи участия 5.3–5.6 (`registrations/*.test.ts`, `payments/acceptance-event.test.ts`).
- Действия событий 2.5 (`events/edit.test.ts`, `categories.test.ts`): статусы, журнал, права (`events.cancel` — только admin).
- Порядок блокировок: событие → регистрации → пользователь (`appendEntry`); платёж — своей транзакцией после коммита.

## Проверка

- `npx vitest --run src/lib/server/services/events src/lib/server/services/registrations src/lib/server/services/payments`
- `npm run check`, `npm run lint`; REGRESS — весь Vitest, e2e `events`

## Риск

`high` (баллы, платежи) — REVIEW в конце этапа 5.

## Читать

`03` § 6.2, 7 · `04` § 3, 5.1 · `05` § 5 · сервис регистраций 5.3–5.6

## Фазы 5.7a

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REGRESS
- [ ] REVIEW — общим шагом в конце этапа 5

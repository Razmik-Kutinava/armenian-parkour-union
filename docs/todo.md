# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`; 6.7c админка тренеров и судей (решения и «для REVIEW») — `git show ba7fd1a:docs/todo.md`; 6.8 кабинет `/cabinet/progress` (решения и «для REVIEW») — `git show 9b82a38:docs/todo.md`; 6.9 ежедневная задача сертификатов (решения, миграция 0013, «для REVIEW») — `git show f3ffcb4:docs/todo.md`; 6.10 тесты этапа 6 (охрана `users.level`, гонки) — `git show 2e15b67:docs/todo.md`; 7.1 таблица `videos`, форма в кабинете (решения, миграция 0014, «для REVIEW») — `git show 1dddb1d:docs/todo.md`; 7.2 модерация видео, настройки видео (решения, «для REVIEW») — `git show 55fee41:docs/todo.md`; 7.3 таблицы магазина (решения, миграция 0015, «для REVIEW») — `git show b8dc376:docs/todo.md`; 7.4 админка товаров и заказов (решения, «для REVIEW») — `git show e58c3bd:docs/todo.md`; 7.5 витрина и кнопка заказа (решения) — `git show 2a2a362:docs/todo.md`; 7.6 заказ одной транзакцией, отмена в админке (решения, «для REVIEW») — `git show ccc2a1c:docs/todo.md`.

## Задача

**7.7** (`09` этап 7): кабинет — видеоистория `/cabinet/videos` (причина отказа, пометка баллов, удаление до одобрения) и заказы `/cabinet/orders` (список, карточка, отмена участником). Миграции нет.

Граница: гонки «последний товар», двойной возврат, повторное одобрение видео — 7.8.

Факты из документов:
- `06` § 5.7: список видео со статусом (на проверке, одобрено, отклонено с причиной) и пометкой начисленных баллов; удалить можно, пока не одобрено. Решение 2026-10-24: удаление жёсткое (без `deleted_at`); лимит в месяц удалённые не считает.
- `06` § 5.8: список — номер, состав, сумма, статус, дата; карточка — данные доставки, трек-заметка; «Отменить», пока не отправлен. `03` § 9 п. 5: отмена — возврат записью `shop_refund`, остаток восстанавливается.
- `04` § 3.1 / 5.3: участник видит только своё, id — из сессии; чужое — 404. `04` § 3.2: отмена заказа сотрудником — только admin (`shop.orders_cancel`).
- **Вопрос 108 решён владельцем 2026-10-25:** участник сам отменяет только заказ в статусе `new`; после `confirmed` — только admin.

## Решения (агент; по документам и образцам 5.8 / 7.6)

1. **Пометка баллов видео** — сумма `delta` записей `points_ledger` участника с `source_type = 'video'`, `source_id` = id видео (обратная запись 4.4 копирует источник — после отмены сумма 0). Нет записей — пометки нет. Скрытое (`hidden_at`) участнику показывается как «Одобрено» (в `06` § 5.7 статуса «скрыто» нет).
2. **Удаление видео** — `deleteOwnVideo(db, userId, id)` (`services/videos/own.ts`): блокировка строки, только своё и `pending` / `rejected`; одобренное → `not_allowed`, чужое / нет / кривой id → `not_found`. Журнала действий нет (баллов у таких видео нет; как добавление 7.1). Гонка с одобрением — обе стороны блокируют строку видео: одобрение после удаления видео не находит (пропуск).
3. **Список заказов** — `listOwnOrders(db, userId)` (`services/cabinet/orders.ts`), новые сверху, до 100 (как платежи 5.x), позиции — `linesOf` из `order-list.ts` (экспортировать). Карточка — `getOwnOrder(db, userId, id)`: чужой → `null` → 404. Без имени участника и email.
4. **Отмена участником** — `cancelOwnOrder(db, userId, id, deps)` (`order-cancel.ts`, общая часть с `cancelOrder`): чужой → `not_found`; не `new` → `bad_status`. Возврат = −`delta` списания, `shop_refund` **без автора** (`created_by = null`, как списание — не попадает в фильтр «ручные»). Остаток назад. Журнал `shop_order.cancel` с `actor_id` = участник (баллы — опасное действие, `main.mdc` арх. 4). Письмо «отменён» — как у админа. Маршрут — `cancelOwnOrderNow` (`orders-now.ts`): почта + `publicCache.invalidate(['shop'])` (отмена не из админки — хук кеш не сбросит).
5. **Страницы** — `/cabinet/orders` (список: номер-ссылка, состав с вариантами, сумма, статус, дата), `/cabinet/orders/[id]` (позиции, доставка, трек-заметка, кнопка «Отменить заказ» при `new` → `?/cancel`, после — сообщение и статус «Отменён»). Пункт меню «Заказы» после «Видео». Экран «заказ оформлен» 7.6 оставляем (ссылка «Мои заказы» теперь живая).
6. **Видео в кабинете** — `?/delete` (поле `id`) на `/cabinet/videos`; у `pending` / `rejected` кнопка «Удалить», у отклонённого — причина, у одобренного с баллами — «+N баллов».

## Файлы (ожидаемо)

- `src/lib/server/services/videos/own.ts` (+ новый `own.test.ts`).
- `src/lib/server/services/cabinet/orders.ts` (+ `orders.test.ts`); `services/shop/order-list.ts` (экспорт `linesOf`).
- `src/lib/server/services/shop/order-cancel.ts` (+ новый `order-cancel-own.test.ts` → `ORDER_TESTS` в `vite.config.ts`), `orders-now.ts`.
- `src/routes/[[lang=lang]]/(site)/cabinet/videos/` — `+page.server.ts`, `+page.svelte`, `OwnVideoList.svelte`.
- `src/routes/[[lang=lang]]/(site)/cabinet/orders/` — `+page.server.ts`, `+page.svelte`, `[id]/+page.server.ts`, `[id]/+page.svelte`, `OrderLines.svelte`; `cabinet/+layout.svelte` (меню).
- `src/lib/i18n/messages/{en,hy,ru}-cabinet-videos.ts`, новые `{en,hy,ru}-cabinet-orders.ts` (+ `en.ts`, `hy.ts`, `ru.ts`).
- `tests/e2e/cabinet-videos.spec.ts`, новый `tests/e2e/cabinet-orders.spec.ts`.

## Не ломать

- Баланс ≥ 0, журнал баллов только через `appendEntry`; возврат — один раз на заказ (`points_ledger_source_once_key`); отмена участником `confirmed` / `shipped` / чужого заказа ничего не пишет.
- Отмена админом 7.6 (`new` / `confirmed`, автор возврата — админ) и смена статуса 7.4 работают как раньше.
- Добавление видео 7.1 (лимит, дубль, членство) и модерация 7.2; одобренное видео не удаляется.
- Участник не видит чужие видео и заказы (404).

## Проверка

- `npx vitest run src/lib/server/services/videos/own.test.ts src/lib/server/services/cabinet/orders.test.ts src/lib/server/services/shop` → PASS.
- `npx playwright test tests/e2e/cabinet-videos.spec.ts tests/e2e/cabinet-orders.spec.ts tests/e2e/shop-order.spec.ts` → PASS; `npm run check`, `npm run lint`.

## Риск

`high` — баллы (возврат при отмене участником), права (только своё).

## Читать

- `06` § 5.7, 5.8; `03` § 8, § 9 п. 5; `04` § 3.1–3.2 (выписано).
- `zone-notes.md` § «Видео и магазин», § «Кабинет» (прочитаны).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

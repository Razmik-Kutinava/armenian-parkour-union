# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`; 6.7c админка тренеров и судей (решения и «для REVIEW») — `git show ba7fd1a:docs/todo.md`; 6.8 кабинет `/cabinet/progress` (решения и «для REVIEW») — `git show 9b82a38:docs/todo.md`; 6.9 ежедневная задача сертификатов (решения, миграция 0013, «для REVIEW») — `git show f3ffcb4:docs/todo.md`; 6.10 тесты этапа 6 (охрана `users.level`, гонки) — `git show 2e15b67:docs/todo.md`; 7.1 таблица `videos`, форма в кабинете (решения, миграция 0014, «для REVIEW») — `git show 1dddb1d:docs/todo.md`; 7.2 модерация видео, настройки видео (решения, «для REVIEW») — `git show 55fee41:docs/todo.md`; 7.3 таблицы магазина (решения, миграция 0015, «для REVIEW») — `git show b8dc376:docs/todo.md`; 7.4 админка товаров и заказов (решения, «для REVIEW») — `git show e58c3bd:docs/todo.md`; 7.5 витрина и кнопка заказа (решения) — `git show 2a2a362:docs/todo.md`.

## Задача

**7.6** (`09` этап 7): сервис заказа одной транзакцией — проверка баланса и остатка, списание баллов, `stock`, снимок цены; отмена с возвратом. Страница оформления `/shop/{slug}/order` (форма доставки → подтверждение), кнопка отмены в `/admin/orders/{id}` (admin). Миграции нет.

Граница: кабинет заказов `/cabinet/orders` — 7.7; гонки «последний товар» и повтор возврата двумя сессиями — 7.8.

Факты из документов:
- `03` § 9 п. 3: одна транзакция — пользователь активен, email подтверждён, хватает баллов и остатка; списание записью `shop_order`; `stock` − 1; `price_points_snapshot`. П. 5: отмена (пока не `shipped`) — возврат записью `shop_refund`, остаток восстанавливается. П. 6: смена цены на старые заказы не влияет.
- `06` § 4.7: «Заказать за N баллов» → форма доставки (получатель, телефон, город, адрес, комментарий), экран подтверждения, затем `/cabinet/orders`.
- `05` § 15: «отменить заказ (admin, возврат баллов и остатка)»; модератор отменить не может (`04` § 3.2, право `shop.orders_cancel`). `03` § 14: письмо «статус заказа» после коммита, ошибка письма не ломает операцию.
- 7.3 (`zone-notes`): номер `ORD-{год по Еревану}-{0001}` как `certificates/number.ts` (advisory lock, max за год); `source_type = 'shop_order'`, `source_id` = id заказа у обеих записей; `ledger_id` — id списания.

## Решения (агент; по документам и образцам 5.3 / 4.4 / 6.3)

1. **Состав** — один товар, количество 1 (корзины в документах нет); `total_points` = цена на момент заказа.
2. **Сервис** `placeOrder(db, userId, input, deps)` (`services/shop/checkout.ts`). Порядок блокировок — **пользователь, затем товар** (у отмены: заказ → пользователь → товары; цикла нет). Проверки в порядке кнопки 7.5: нет пользователя / удалён → `not_found`; не `active` → `not_allowed`; товар не в продаже → `not_found`; `stock = 0` → `out_of_stock`; email → `email_unverified`; варианты → `options_invalid`; баланс < цены → `short {missing}`. Затем номер, заказ, списание через `appendEntry` (не `ok` — исключение, откат всего), `ledger_id`, позиция со снимком цены и вариантами (`null` без вариантов), `stock − 1` (кроме `null`).
3. **Варианты** — ровно названия из `shop_items.options`, значение — из списка; лишнее имя или пустое — `options_invalid`.
4. **Двойная отправка** — id заказа выдаёт сервер на шаге подтверждения (скрытое поле `orderId`); повтор того же `orderId` тем же участником (под блокировкой его строки) возвращает уже созданный заказ (`repeated: true`), без второго списания; чужой `orderId` → `not_found`.
5. **Журнал действий** — у заказа участника нет (как регистрация 5.3 и видео 7.1): след — запись `points_ledger`. У отмены — `shop_order.cancel` (before `{status}`, after `{status, number, refund, entryId}`).
6. **Письма** — `orderStatusLetter` после коммита: при заказе — статус `new`, при отмене — `cancelled`; удалённому — нет.
7. **Кеш** — после успешного заказа `publicCache.invalidate(['shop'])` (обёртка `checkout-now.ts`); отмена в админке — уже группа `orders → shop` в хуке.
8. **Отмена** `cancelOrder(db, actor, id, deps)` (`services/shop/order-cancel.ts`): право `shop.orders_cancel`; только `new` / `confirmed`, иначе `bad_status`. Возврат = −`delta` записи `ledger_id` (`shop_refund`, `created_by` = админ); нет `ledger_id` — возврат 0; участник удалён (`appendEntry` → `no_user`) — без возврата, заказ всё равно отменяется. Остаток: `stock + quantity` для товаров с лимитом (архив и удалённые — тоже).
9. **Страница** `/shop/{slug}/order` — вход обязателен (`requireUser`, возврат с вариантами); кнопка 7.5 повторяется live: не `can_order` — сообщение и ссылка на товар, без формы. Действия: `?/review` (форма: варианты + доставка → экран подтверждения с суммой и остатком баланса), `?/place` (создание) → экран «Заказ ORD-… оформлен» со ссылкой на `/cabinet/orders` (страница — 7.7). Поля вариантов в POST — `option.{название}` (не путаются с полями доставки), в GET с товара — как есть (`?Size=M`).
10. **Форма доставки** (`validation/shop-order.ts`): получатель 1–100, телефон — `phone` из `auth.ts`, город 1–100, адрес 1–300, комментарий ≤ 1000 (пусто → `null`).

## Файлы (ожидаемо)

- `src/lib/server/services/shop/order-number.ts`, `checkout.ts` (+ `checkout.test.ts`), `checkout-now.ts`.
- `src/lib/server/services/shop/order-cancel.ts` (+ `order-cancel.test.ts`), `orders-now.ts` (обёртка отмены).
- `src/lib/validation/shop-order.ts` (+ `shop-order.test.ts`).
- `src/routes/[[lang=lang]]/(site)/shop/[slug]/order/` — `+page.server.ts`, `+page.svelte`, `DeliveryForm.svelte`, `OrderConfirm.svelte`.
- `src/routes/admin/orders/[id]/` — `+page.server.ts`, `+page.svelte` (кнопка отмены).
- `src/lib/i18n/messages/{en,hy,ru}-shop.ts`, `{en,hy,ru}-shop-admin.ts`.
- `tests/e2e/admin-audit-map.ts`, `admin-access-map.ts`, `admin-audit-shop.ts`; `tests/e2e/shop-order.spec.ts`.

## Не ломать

- Баланс ≥ 0 и журнал баллов только через `appendEntry`; списание и возврат — один раз на заказ (`points_ledger_source_once_key`).
- Неудачный заказ (нет остатка, баллов, вариантов) ничего не пишет: ни заказа, ни записи журнала, ни `stock`.
- Модератор не отменяет (403 / `not_allowed`); `shipped` / `delivered` / `cancelled` не отменяются; статус вперёд и заметка 7.4 работают как раньше.
- Витрина 7.5: кнопка и каталог (`shop.spec.ts`).

## Проверка

- `npx vitest run src/lib/server/services/shop src/lib/validation/shop-order.test.ts src/routes/admin/access-coverage.test.ts src/routes/admin/audit-coverage.test.ts` → PASS.
- `npx playwright test tests/e2e/shop-order.spec.ts tests/e2e/shop.spec.ts` → PASS; `npm run check`, `npm run lint`.

## Риск

`high` — баллы (списание и возврат), права на отмену.

## Читать

- `03` § 9, § 14; `05` § 15; `06` § 4.7 (выписано).
- `zone-notes.md` § «Видео и магазин», § «Баллы» (прочитаны).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`; 6.7c админка тренеров и судей (решения и «для REVIEW») — `git show ba7fd1a:docs/todo.md`; 6.8 кабинет `/cabinet/progress` (решения и «для REVIEW») — `git show 9b82a38:docs/todo.md`; 6.9 ежедневная задача сертификатов (решения, миграция 0013, «для REVIEW») — `git show f3ffcb4:docs/todo.md`; 6.10 тесты этапа 6 (охрана `users.level`, гонки) — `git show 2e15b67:docs/todo.md`; 7.1 таблица `videos`, форма в кабинете (решения, миграция 0014, «для REVIEW») — `git show 1dddb1d:docs/todo.md`; 7.2 модерация видео, настройки видео (решения, «для REVIEW») — `git show 55fee41:docs/todo.md`.

## Задача

**7.3** (`09` этап 7): таблицы `shop_items`, `shop_order_items`, `shop_orders`.

Граница: только схема, миграция 0015, откат и тест схемы. Админка товаров и заказов — 7.4; каталог — 7.5; сервис заказа (транзакция, списание, остаток, отмена, генерация номера) — 7.6; кабинет — 7.7; гонки — 7.8.

Факты из документов:
- `02` § 7: `shop_items` — `slug` unique, `title` / `description` jsonb, `image_keys` jsonb (массив ключей), `price_points` int not null check > 0, `options` jsonb null (`{"size": ["S","M","L"]}`), `stock` int null check ≥ 0 (`null` — без ограничения), `status content_status` default `draft`, `sort_order` default 0, `deleted_at`, `created_at` / `updated_at`. `shop_orders` — `user_id` FK, `status order_status` default `new`, `total_points` int not null, `ledger_id` FK `points_ledger` null (списание), `recipient_name` / `phone` / `city` / `address`, `comment`, `tracking_note`, `created_at` / `updated_at`; индексы `user_id`, `status`. `shop_order_items` — `order_id` FK on delete cascade, `item_id` FK, `selected_options` jsonb null, `quantity` check > 0, `price_points_snapshot` int.
- `02` enum: `order_status` = `new | confirmed | shipped | delivered | cancelled` (в базе ещё нет); `points_reason` уже содержит `shop_order`, `shop_refund`.
- `03` § 9: виден `published` и не удалённый, недоступен при `stock = 0`; только баллы; заказ — одна транзакция (активен, email подтверждён, баланс, остаток → запись `shop_order` → `stock` → снимок цены); отмена до `shipped` — `shop_refund` и остаток; смена цены старые заказы не трогает.
- `05` § 15, § 26 п. 4: колонка «номер» — человекочитаемого номера в `02` нет; `questions.md` — «предложено: `APU-2026-0001`». Номера сертификатов уже `APU-{год}-{0001}` (`services/certificates/number.ts`: advisory lock + max за год, unique — последняя защита).
- Код: `points_ledger_source_once_key` — unique(`user_id`, `reason`, `source_type`, `source_id`) для всех причин, кроме `manual` / `reversal`: одно списание и один возврат на заказ база уже держит, если `source_id` = id заказа.

## Решения (агент, по `02` и образцам 0012–0014; в `questions.md` — «предложено»)

1. **Номер заказа:** `shop_orders.number text not null unique` (как `certificates.number`); значение даёт сервис 7.6 тем же способом, что сертификаты (advisory lock, следующий за год по Еревану, не переиспользуется — отменённые заказы остаются). Формат — **вопрос владельцу**: `APU-2026-0001` (предложено ранее, совпадает по виду с номером сертификата) или отдельный префикс, например `ORD-2026-0001`. На схему формат не влияет.
2. **NOT NULL** сверх `02` (как 2.5 / 6.1): `shop_items.title`, `description` (default `{}`), `image_keys` (default `[]`), `status`, `sort_order`; `shop_orders.user_id`, `status`, `recipient_name`, `phone`, `city`, `address` (форма `06` § 4.7 требует все четыре; `comment`, `tracking_note` — null); `shop_order_items.order_id`, `item_id`, `quantity`, `price_points_snapshot`.
3. **Check сверх `02`:** `total_points > 0`, `price_points_snapshot > 0` (цена товара > 0); `image_keys` — JSON-массив; `options`, `selected_options` — JSON-объект или `null`.
4. **Списание и возврат:** `ledger_id` — unique (одно списание на заказ). Поля для возврата нет: запись `shop_refund` находится по `source_type = 'shop_order'`, `source_id` = id заказа, повтор режет `points_ledger_source_once_key`. Кто и когда отменил — `audit_log` и `created_by` записи возврата; полей `cancelled_*` нет.
5. **Индексы:** `shop_orders` — `user_id` и (`status`, `created_at`) вместо голого `status` (список админки — фильтр по статусу и дата, как `videos`); `shop_order_items` — `order_id` (выборка состава, каскад). У `shop_items` индексов, кроме unique `slug`, нет (таблица маленькая).
6. **Связи:** `shop_order_items.item_id`, `shop_orders.user_id`, `ledger_id` — без каскада (товар с заказами только архивируется / мягко удаляется; пользователь с заказами не удаляется жёстко). `slug` уникален и среди удалённых (как `posts`, `events`). У `shop_orders` и `shop_order_items` нет `deleted_at` (заказы не удаляются; отмена — статус); у позиций нет `updated_at` (снимок не меняется).
7. **Отмена участником** (`06` § 5.8 против `04` 3.2, `questions.md`) — схему не меняет, решается в 7.6 / 7.7.

## Миграция 0015 (Migration Gate — ждёт «go»)

`drizzle/0015_shop.sql` (через `npm run db:generate`, Node 24):
- `CREATE TYPE order_status AS ENUM ('new', 'confirmed', 'shipped', 'delivered', 'cancelled')`.
- `CREATE TABLE shop_items` — поля `02` § 7 (решения 2–3); unique `slug`; check `price_points > 0`, `stock IS NULL OR stock >= 0`, `jsonb_typeof(image_keys) = 'array'`, `options IS NULL OR jsonb_typeof(options) = 'object'`.
- `CREATE TABLE shop_orders` — поля `02` § 7 + `number` (решение 1); FK `users`, `points_ledger`; unique `number`, unique `ledger_id`; check `total_points > 0`; индексы `user_id`, (`status`, `created_at`).
- `CREATE TABLE shop_order_items` — FK `shop_orders` on delete cascade, FK `shop_items`; check `quantity > 0`, `price_points_snapshot > 0`, `selected_options IS NULL OR jsonb_typeof(selected_options) = 'object'`; индекс `order_id`.
- Существующие таблицы и enum не меняются.

Откат — `scripts/rollback/0015_down.sql`: `DROP TABLE shop_order_items; DROP TABLE shop_orders; DROP TABLE shop_items; DROP TYPE order_status;` (только по «go»; теряются товары и заказы — записи `shop_order` / `shop_refund` в журнале баллов остаются, append-only; на проде таблиц нет до деплоя этапа 7), затем убрать строку 0015 из `drizzle.__drizzle_migrations` и из `drizzle/meta`. Применение на dev — `npm run db:migrate` под Node 24; прод — Deploy этапа 7 (`release_command`, вместе с 0014).

## Файлы (ожидаемо)

- `src/lib/server/db/schema/shop.ts` (+ `enums.ts` — `orderStatus`, `index.ts`) — три таблицы.
- `drizzle/0015_shop.sql`, `drizzle/meta/*`, `scripts/rollback/0015_down.sql` — миграция и откат.
- `src/lib/server/db/shop-schema.test.ts` — тест схемы по образцу `videos-schema.test.ts` (в транзакции с откатом): значения по умолчанию, check-и, unique `slug` / `number` / `ledger_id`, каскад позиций, товар и пользователь с заказом не удаляются жёстко, неизвестный статус — ошибка.

## Не ломать

- Миграции 0000–0014 и тесты схемы `src/lib/server/db/*-schema.test.ts`.
- Журнал баллов: append-only триггер и `points_ledger_source_once_key` не меняются; `points_reason` — без изменений.
- Права `shop.items_write` / `shop.orders_manage` / `shop.orders_cancel` и меню админки «Баллы и магазин» — как были (страниц ещё нет).

## Проверка

- `npx vitest run src/lib/server/db` → PASS (новый `shop-schema.test.ts` и прежние тесты схемы).
- `npm run check`, `npm run lint`.

## Риск

`high` — миграция (`drizzle/*.sql`).

## Читать

- `02` § 7, enum `order_status` (выписано), `03` § 9 (выписано), `05` § 15, § 26 п. 4 (выписано), `06` § 4.7, § 5.8 (выписано).
- `zone-notes.md` § «Видео», § «Баллы», § «Контент и админка» (прочитаны). Для 7.4: новая таблица с ключами медиа — свой поиск в `services/media/usage.ts` (`image_keys`).

## Фазы

- [x] SPEC (`3a5b10b`)
- [x] «go» на миграцию 0015, решения 1–7; формат номера — `ORD-2026-0001` (2026-10-25)
- [x] RED (`a23dc0e`)
- [x] GREEN — 0015 применена на dev; `src/lib/server/db` 39/39; `check`, `lint`
- [ ] REVIEW (этапа)

## Для REVIEW

- `points-schema.test.ts`: `truncate points_ledger` → `truncate points_ledger cascade` — FK `shop_orders.ledger_id` теперь отказывает в `TRUNCATE` раньше триггера (`0A000`); с `cascade` проверяется сам триггер (`23001`).

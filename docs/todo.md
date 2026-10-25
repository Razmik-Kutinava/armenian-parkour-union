# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`; 6.7c админка тренеров и судей (решения и «для REVIEW») — `git show ba7fd1a:docs/todo.md`; 6.8 кабинет `/cabinet/progress` (решения и «для REVIEW») — `git show 9b82a38:docs/todo.md`; 6.9 ежедневная задача сертификатов (решения, миграция 0013, «для REVIEW») — `git show f3ffcb4:docs/todo.md`; 6.10 тесты этапа 6 (охрана `users.level`, гонки) — `git show 2e15b67:docs/todo.md`; 7.1 таблица `videos`, форма в кабинете (решения, миграция 0014, «для REVIEW») — `git show 1dddb1d:docs/todo.md`; 7.2 модерация видео, настройки видео (решения, «для REVIEW») — `git show 55fee41:docs/todo.md`; 7.3 таблицы магазина (решения, миграция 0015, «для REVIEW») — `git show b8dc376:docs/todo.md`; 7.4 админка товаров и заказов (решения, «для REVIEW») — `git show e58c3bd:docs/todo.md`.

## Задача

**7.5** (`09` этап 7): публичный каталог `/shop` и страница товара `/shop/{slug}`, состояния кнопки заказа (`06` § 4.7). Миграции нет.

Граница: витрина и кнопка. **Форма доставки, подтверждение, создание заказа, списание баллов и `stock` — 7.6** (страница `/shop/{slug}/order`); кабинет заказов — 7.7. Товары создаются в `/admin/products` (7.4).

Факты из документов:
- `06` § 4.7: каталог — карточки с фото, названием, ценой в баллах, пометкой «Нет в наличии»; товар — галерея, описание, выбор варианта, цена, кнопка. Кнопка: гость — «Войдите, чтобы заказать»; не хватает — «Не хватает N баллов» (неактивна); нет в наличии — «Нет в наличии»; можно — «Заказать за N баллов» → шаг подтверждения с доставкой. Источник — `shop_items`, баланс — `users.points_balance`.
- `03` § 9 п. 1: виден при `published` и не удалён; недоступен при `stock = 0`. П. 3: заказать может активный пользователь с подтверждённым email.
- `06` § 7 п. 2: `sitemap.xml` — в том числе товары.

## Решения (агент; по документам и образцам 4.4 / 4.3 / 5.5)

1. **Видимость** — `published` и `deleted_at is null`; иначе 404 (черновик, архив, удалённый, чужой адрес).
2. **Каталог** — порядок `sort_order`, затем новые; 24 на страницу (`?page=`), как новости. Карточка — первое фото (alt из медиатеки) или заглушка, название, «N баллов», «Нет в наличии» при `stock = 0`.
3. **Товар** — галерея всех фото по порядку (большое + миниатюры-кнопки), описание (HTML очищен при сохранении), варианты — `select` на каждый (обязательный), цена.
4. **Кнопка** — сервис `orderButton(db, userId, itemId)`, читает остаток и баланс **из базы без кеша** (кешированная карточка может отстать). Порядок: `stock = 0` → «Нет в наличии» (для всех, и для гостя); гость → «Войдите, чтобы заказать» (`/login?returnTo=`); email не подтверждён → «Подтвердите email, чтобы заказать» + ссылка в кабинет (`03` § 9 п. 3, в таблице `06` нет — как `email_unverified` у регистраций); баланс < цены → «Не хватает N баллов» (N = цена − баланс, неактивна); иначе «Заказать за N баллов» — GET-форма на `/shop/{slug}/order` с выбранными вариантами (страница — 7.6; до неё 404). Количество — 1 (решает 7.6).
5. **Кеш** — новая группа `shop`: каталог и карточка товара; `products` → `['shop']`, `orders` → `['shop']` (отмена в 7.6 вернёт остаток), `media` — все группы. **Для 7.6:** заказ пишет не админ — после коммита `publicCache.invalidate(['shop'])`, иначе «Нет в наличии» в каталоге отстаёт до 60 с.
6. **SEO** — заголовок товара, описание — текст из описания (или общий текст магазина), картинка — первое фото. Sitemap: `/shop` и видимые товары с `updated_at`.

## Файлы (ожидаемо)

- `src/lib/server/services/shop/public.ts` (+ `public.test.ts`) — `listShopItems`, `getShopItem`.
- `src/lib/server/services/shop/order-button.ts` (+ `order-button.test.ts`) — `orderButton`; `view.ts` — адреса картинок, SEO.
- `src/lib/server/cache/memory.ts`, `admin-groups.ts` (+ тест) — группа `shop`.
- `src/lib/server/services/seo/sitemap.ts` (+ тест).
- `src/routes/[[lang=lang]]/(site)/shop/` — `+page.server.ts`, `+page.svelte`, `[slug]/+page.server.ts`, `+page.svelte`, `ItemGallery.svelte`, `OrderBox.svelte`; `src/lib/components/site/ShopCard.svelte`.
- `src/lib/i18n/messages/{en,hy,ru}-shop.ts` (+ подключение в `en.ts`, `hy.ts`, `ru.ts`).
- `tests/e2e/shop.spec.ts`.

## Не ломать

- Админка товаров и заказов 7.4 (`admin-shop.spec.ts`), сброс кеша прочих разделов (`admin-groups.test.ts`).
- Черновик, архив, удалённый товар — не видны гостю и участнику (страница 404, нет в каталоге и sitemap).
- Баланс и остаток только читаются; журнал баллов и схема не меняются.

## Проверка

- `npx vitest run src/lib/server/services/shop/public.test.ts src/lib/server/services/shop/order-button.test.ts src/lib/server/cache src/lib/server/services/seo/sitemap.test.ts` → PASS.
- `npx playwright test tests/e2e/shop.spec.ts` → PASS; `npm run check`, `npm run lint`.

## Риск

`normal` — публичное чтение и свой баланс; записей, прав и денег нет.

## Читать

- `06` § 4.7, § 3.1, § 7 п. 2 (выписано); `03` § 9 (выписано).
- `zone-notes.md` § «Видео и магазин» (прочитан).

## Фазы

- [x] SPEC
- [x] RED `0a61459`
- [x] GREEN (коммит ниже)
- [ ] REVIEW (этапа)

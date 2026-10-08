# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

2.5 События: таблицы `events`, `event_categories`; админка `/admin/events` (форма, категории, статусы, дублирование, предпросмотр); сайт `/events` (фильтры), `/events/{slug}`, `/events/archive`. Регистрации нет — кнопка-заглушка (этап 5).

## Читать (выписано)

- `02` § 3: `events` (slug unique, title/description jsonb, cover_key, status `event_status` default draft, starts_at/ends_at not null, location_name, address, city, lat/lng numeric(9,6), capacity null = без лимита, price_amount_minor default 0, price_currency char(3) default AMD, registration_opens_at/closes_at, published_at, created_by, deleted_at, created_at/updated_at; индексы unique(slug), (status, starts_at); check ends_at >= starts_at). `event_categories` (event_id FK cascade, name jsonb, discipline, age_min/max smallint, capacity, sort_order; индекс event_id). Enum `event_status`: draft, published, finished, cancelled, archived; `discipline`: speed, style, tricking, freerun, other.
- `03` § 7.1: видно только `published` и `published_at <= now`; 7.8 нельзя удалить с регистрациями — только отменить; 7.9 `finished` — в архиве. § 12: откат на EN.
- `04`: `events.write` (editor, admin) — создать, редактировать, опубликовать, снять; `events.cancel` (admin) — отменить, архивировать.
- `05` § 5: список (обложка, название, даты, место, статус, регистраций / лимит, цена; фильтры статус, период предстоящие / прошедшие, город, платные / бесплатные; поиск по названию); форма (поля выше; цена обязательна, `0` бесплатно); вкладка «Категории» (название ×3, дисциплина, возраст от / до, лимит, порядок; удалить — только без регистраций); действия: черновик, предпросмотр, опубликовать / снять, дублировать, отменить (admin, с причиной), архивировать.
- `06` § 4.2: карточки (обложка, название, дата и время, город, цена / «Бесплатно», индикатор мест); фильтры город, период, цена, дисциплина (по категориям); сортировка по дате; ссылка на архив; источник `published`, `starts_at >= now`, архив — `finished`. § 4.3: обложка, название, даты, место и карта, описание, цена, категории, блок регистрации, «Поделиться»; SEO `Event` + Open Graph.

## Дефолты агента (подтвердить владельцу; `questions.md`)

1. **Отмена** (admin): причина обязательна, пишется в журнал `event.cancel` (поля в `02` нет); писем нет (регистраций и почты ещё нет). Отменённое событие: из списков пропадает, страница по прямой ссылке открывается с плашкой «Событие отменено» (иначе пришедшие по анонсу видят 404).
2. **Завершить** (`finished`): кнопка у опубликованного события после его начала, право `events.cancel` (admin) — до вкладки «Результаты» (этапы 5–6). Завершённое — в `/events/archive` и открывается по ссылке.
3. **Архив** (`archived`, admin): с сайта пропадает полностью; из архива — «Вернуть в черновик» (admin).
4. **Список `/events`**: `published`, дата публикации наступила, `ends_at >= now` (идущее многодневное событие ещё видно — уточнение к `starts_at >= now` из `06`), по возрастанию `starts_at`, 12 на страницу. Архив — `finished`, по убыванию, 12 на страницу. Фильтры через адрес: `?city=` (города из видимых событий), `?period=week|month|3months`, `?price=free|paid`, `?discipline=`.
5. **Индикатор мест** — только окно регистрации («Регистрация откроется …» / «Регистрация закрыта»); «Осталось N» — с регистрациями (этап 5). В админке «регистраций / лимит» = «— / N» (или «без лимита»).
6. **Кнопка регистрации** — неактивная «Зарегистрироваться» с подписью «Регистрация на сайте появится позже».
7. **Карта** — ссылка «Открыть на карте» на Google Maps по координатам (иначе по адресу), без библиотеки (`questions.md`, этап 2, «Карта»).
8. **Цена** вводится в основных единицах: AMD — целое (драмы), USD / EUR — до 2 знаков → центы; хранится `price_amount_minor` + `price_currency` ∈ AMD, USD, EUR.
9. **Как у новостей (решение 2026-10-08)**: даты вводятся по времени Еревана; публикация без даты — `now()` базы; предпросмотр — сохранённая версия в оболочке админки; дубль — черновик `{slug}-copy` с категориями, датами и ценой, без даты публикации, `created_by` — кто копирует; удаление мягкое (`events.write`; запрет при регистрациях — с этапа 5); обложка — из медиатеки; описание — только `richTextSchema`; обложка и картинки описания = «используется» в медиатеке.
10. **Проверки формы**: EN-название обязательно; `ends_at >= starts_at`; закрытие регистрации ≥ открытия; координаты — обе или ни одной (широта ±90, долгота ±180); лимит — целое ≥ 1 или пусто; категория: EN-название, возраст 0–99, от ≤ до, лимит ≥ 1 или пусто.
11. **Журнал**: `event.create`, `event.update` (в т.ч. публикация, снятие, завершение, архив — с `before` / `after` статуса), `event.cancel` (с причиной), `event.delete`, `event_category.create / update / delete`.
12. **SEO** (через `SeoHead` + `buildSeo` из 2.4): title, description (начало описания), canonical, Open Graph с обложкой, JSON-LD `Event` (`eventStatus` Scheduled / Cancelled, место, цена).

## Миграция 0005 (Migration Gate — ждёт «go»)

Меняется: новые enum `event_status`, `discipline`; таблицы `events` и `event_categories` ровно по `02` § 3 + индексы + check `ends_at >= starts_at`. Отличия от `02` (по соглашениям `02` и примеру `posts`): `title`, `description` (default `{}`), `name`, `discipline` (default `other`), `price_*`, `sort_order` — `NOT NULL`; у `event_categories` добавлены `created_at`, `updated_at` (по общему соглашению «в каждой таблице `created_at`»). Существующие таблицы не трогаются.
Откат: `scripts/rollback/0005_down.sql` — `DROP TABLE event_categories, events; DROP TYPE discipline, event_status` (теряются события; только по «go»), затем убрать строку 0005 из `drizzle.__drizzle_migrations` и запись из `drizzle/meta`.

## Файлы (ожидаемо)

- `src/lib/server/db/schema/events.ts`, `enums.ts`, `index.ts`; `drizzle/0005_events.sql`; `scripts/rollback/0005_down.sql` — схема.
- `src/lib/validation/events.ts` (+ `event-categories.ts`) — схемы формы и категорий.
- `src/lib/server/services/events/` — `edit.ts`, `lifecycle.ts`, `categories.ts`, `list.ts` (админка), `public.ts` (сайт), `checks.ts`.
- `src/lib/server/services/media/usage.ts` — обложка и картинки описания события.
- `src/routes/admin/events/` — список, `new`, `[id]` (форма + вкладка «Категории»), `[id]/preview`; `CoverPicker` — перенести из `admin/news/` в `lib/components/admin/` для общего использования.
- `src/routes/[[lang=lang]]/(site)/events/` — `+page`, `[slug]`, `archive`; `lib/components/site/EventCard.svelte`, `EventArticle.svelte`.
- `src/lib/i18n/messages/*-events.ts`; `tests/e2e/events.spec.ts`; `admin-audit-map.ts`, `admin-access-map.ts`.

## Не ломать

- Новости, страницы, медиатека: используемый файл (в т.ч. обложка события) нельзя удалить.
- Права: moderator и member не видят `/admin/events` и не выполняют действия (403 / 404 на сервере); editor не может отменить, завершить, архивировать.
- Гость не видит черновик, отложенное, архивное событие (404) — `audit-coverage` / `access-coverage` зелёные.

## Проверка

- `npm run test -- src/lib/server/services/events src/lib/validation/events` и `npx playwright test tests/e2e/events.spec.ts tests/e2e/admin-audit.spec.ts tests/e2e/admin-permissions.spec.ts`
- `npm run check`, `npm run lint`

## Риск

`high` (миграция `drizzle/*.sql`, журнал действий) — bugbot + security-review.

## Фазы

- [x] SPEC
- [x] «go» на миграцию 0005 и подтверждение дефолтов 1–12 (2026-10-08)
- [x] RED (`test: … [RED]`) — миграция 0005 на dev применена
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

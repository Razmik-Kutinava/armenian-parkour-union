# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

2.7 Настройки сайта (`09`): довести форму `/admin/settings` (1.10b) до `05` § 21 в объёме этапа 2 — добавить ссылки подвала; шапка и подвал берут название из `site_settings.site_name`. Решения владельца — `decisions.md` 2026-10-08 (2.7).

## Читать (выписано)

- `05` § 21: группы Основное (название ×3, логотип, favicon, SEO), Контакты, Соцсети, Футер (текст, **ссылки**), Реквизиты — этап 2; Членство — этап 3; Параметры правил — 5–7; Функции — когда будет список. Каждое изменение — в `audit_log` с прежним и новым значением (уже есть, `settings.update`).
- `06` § 2: шапка — логотип, меню…; подвал — контакты, соцсети, реквизиты, ссылки на страницы, язык; источник `site_settings`.
- `08` § 2: логотип / favicon — SVG в `static/brand/`; растровый запрещён; до файлов — заглушка (решение: текст `site_name`).
- Решения: `footer.links` — до 10 `{label: {en,hy,ru}, url}`, EN обязателен, url — `https://…` или путь сайта `/…` (не `//`), после 6 системных страниц; логотип / favicon не в форме.

## Файлы (ожидаемо)

- `src/lib/validation/site-settings.ts` — `footerSchema.links`, `siteLinkUrl`
- `src/lib/validation/site-settings-form.ts` — `formToObject`: индексы → массив, глубина до 5
- `src/lib/server/services/site-settings.ts` — `getFooterSettings`: `siteName`, `links`
- `src/routes/admin/settings/+page.svelte` (+ `FooterLinks.svelte`) — строки ссылок, «Добавить ссылку»
- `src/lib/components/site/SiteHeader.svelte`, `SiteFooter.svelte`, `(site)/+layout.server.ts`, `+layout.svelte`
- i18n `en.ts`, `ru.ts`; тесты `site-settings*.test.ts`, `tests/e2e/admin-system.spec.ts`

## Не ломать

- Сохранение настроек: журнал `settings.update` с before / after только по изменённым ключам; неадмин → 403.
- Битый ключ в базе — блок скрыт, страница не падает (подвал, «Контакты»).
- Ссылки в `href` — без `javascript:`, `data:`, `//host`.
- Старое значение `footer` (`{text}` без `links`) читается и сохраняется как раньше.

## Проверка

- `npx vitest run src/lib/validation/site-settings src/lib/server/services/site-settings`
- `npx playwright test tests/e2e/admin-system.spec.ts tests/e2e/admin-audit.spec.ts`

## Риск

`normal` — валидация формы и сервис, без миграции и прав.

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

---

# Отложено: 2.6 Hero-блоки и главная (ждёт «go» на миграцию 0006)

Таблица `hero_blocks`, админка `/admin/hero` (перетаскивание + ↑ / ↓, предпросмотр, «Что сейчас на главной»), компонент `HeroBlock` всех типов, запасной блок, главная `/` целиком (`06` § 4.1). Решения владельца — `decisions.md` 2026-10-08 (2.6).

## Читать (выписано)

- `02` § `hero_blocks`: id, type `hero_type` (`event | presentation | video | person | custom`), title / subtitle jsonb, media_key, video_url, cta_label jsonb, cta_url, event_id → events, person_user_id → users, sort_order 0, is_active false, starts_at / ends_at, created_by, created_at / updated_at; индекс (`is_active`, `sort_order`); проверки: event → event_id, person → person_user_id, video → video_url. **+ `archived_at`** (решение владельца).
- `03` § 11: на сайте `is_active` и сейчас внутри `starts_at…ends_at` (если заданы), по `sort_order`; лимит активных — `site_settings.hero_max_active` (5); `event` — данные события из БД, снято / отменено → блок не показывается; `person` — только 18+ (решение); нет блоков → ближайшее событие, иначе общий баннер.
- `05` § 4: список карточек (превью, заголовок, тип, переключатель «активен», период, порядок), фильтры тип / активные; сверху «Что сейчас на главной» с живым предпросмотром. Форма: тип, заголовок ×3 (обяз.), подзаголовок ×3, фон (медиа), событие (из опубликованных), персона (поиск), ссылка видео (YouTube / Instagram), текст кнопки ×3, ссылка кнопки (URL или путь сайта), период, активен. Действия: создать, редактировать, вкл / выкл, порядок, дублировать, предпросмотр, архивировать. Лимит → «Выключите другой блок»; событие не опубликовано → предупреждение.
- `04`: `hero.write` — editor, admin (есть в `permissions.ts`, меню `/admin/hero` уже есть).
- `06` § 4.1: Hero → Ближайшие события (3) → О федерации (начало `about` + «Вступить») → Новости (3) → Как это работает (шаги, переводы) → [Магазин, Поддержать — не выводятся, нет таблиц] → Призыв «Вступить» / «Войти». Нет данных — блок скрыт.
- `08`: HeroBlock — единый каркас (фон, затемнение navy, заголовок, подзаголовок, одна кнопка, индикатор слайдов), корректно без картинки; 16:9 / моб. 4:5; диагональный срез снизу; смена слайдов — допустимая анимация (уважать `prefers-reduced-motion`); первый экран без тяжёлого (картинка с размерами, остальное лениво).

## Файлы (ожидаемо)

- `src/lib/server/db/schema/hero.ts` (+ `enums.ts` `heroType`, `index.ts`), `drizzle/0006_hero_blocks.sql`, `scripts/rollback/0006_down.sql`
- `src/lib/validation/hero.ts` (+ `hero-enums.ts` для клиента), `src/lib/server/seed/settings.ts` (`hero_max_active`)
- `src/lib/server/services/hero/` — `edit.ts` (создать / изменить / дубль / архив / возврат), `toggle.ts` (вкл / выкл с лимитом), `order.ts` (порядок), `list.ts` (админка), `public.ts` (активные + запасной), `persons.ts` (поиск 18+); `services/media/usage.ts` (kind `hero`)
- `src/lib/server/services/home.ts` — данные главной (события 3, `about`, новости 3)
- `src/routes/admin/hero/` — список, `new`, `[id]`, `[id]/preview`
- `src/lib/components/site/hero/` — `HeroBlock.svelte`, `HeroSlider.svelte`, `HeroVideo.svelte`, `youtube.ts`; секции главной в `components/site/home/`
- `src/routes/[[lang=lang]]/(site)/+page.server.ts`, `+page.svelte`; i18n `en-hero.ts`, `ru-hero.ts`, `en-home.ts`, `ru-home.ts`

## Не ломать

- Публичные `/events`, `/news`, `/federation` и их видимость (`published` + дата).
- Медиатека: файл в hero-блоке = «используется», удалить нельзя.
- Персона: несовершеннолетний или без `birth_date` не выбирается и на сайт не попадает (K4); на сайте только имя и аватар.
- Карты e2e `admin-audit-map.ts`, `admin-access-map.ts` — новые действия и страницы внесены.

## Проверка

- `npx vitest run src/lib/server/services/hero src/lib/validation/hero src/lib/components/site/hero`
- `npx playwright test tests/e2e/hero.spec.ts tests/e2e/home.spec.ts`

## Риск

`high` — миграция `drizzle/*.sql`, данные участника (персона).

## Миграция 0006 (Migration Gate — ждёт «go»)

**Что меняется (только добавление):**
- `CREATE TYPE hero_type AS ENUM ('event','presentation','video','person','custom')`.
- `CREATE TABLE hero_blocks` по `02` + `archived_at timestamptz null`; `title` / `subtitle` NOT NULL default `{}`; `sort_order` NOT NULL default 0; `is_active` NOT NULL default false; `created_at` / `updated_at` NOT NULL default now(); FK `event_id → events`, `person_user_id → users`, `created_by → users` (без каскада — события и пользователи удаляются мягко).
- Индекс `hero_blocks_active_sort_idx (is_active, sort_order)`; CHECK: event → event_id, person → person_user_id, video → video_url, `ends_at >= starts_at`.
- Данные: ключ `site_settings.hero_max_active = 5` — через `db:seed` (добавляет только недостающие ключи), не в миграции.

**Откат** (`scripts/rollback/0006_down.sql`, только по «go»): `DROP TABLE hero_blocks; DROP TYPE hero_type;` + удалить строку 0006 из `drizzle.__drizzle_migrations` и запись из `drizzle/meta`. Теряются все hero-блоки; другие таблицы не затрагиваются.

## Правила реализации (выписано)

- Лимит: включение и создание активного считают активные не в архиве под `pg_advisory_xact_lock` (без гонки двух включений); превышение → «Выключите другой блок».
- Порядок: форма отправляет весь список id; сервер проверяет, что это ровно все неархивные блоки, и пишет `sort_order = индекс` в одной транзакции.
- Архив: `archived_at = now()`, `is_active = false`; в списке — фильтр «Архив», «Вернуть» (неактивным).
- Журнал: `hero.create`, `hero.update`, `hero.activate`, `hero.deactivate`, `hero.reorder`, `hero.duplicate`, `hero.archive`, `hero.restore`.
- Видео: YouTube (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`) → id; превью `i.ytimg.com`, по клику iframe `youtube-nocookie`; Instagram (`/p/`, `/reel/`) → кнопка-ссылка; прочие URL — ошибка формы.
- Ссылка кнопки: `https?://…` или путь сайта `/…`.
- Медиа фона: строка `media` `FOR SHARE` (как обложка), поиск в `usage.ts`.
- Запасной: ближайшее опубликованное предстоящее событие, иначе общий баннер (тексты из переводов + «Вступить»).

## Фазы 2.6

- [x] SPEC
- [ ] Migration Gate «go»
- [ ] RED · GREEN · REGRESS · REVIEW · DEPLOY

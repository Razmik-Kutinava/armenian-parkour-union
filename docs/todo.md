# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

2.4 Новости (`posts`): админка (черновик, отложенная публикация, теги, предпросмотр, снять, архивировать, дублировать, мягкое удаление), публичный список `/news` и страница `/news/{slug}`, SEO и Open Graph новости.

## Читать

- `02` § 8 `posts` — id, slug unique, title / excerpt / body jsonb, cover_key, tags text[] default '{}', status content_status default draft, published_at null, author_id FK users, deleted_at, created_at, updated_at; индекс (status, published_at desc)
- `05` § 18 — список: обложка, заголовок, статус, дата публикации, автор; фильтры статус, тег, период; поиск по заголовку. Форма: заголовок ×3, адрес, краткое описание ×3, текст ×3, обложка, теги, статус, дата публикации, автор. Действия: черновик, предпросмотр, опубликовать, снять, архивировать, дублировать
- `06` § 4.4 — список: карточки (обложка, заголовок, кратко, дата, теги), фильтр по тегу, 12 на страницу; страница: заголовок, дата, обложка, текст, теги, «Поделиться», «Читайте также» (2–3 последние); `Article` микроразметка
- `06` § 7 п. 1, 3 — title, description, Open Graph (изображение), канонический URL; hreflang и sitemap — 2.8
- `03` § 12 п. 1 — видны только `published`; отложенная публикация = `published_at` в будущем
- `04` — `posts.write` (editor, admin) уже в `permissions.ts`
- `PROGRESS` «В работе» — `RichTextEditor` + `richTextSchema(R2_PUBLIC_URL)`, `{@html}` в `.rich-text`; ключ медиа — поиск в `services/media/usage.ts` и `FOR SHARE` на строку `media`; новые страницы админки — в `admin-audit-map.ts` и `admin-access-map.ts`

## Миграция 0004 (Migration Gate — ждёт «go»)

Меняется (ровно по `02` § 8, enum `content_status` уже есть из 0003):
- `CREATE TABLE posts`: `id uuid PK default gen_random_uuid()`, `slug text NOT NULL UNIQUE`, `title jsonb NOT NULL`, `excerpt jsonb NOT NULL DEFAULT '{}'`, `body jsonb NOT NULL DEFAULT '{}'`, `cover_key text`, `tags text[] NOT NULL DEFAULT '{}'`, `status content_status NOT NULL DEFAULT 'draft'`, `published_at timestamptz`, `author_id uuid FK users`, `created_at`, `updated_at timestamptz NOT NULL DEFAULT now()`, `deleted_at timestamptz`
- `CREATE INDEX posts_status_published_at_idx ON posts (status, published_at DESC)`

Откат `scripts/rollback/0004_down.sql`: `DROP TABLE IF EXISTS posts;` (теряет все новости; только по «go»), затем убрать строку 0004 из `drizzle.__drizzle_migrations` и `drizzle/meta`. Таблица новая — существующие данные не затрагивает.

## Правила (по документам + решения по умолчанию на подтверждение)

- Гость видит новость, если `status = published`, `published_at <= now()`, не удалена. «Опубликовать» без даты ставит `published_at = now()`; дата в будущем — «запланирована» (в списке админки отдельной меткой). «Снять» → `draft`.
- Автор — выбор из активных editor / admin, по умолчанию текущий.
- Теги — одним языком, без перевода: обрезка пробелов, нижний регистр, без повторов, до 10 штук по 32 символа. Фильтр `/news?tag=…`.
- Краткое описание — простой текст до 300 символов на язык; оно же description и og:description (нет — начало текста новости, нет и его — общее описание раздела «Новости»).
- Предпросмотр — сохранённая версия на `/admin/news/{id}/preview`, вид как на сайте, плашка «Предпросмотр», `noindex`, только `posts.write`.
- Дублировать — копия в `draft`, адрес `{slug}-copy` (`-copy-2`, …), без даты публикации.
- Удаление мягкое, кроме архива (как у страниц).
- Обложка — выбор из медиатеки (только изображения); og:image — адрес обложки в R2 как есть, без нарезки; без обложки og:image нет (логотипа пока нет).
- «Поделиться» — системное меню телефона (`navigator.share`), иначе «скопировать ссылку»; без сторонних виджетов.
- Журнал: `post.create` (в т.ч. дубль, с `duplicated_from`), `post.update` (смена статуса — тоже, со старым и новым статусом), `post.delete`.

## Файлы (ожидаемо)

- `src/lib/server/db/schema/content.ts`, `drizzle/0004_posts.sql`, `scripts/rollback/0004_down.sql`
- `src/lib/validation/posts.ts` (+ test) — slug, заголовок ×3 (en обязателен), excerpt ×3, текст ×3 через `richTextSchema`, обложка, теги, статус, дата, автор
- `src/lib/server/services/posts/` — `list.ts` (админка: фильтры, поиск), `edit.ts` (создать, изменить, дублировать, удалить; аудит), `media.ts` (`FOR SHARE` обложки и картинок текста), `public.ts` (список с тегом и страницами, по slug, «Читайте также») + тесты
- `src/lib/server/services/media/usage.ts` — обложка и картинки текста новостей
- `src/lib/components/site/SeoHead.svelte` — title, description, canonical, og:*, twitter:card, JSON-LD (2.8 переиспользует)
- `src/lib/components/admin/MediaPicker.svelte` — выбор обложки из медиатеки
- `src/routes/admin/news/` (`+page`, `new`, `[id]`, `[id]/preview`) — список, форма, действия (адрес раздела уже был в меню админки)
- `src/routes/[[lang=lang]]/(site)/news/`, `news/[slug]/` — публичный вывод; пункт «Новости» в меню
- `tests/e2e/admin-audit-map.ts`, `admin-access-map.ts`, `tests/e2e/news.spec.ts`; переводы `en/hy/ru`

## Не ломать

- Гость не видит черновик, архив, удалённую и запланированную (дата в будущем) новость — ни в списке, ни по адресу (404), ни в «Читайте также»
- editor и admin правят и смотрят предпросмотр; moderator и member получают 404 на `/admin/news*`, гость — вход (`access-coverage`)
- Сырой HTML из формы не сохраняется — только результат `richTextSchema`
- Файл — обложка или картинка в тексте новости — нельзя удалить из медиатеки

## Проверка

- `npx vitest run src/lib/server/services/posts src/lib/validation/posts.test.ts src/lib/server/services/media`
- `npx playwright test tests/e2e/news.spec.ts tests/e2e/admin-audit.spec.ts tests/e2e/admin-access.spec.ts`

## Риск

`high` — миграция `drizzle/*.sql` → bugbot + security-review.

## Фазы

- [x] SPEC
- [x] Подтверждение правил + «go» на миграцию 0004 (применена на dev)
- [x] RED (`test: … [RED]`)
- [x] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

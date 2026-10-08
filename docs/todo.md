# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

2.3 Страницы (`pages`): админка (список, создание, редактирование, статус, мягкое удаление обычных) и публичный вывод; системные страницы `about`, `rules`, `contacts`, `privacy`, `offer`, `refund-policy` создаёт seed, они не удаляются.

## Читать

- `02` § 8 `pages` — поля: id, slug unique, title jsonb, body jsonb, status content_status, updated_by, updated_at
- `05` § 19 — список: название, адрес, статус, когда изменена; форма: заголовок ×3, текст (редактор) ×3, статус; системные не удаляются
- `06` § 3.1, § 4.5 — `/federation` = `about`, `/pages/{slug}` прочие; «Контакты» + данные `site_settings`
- `04` — право `pages.write` (editor, admin) уже в `permissions.ts`
- `PROGRESS` «В работе» — поле `RichTextEditor`, сервер только `richTextSchema(R2_PUBLIC_URL)`, вывод `{@html}` в `.rich-text`; ключ медиа в новой таблице — поиск в `services/media/usage.ts`; новые страницы админки — в `admin-audit-map.ts` и `admin-access-map.ts`

## Миграция 0003 (Migration Gate — ждёт «go»)

Меняется:
- `CREATE TYPE content_status AS ENUM ('draft','published','archived')`
- `CREATE TABLE pages`: `id uuid PK`, `slug text NOT NULL UNIQUE`, `title jsonb NOT NULL`, `body jsonb NOT NULL DEFAULT '{}'`, `status content_status NOT NULL DEFAULT 'draft'`, `updated_by uuid FK users`, `updated_at timestamptz NOT NULL DEFAULT now()`
- сверх `02` (по вопросам ниже): `is_system boolean NOT NULL DEFAULT false`, `created_at timestamptz NOT NULL DEFAULT now()`, `deleted_at timestamptz` (удаление мягкое — правило архитектуры 5)
- индекс `(status)` не нужен: страниц десятки

Откат `scripts/rollback/0003_down.sql`: `DROP TABLE IF EXISTS pages; DROP TYPE IF EXISTS content_status;` (теряет все страницы; только по «go»), затем убрать строку 0003 из `drizzle.__drizzle_migrations` и `drizzle/meta`. Таблица новая — на существующие данные не влияет.

## Файлы (ожидаемо)

- `src/lib/server/db/schema/content.ts` (+ `enums.ts`, `index.ts`), `drizzle/0003_pages.sql`, `scripts/rollback/0003_down.sql`
- `src/lib/validation/pages.ts` (+ test) — slug, заголовок ×3 (en обязателен), текст ×3 через `richTextSchema`, статус
- `src/lib/server/services/pages/` — `list.ts`, `edit.ts` (создать, изменить, удалить; аудит `page.create/update/delete`), `public.ts` (опубликованная страница по slug, откат на en) + тесты
- `src/lib/server/services/media/usage.ts` — ключи медиа в `pages.body`
- `src/lib/server/seed/pages.ts` (+ test), `scripts/seed.ts` — 6 системных страниц, только недостающие
- `src/routes/admin/pages/` (`+page`, `new`, `[id]`) — список, форма с вкладками языков
- `src/routes/[[lang=lang]]/(site)/federation/`, `pages/[slug]/` — публичный вывод; `/pages/about` → `/federation`; `contacts` + контакты из `site_settings`
- `tests/e2e/admin-audit-map.ts`, `admin-access-map.ts`, `tests/e2e/pages.spec.ts`; переводы `en/hy/ru`

## Не ломать

- Гость не видит черновик / архив / удалённую страницу (404), editor и admin правят, moderator и member получают 404 на `/admin/pages*` (`access-coverage`)
- Системную страницу нельзя удалить и сменить ей адрес, даже «враждебной» формой
- Сырой HTML из формы не сохраняется — только результат `richTextSchema`
- Файл из медиатеки, вставленный в текст страницы, нельзя удалить («где используется»)

## Проверка

- `npx vitest run src/lib/server/services/pages src/lib/validation/pages.test.ts src/lib/server/seed src/routes/admin`
- `npx playwright test tests/e2e/pages.spec.ts tests/e2e/admin-audit.spec.ts tests/e2e/admin-access.spec.ts`

## Риск

`high` — миграция `drizzle/*.sql` → bugbot + security-review.

## Фазы

- [x] SPEC
- [ ] Ответы владельца + «go» на миграцию 0003
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

2.10 Кеш публичных страниц и сброс при изменении из админки (`06` § 8.2; решение 2026-10-18: данные в памяти сервера, 60 с, сброс по группам, без новых библиотек, без Cache-Control для HTML).

- Модуль кеша: запись с группами (`settings`, `pages`, `posts`, `events`, `hero`), срок `CACHE_TTL_SECONDS` (по умолчанию 60; `0` — кеш выключен, так идут e2e: они пишут в базу SQL-ом мимо админки). Не больше 500 записей (старые вытесняются). Ошибка не кешируется. Одновременные одинаковые запросы ждут один запрос к базе.
- Ключ = имя запроса + его аргументы; функция получает ровно эти аргументы (ключ и запрос не разойдутся).
- Загрузка, начатая до сброса группы, свой результат в кеш не кладёт (иначе старое осталось бы на 60 с).
- Сброс: `hooks.server.ts` после любого не-GET запроса к `/admin/*` (после записи): `pages` → pages; `news` → posts; `events` → events; `hero` → hero; `settings` → settings; `users` → hero (персона); `media` и неизвестный раздел → все группы; `audit`, `roles`, `locale` — ничего.
- Публичные загрузки через кеш: подвал и SEO-база → settings; hero → hero + events; главная → events + posts + pages; события (список, города, архив, страница) → events; новости (список, страница, «читайте также») → posts; страницы и `/federation` → pages; `sitemap.xml` → pages + posts + events. Предпросмотр и админка — без кеша.
- Несколько машин Fly: у каждой свой кеш, на другой машине — до 60 с (в пределах «Готово, когда»).

## Файлы (ожидаемо)

- `src/lib/server/cache/memory.ts` (+ test) — кеш с группами
- `src/lib/server/cache/admin-groups.ts` (+ test) — раздел админки → группы
- `src/lib/server/cache/index.ts` — экземпляр, `CACHE_TTL_SECONDS`
- `src/hooks.server.ts`; `src/env.ts`; `.env.example`; `playwright.config.ts` (`CACHE_TTL_SECONDS=0`)
- публичные `+page.server.ts` / `+layout.server.ts` в `[[lang=lang]]/(site)`, `sitemap.xml/+server.ts`

## Не ломать

- e2e, пишущие в базу SQL-ом (`content-visibility`, `media-in-use`, hero) — с `CACHE_TTL_SECONDS=0`
- Черновики и будущие `published_at` не видны гостю (кеш — после фильтра видимости, ключ без пользователя)
- Предпросмотр в админке показывает несохранённое сразу (не кешируется)

## Проверка

- `npx vitest --run src/lib/server/cache`
- `npx playwright test tests/e2e/content-visibility.spec.ts tests/e2e/home.spec.ts tests/e2e/site-layout.spec.ts --workers=1`

## Риск

`high` — `hooks.server.ts`, `+server.ts`, `*.config.ts`, `.env.example`.

## Читать

- `06` § 8.2 — кеш с коротким сроком, сброс при изменении из админки
- `decisions.md` 2026-10-18 (2.10)

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

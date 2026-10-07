# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

2.1 Медиабиблиотека (`05` § 20): загрузка в R2 по подписанной ссылке, проверка типа и размера на сервере, alt, «где используется», используемый файл не удаляется.

Решения владельца (2026-10-07): R2 ещё не настроен — в тестах хранилище подменяется, ключи и CORS бакета владелец внесёт позже; типы JPEG, PNG, WebP, AVIF, PDF до 10 МБ (SVG нельзя — XSS); `media.original_name` + `media.deleted_at`, удаление мягкое, объект в R2 остаётся.

## Как работает

1. `?/sign` — сотрудник с `media.write` присылает имя, тип, размер → сервер проверяет (тип из списка, 1 байт … 10 МБ) → ключ `media/YYYY/MM/<uuid>.<ext>` → подписанная ссылка PUT (15 мин, тип и длина подписаны).
2. Браузер кладёт файл в R2 напрямую.
3. `?/complete` — ключ + имя → сервер: ключ нашего формата и ещё не в базе, HEAD объекта (есть, размер ≤ 10 МБ), первые байты объекта → тип по сигнатуре совпадает с расширением ключа. Не прошло — объект удаляется, ошибка. Прошло — строка `media` + журнал `media.upload`.
4. `/admin/media` — сетка, поиск по имени, фильтр «изображения / PDF», страницы; `/admin/media/[id]` — превью, ссылка (копировать), alt EN/HY/RU (`?/alt`, журнал `media.update`), «где используется», удалить (`?/delete`: в транзакции, есть использования → отказ со списком; иначе `deleted_at`, журнал `media.delete`).
5. «Где используется» — реестр поисков по ключу; сейчас из существующих таблиц только `users.avatar_key`. Таблицы 2.3+ (страницы, новости, события, hero, товары) добавляют свой поиск в реестр. Редактор видит вид использования, но не имя пользователя (у editor нет `users.read_*`).

## Миграция 0002 (Migration Gate — ждёт «go»)

- `ALTER TABLE media ADD COLUMN original_name text NOT NULL DEFAULT ''` → `ALTER ... DROP DEFAULT` (строк сейчас нет, но так безопасно и при наличии); `ADD COLUMN deleted_at timestamptz`.
- Откат `scripts/rollback/0002_down.sql`: `ALTER TABLE media DROP COLUMN deleted_at, DROP COLUMN original_name;` + убрать запись 0002 из `drizzle.__drizzle_migrations` и `drizzle/meta`. Теряются только имена файлов и отметки удаления.
- Применяется на `parkour_dev`; на прод — с ближайшим Deploy по апруву.

## Зависимости

`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — AWS SDK v3, уже в стеке (`01` «Технологии»).

## Файлы (ожидаемо)

- `src/lib/server/db/schema/service.ts`, `drizzle/0002_*.sql`, `scripts/rollback/0002_down.sql` — поля
- `src/lib/server/storage/r2.ts` — клиент R2 (подпись, HEAD, первые байты, удаление) за интерфейсом `Storage`
- `src/lib/validation/media.ts` (+ test) — типы, размер, сигнатуры, форма alt
- `src/lib/server/services/media/{upload,list,edit,usage}.ts` (+ tests) — логика
- `src/routes/admin/media/+page.{server.ts,svelte}`, `[id]/+page.{server.ts,svelte}` — раздел
- `src/env.ts`, `.env.example` — `R2_*`
- `tests/e2e/admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit.spec.ts`, `admin-permissions.spec.ts` — карты
- `src/lib/i18n/messages/*` — тексты

## Не ломать

- moderator и member не загружают, не правят и не удаляют (403 / 404), данные не меняются.
- Файл, указанный хоть где-то, не удаляется даже параллельным запросом (блокировка строки).
- Чужой ключ, ключ не нашего формата, объект с подменённым типом (HTML под `.png`) или больше 10 МБ — не попадают в библиотеку.
- Карты доступа и журнала (`access-coverage`, `audit-coverage`) — зелёные.

## Проверка

- `npm run test -- media`
- `npx playwright test admin-permissions admin-audit`

## Риск

`high` — миграция, `package.json`, права.

## Читать

`05` § 20 (прочитан), § 1 п. 9 · `02` § `media` (прочитан) · `04` 5.1 `media.write` (editor, admin) · `06` разд. 8 п. 5 (alt).

## Фазы

- [x] SPEC
- [x] Migration Gate «go» (0002 применена на `parkour_dev`)
- [x] RED (`test: … [RED]`) — `d069c29`
- [x] GREEN (`feat: … [GREEN]`) — `5e35445`; unit 213, e2e медиа / прав / журнала 7/7
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

Долг 3.10, шаги 2–3 (`06` § 5.2, `decisions.md` 2026-10-22). Одиночная задача вне этапа: после GREEN — `/review` (база — коммит перед RED).

**Шаг 2 — приватность.** В профиле кабинета блок «Приватность»: «Показывать город публично», «Показывать фото публично» (по умолчанию выключено). Фото участника публично — только при `show_avatar`:
- hero-персона (`hero/public.ts` `toSlide`): сейчас фото не отдаётся никогда → отдавать `avatarKey` при `show_avatar` (персона и так только взрослая);
- `/federation/team` (`staff/public.ts`): сейчас фото при (взрослый или согласие `privacy`) → **и** `show_avatar`. Следствие на проде: фото тренеров и судей пропадут, пока каждый не включит флаг (так в решении: «без флага публично нигде»).
- `show_city`: публично город участника сейчас нигде не выводится — флаг только хранится и правится (на будущее).
- `nosniff` на R2 — не в этой задаче (настройка бакета / Cloudflare, не код; в «Известные проблемы»).

**Шаг 3 — удаление аккаунта.**
- Кабинет, профиль: «Запросить удаление аккаунта» (подтверждение) → `deletion_requested_at = now()`; пока запрос висит — плашка «Запрос отправлен» и «Отменить запрос» (сброс в `null`). Только свой аккаунт, id из сессии.
- `/admin/users`: фильтр «Запросил удаление» (`deletion=requested`); в карточке при запросе — дата и кнопки «Удалить» / «Отклонить». Только admin (`actor.role === 'admin'`, как блокировка).
- «Удалить»: правила как у блокировки (`blockError`: не себя, не последнего активного admin) → `deleted_at = now()`, удаление всех сессий, журнал `user.delete` (before: `deletion_requested_at`), в одной транзакции под `lockActiveAdmins` + `lockTarget`. Только мягкое; журнал баллов, платежи, сертификаты остаются (`03` § 1 п. 6). Без запроса участника кнопки нет, сервис отвечает `not_requested`.
- «Отклонить»: `deletion_requested_at = null`, журнал `user.deletion_reject`.
- Удалённый уже не входит (`session.ts`, `auth/index.ts` проверяют `deleted_at`) и пропадает из списков. Email остаётся занят — обезличивание отдельной задачей (решение 2026-10-22).

## Migration Gate (ждёт «go»)

Одна миграция `drizzle/0017_users_privacy_deletion.sql` на оба шага (один «go» вместо двух):
```sql
ALTER TABLE "users" ADD COLUMN "show_city" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "show_avatar" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "deletion_requested_at" timestamp with time zone;
```
Только добавление колонок, строки не перезаписываются; на проде применится `release_command` при деплое. Откат — `scripts/rollback/0017_down.sql`: `ALTER TABLE "users" DROP COLUMN "deletion_requested_at", DROP COLUMN "show_avatar", DROP COLUMN "show_city";` + удалить запись 0017 из `drizzle.__drizzle_migrations` (откат — тоже только по «go»).

## Файлы (ожидаемо)

- `src/lib/server/db/schema/users.ts`, `drizzle/0017_*.sql`, `scripts/rollback/0017_down.sql`
- `src/lib/server/services/cabinet/{profile,deletion}.ts`, `validation/cabinet.ts`, `(site)/cabinet/profile/*` (форма приватности, блок удаления)
- `src/lib/server/services/hero/public.ts`, `staff/public.ts`
- `src/lib/server/services/users/{deletion,list,card}.ts`, `routes/admin/users/{+page.*,[id]/*}`
- `tests/e2e/admin-audit-map.ts`, `admin-access-map.ts`; i18n en / hy / ru

## Не ломать

- Фото в hero и у команды без `show_avatar` не уходит наружу; у несовершеннолетнего тренера — ещё и только с согласием `privacy`.
- Удалить может только admin, не себя и не последнего активного admin; модератор / editor — 403 на action.
- Удаление не трогает баллы, платежи, сертификаты; сессии удалённого гаснут сразу.
- Сохранение профиля не сбрасывает флаги приватности (отдельная форма).

## Проверка

- `npx vitest run src/lib/server/services/{cabinet,users,hero,staff}`
- e2e: `admin-permissions`, `admin-audit` (новые действия в картах)

## Риск

`high` — личные данные, удаление аккаунта, сессии, миграция.

## Читать

- `06` § 5.2; `03` § 1 п. 6; `04` § 6.3 (последний admin); `decisions.md` 2026-10-22 (кабинет) — выписано выше.

## Фазы

- [x] SPEC
- [ ] Migration Gate — «go»
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (одиночная задача)

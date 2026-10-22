# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`.

## Задача

Долг 3.10 (`06` § 5.2): фото профиля в кабинете — шаг 1 из 3 (дальше приватность, удаление аккаунта; решения — `decisions.md` 2026-10-22). Миграции нет: `users.avatar_key` уже есть.

Правила (решение владельца 2026-10-22):
- Ключ `avatars/<userId>/<uuid>.<ext>` (имя не от пользователя), строки в `media` нет.
- JPEG / PNG / WebP, 1 байт … 5 МБ; тип — по первым байтам загруженного объекта (`sniffMime`), не совпал или велик — объект удаляется.
- Завершить можно только свой ключ (`avatars/<свой id>/`); чужой или кривой — `bad_key`.
- Замена: новый ключ в `users.avatar_key` под блокировкой строки, после коммита старый объект удаляется (только если он под `avatars/<свой id>/`; файл медиатеки не трогать). «Удалить фото» — `avatar_key = null` + удаление объекта. Сбой удаления в R2 — предупреждение в лог, не ошибка.
- Лимит подписей: 10 в час на пользователя (`limits.avatarUploadPerUser`) — участник не может бесконечно лить файлы в бакет.
- Удалённый пользователь — `not_found`. Журнал действий не пишется (своё фото, не опасное действие; правка профиля тоже не пишется).
- Публичный hero: фото персоны не отдаётся (до флага `show_avatar`, следующий шаг). Админский поиск персоны (`/admin/hero/persons`) — аватар остаётся (сотрудники).
- Своё фото видно в профиле и на обзоре кабинета (`06` § 5.1 «аватар»); нет фото — инициалы, как сейчас. Нет R2 — понятное сообщение, не 500.

## Файлы (ожидаемо)

- `src/lib/validation/avatar.ts` (+ `.test.ts`) — типы, размер, ключ, схема запроса
- `src/lib/server/services/cabinet/avatar.ts` (+ `.test.ts`) — `signAvatarUpload`, `completeAvatarUpload`, `removeAvatar`
- `src/lib/server/auth/rate-limit.ts` — `avatarUploadPerUser`
- `src/routes/[[lang=lang]]/(site)/cabinet/profile/+page.server.ts` — действия `avatarSign`, `avatarComplete`, `avatarRemove`; `avatarUrl` в load
- `src/routes/[[lang=lang]]/(site)/cabinet/profile/AvatarForm.svelte` + `upload-avatar.ts` — загрузка (подпись → PUT в R2 → завершение)
- `src/lib/server/services/cabinet/overview.ts` + `cabinet/+page.svelte` — фото в приветствии
- `src/lib/server/services/hero/public.ts` (+ тест) — без фото персоны
- `src/lib/i18n/messages/{en,ru}-cabinet-avatar.ts` — тексты

## Не ломать

- Профиль: сохранение полей, смена email и пароля (`cabinet.spec`, `profile.test`).
- Медиатека: загрузка и «используется» для аватара (`admin-media.spec`, `upload.test`).
- Hero: персона — только имя совершеннолетнего, без контактов (`hero/public.test`, `hero-fields.spec`).

## Проверка

- `npx vitest run src/lib/validation/avatar.test.ts src/lib/server/services/cabinet src/lib/server/services/hero`
- `npx playwright test tests/e2e/cabinet.spec.ts tests/e2e/admin-media.spec.ts`

## Риск

`high` — личные данные (`profile`), загрузка файлов пользователем в публичный бакет.

## Читать

- `06` § 5.1, 5.2 — прочитано: в профиле «фото», на обзоре «аватар»
- `03` § 13 п. 3 — прочитано: фото несовершеннолетних публично только при согласии `privacy`
- `decisions.md` 2026-10-22, 2026-10-07 (2.1: типы, проверка по сигнатуре)

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

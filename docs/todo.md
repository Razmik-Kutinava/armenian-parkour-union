# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

1.6 `hooks.server.ts`: сессия, `locals.user`, заблокированный пользователь считается гостем (`09`; `04` разд. 5.2 п. 1, 6.8, 8; `03` разд. 1.5).

Плюс из «Известных проблем»: 301 `www.parkour.am` → `parkour.am`. Страницы только для гостя (`/login`, `/register`, `/forgot-password` — `06` разд. 3.1) уводят вошедшего на главную.

Устройство: нет cookie сессии — БД не трогаем, гость. Есть — `auth().api.getSession` на каждый запрос (без cookie-кеша: блокировка действует сразу). `role`, `status`, `deleted_at` отдаются Better Auth как `additionalFields` с `input: false` (через регистрацию не задать). `blocked` или `deleted_at` → `locals.user = null`.

## Файлы (ожидаемо)

- `src/lib/server/auth/session.ts` (+ тест) — `toLocalsUser()`: из пользователя сессии в `locals.user` или `null`
- `src/lib/server/auth/canonical-host.ts` (+ тест) — редирект с `www.`
- `src/lib/server/auth/index.ts` — поля `role`, `status`, `level`, `deletedAt` (`input: false`)
- `src/hooks.server.ts`, `src/app.d.ts` — `locals.user`
- `src/routes/[[lang=lang]]/(site)/(auth)/{login,register,forgot-password}/+page.server.ts` — вошедшего на главную
- `tests/e2e/auth.spec.ts` — блокировка действует сразу, вошедший не видит `/login`

## Не ломать

- Гость открывает сайт без запросов к БД сессий; i18n и редирект `/en` из 1.3.
- Сценарии 1.5 (регистрация, вход, выход, сброс, лимиты).
- Заблокированный теряет доступ на следующем же запросе, не дожидаясь конца сессии.

## Проверка

- `npm test`, `npm run test:e2e`
- `npm run check`, `npm run lint`

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

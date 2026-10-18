# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

1.5g Вход через Google (этап 1, решение 2026-10-06; правила — `decisions.md` 2026-10-18). Без миграции: `account` Better Auth уже есть.

- Кнопка «Войти через Google» на `/login` и `/register` → POST → `signInSocial` → Google. Ограничение попыток — тот же счётчик `sign-in:ip`.
- Колбэк `/api/auth/callback/google` — единственный смонтированный маршрут Better Auth (`+server.ts`, только GET).
- Новый пользователь: аккаунт с именем и фамилией из Google, email подтверждён Google, фото не сохраняем (`02` разд. 1). Пока нет согласия (`terms_accepted_at`) у пользователя с Google — любая страница ведёт на `/complete-profile` (кроме неё и `/logout`); форма: имя, фамилия, дата рождения, данные родителя до 18 (`03` разд. 13), согласие → сохраняет и пускает дальше.
- Тот же email: Google привязывается автоматически (Google — доверенный провайдер), email подтверждается. Исключение (безопасность, захват аккаунта): локальный email не подтверждён — не привязываем, сообщение «войдите по паролю и подтвердите email» (поведение Better Auth по умолчанию).
- Ошибки колбэка → `/login?error=…`: заблокирован → «аккаунт заблокирован»; не привязан → сообщение выше; прочее → «не удалось войти через Google».
- Нет `GOOGLE_CLIENT_ID/SECRET` — кнопки нет.

## Файлы (ожидаемо)

- `src/lib/server/auth/index.ts` — `socialProviders.google`, `accountLinking`, `onAPIError.errorURL`
- `src/lib/server/auth/google.ts` — старт входа, разбор ошибки колбэка
- `src/lib/server/auth/profile-gate.ts` (+ test) — кто должен дополнить профиль, куда пускать
- `src/lib/server/auth/complete-profile.ts` (+ test) — сохранение формы
- `src/lib/validation/profile.ts` (+ test) — схема формы
- `src/routes/api/auth/callback/google/+server.ts`; `src/hooks.server.ts`; `src/env.ts`
- `src/routes/[[lang=lang]]/(site)/(auth)/{login,register,complete-profile}/`
- `tests/e2e/google-auth.spec.ts`; `src/lib/i18n/messages/{en,ru}-google.ts`

## Не ломать

- Вход и регистрация по паролю, `returnTo` только внутренний (`auth.spec`)
- Заблокированный не входит и вылетает сразу (в том числе через Google)
- Данные родителя хранятся только для младше 18
- Гость без cookie сессии — без запроса к базе (`hooks.server.ts`)

## Проверка

- `npx vitest --run src/lib/server/auth src/lib/validation`
- `npx playwright test tests/e2e/google-auth.spec.ts tests/e2e/auth.spec.ts --workers=1`

## Риск

`high` — авторизация, `hooks.server.ts`, `+server.ts`, личные данные.

## Читать

- `06` § 4.11 — регистрация: имя, фамилия, дата рождения, согласие, родитель до 18; возврат только внутренний
- `02` разд. 1 — `image` → `avatar_key`, URL фото Google не сохраняется

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

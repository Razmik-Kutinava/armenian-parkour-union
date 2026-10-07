# Сделано — этап 1 (архив)

Формат: `дата | задача | итог | коммит`. Переносится из `PROGRESS.md` («Сделано»), когда там больше 5 записей.

- 2026-10-07 | 1.10a | «Пользователи» (список с фильтрами и видимостью по роли, карточка «Профиль» / «История», правка, роль, блокировка с удалением сессий, подтверждение email, создание с письмом «задайте пароль»), «Админы и роли» (последний вход из сессий), `audit.ts` в транзакции действия; unit 158 + e2e 42; REVIEW: 0 / 0 | `7d1f517`
- 2026-10-07 | 1.9 | оболочка админки: меню по правам роли, крошки, язык из профиля (`/admin/locale`), DataTable, FilterBar, Pagination, FormLayout, ConfirmDialog (демо на `/dev/design`); unit 123 + e2e 35; REVIEW: 0 / 0 | `feat: …`
- 2026-10-07 | 1.8 | шапка, подвал из `site_settings` (только `https:`-ссылки), переключатель языка, страницы 404/403/500; unit 107 + e2e 28; REVIEW: bugbot 0, security 1 (C6 исправлено) | `feat: …`
- 2026-10-07 | 1.7 | матрица прав = `04` 5.1, `can`/`requirePermission`, `/admin`: гость → вход, участник → 404; правила смены роли и блокировки; unit 87 + e2e 21; REVIEW: 0 / 0 | `feat: …`
- 2026-10-07 | 1.6 | сессия → `locals.user`, блокировка действует со следующего запроса, редирект `www`; unit 73 + e2e 15; REVIEW: bugbot 0, security 0 | `feat: …`
- 2026-10-07 | 1.5 | авторизация на form actions + Better Auth, свои лимиты попыток, защита адреса возврата; unit 67 + e2e 13; REVIEW: bugbot 1 (исправлено), security 5 (C1 исправлено, остальные не K / приняты) | `feat: …`
- 2026-10-07 | trim | заметки «В работе» по закрытым 1.1–1.9 (перенесены из `PROGRESS.md`):
  - 1.1–1.4: дизайн, компоненты `src/lib/components/ui/`, i18n `src/lib/i18n/`, схема `src/lib/server/db/schema/`.
  - 1.5: `/register` (родитель до 18), `/login`, `/logout`, `/verify-email`, `/forgot-password`, `/reset-password`; сервисы `src/lib/server/auth/`, Zod `src/lib/validation/`. Письма — в лог.
  - 1.6: `hooks.server.ts` читает сессию на каждом запросе с cookie (без cookie — гость без запроса к БД), `locals.user` (`src/lib/server/auth/session.ts`, без контактов и даты рождения); `blocked` / `deleted_at` → гость сразу; 301 `www.` → голый домен; `/login`, `/register`, `/forgot-password` уводят вошедшего на главную.
  - 1.7: `permissions.ts` (= `04` 5.1), `guard.ts` (`requireStaff`, `requirePermission`), `role-rules.ts`. `/admin` — заглушка до 1.9.
  - 1.8: layout `(site)` — шапка (`src/lib/components/site/`), подвал из `site_settings` (`services/site-settings.ts`, схемы `validation/site-settings.ts`), переключатель языка, 404 внутри сайта (`[...rest]`), `+error.svelte` (5xx без деталей). Меню ведёт на ещё не созданные страницы (404).
  - 1.9: `routes/admin/+layout*`, меню `src/lib/server/admin/nav.ts`, компоненты `src/lib/components/admin/` + `list-state.ts` (25 на страницу, сортировка и фильтры только из списка разрешённых). Язык админки — `users.locale`, `currentLocale()` берёт `page.data.locale`. `/admin` — заглушка дашборда.
- 2026-10-07 | 1.4 | миграция `0001` (8 таблиц, 3 enum, триггер append-only) на `parkour_dev`; тесты БД в транзакции с откатом: 5 | `feat: …`
- 2026-10-07 | 1.3 | i18n без библиотек, `[[lang=lang]]`, `<html lang>`, редирект `/en`; unit 24 + e2e 5 | `feat: …`
- 2026-10-07 | 1.2 | 10 базовых компонентов, Lucide (`@lucide/svelte`), тесты: очередь тостов, клавиатура вкладок; проверено в браузере (Esc, фон, 5 с, стрелки) | `feat: …`
- 2026-10-07 | 1.1 | токены `app.css`, шрифт APU Sans (Arian AMU, woff2 58/41 КБ), орнамент, `/dev/design`, тест контраста токенов; `@fontsource` удалён | `be1bb87` + `feat: …`
- 2026-10-07 | trim | заметка «В работе» 1.10: `/admin/users`, `/admin/roles`, `/admin/audit` (+ `[id]`, `export`), `/admin/settings`; сервисы `services/users/`, `services/audit.ts` (`writeAudit` — в транзакции действия), `audit-list.ts`, `site-settings.ts` (`saveSettings`).

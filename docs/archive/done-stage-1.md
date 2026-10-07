# Сделано — этап 1 (архив)

Формат: `дата | задача | итог | коммит`. Переносится из `PROGRESS.md` («Сделано»), когда там больше 5 записей.

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

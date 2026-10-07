# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

1.8 Общий каркас сайта: шапка, подвал, переключатель языка, страницы ошибок (404, 403, 500). Источники: `06` разд. 2, 3.3, 9; `08` разд. 8.2 (LanguageSwitcher), 9, 11, 12.

Решения владельца (2026-10-07): формат `site_settings` для подвала фиксируем по `05` разд. 21, пустой или битый ключ — блок скрыт; меню полностью по `06` разд. 2 (пока страниц нет — 404); переключатель — ссылки, сохранение `users.locale` — в кабинете (этап 5).

- Шапка: логотип (название), меню События / Новости / Федерация / Магазин / Поддержать, переключатель языка; гость — «Войти» / «Вступить»; вошедший — меню с именем: Кабинет, Выйти (POST `/logout`), для editor / moderator / admin ещё «Админка». На мобильных меню сворачивается. Работает без JS.
- Подвал: контакты, соцсети, текст, реквизиты из `site_settings`; ссылки «О федерации» `/federation`, «Правила» `/pages/rules`, «Политика конфиденциальности» `/pages/privacy`; переключатель языка.
- «Перейти к содержимому», `header` / `nav` / `main` / `footer`.
- Ошибки: 404, 403, остальное — общий текст 500 без технических деталей, ссылка на главную на языке страницы.
- Формат ключей: `contacts {email?, phone?, address?: LocalizedText, mapUrl?: https}`, `socials {instagram?, youtube?, telegram?, facebook?, tiktok?: https}`, `footer {text?: LocalizedText}`, `requisites {text?: LocalizedText}`; `LocalizedText = {en, hy?, ru?}`, нет перевода — `en`.

## Файлы (ожидаемо)

- `src/lib/i18n/localized.ts` — `LocalizedText`, `pickLocalized`
- `src/lib/validation/site-settings.ts` — Zod-схемы ключей подвала (их же возьмёт админка 1.10)
- `src/lib/server/services/site-settings.ts` — `getFooterSettings(db, locale)`
- `src/routes/[[lang=lang]]/(site)/+layout.server.ts`, `+layout.svelte`, `+error.svelte`; `src/routes/+error.svelte`
- `src/lib/components/site/` — `SiteHeader`, `UserMenu`, `LanguageSwitcher`, `SiteFooter`, `ErrorView`, `error-message.ts`
- `src/lib/i18n/messages/en.ts`, `ru.ts`; `(auth)/+layout.svelte` и главная — без своего `<main>`

## Не ломать

- Вход, регистрация, выход (e2e `auth.spec.ts`).
- `/admin`: гость → вход, участник → 404 (e2e `admin-access.spec.ts`).
- Из `load` не уходят email, дата рождения, контакты пользователя (`04` разд. 4) — в шапку только имя и признак сотрудника.
- Ссылки из `site_settings` только `https:` (нет `javascript:` в `href`).

## Проверка

- `npm run test`
- `npm run test:e2e`

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

8.3 Мультиязычность: перевод интерфейса на армянский и русский, включение языков, `hreflang`.

Уже есть (этапы 1–2): три языка, английский без префикса, `/hy` и `/ru`; переключатель; `hreflang` и `og:locale:alternate`; sitemap с `xhtml:link`; словари `hy` и `ru` покрывают все ключи (`translate.test`); контент из базы без перевода — английский (тесты событий, новостей, страниц, главной, пожертвований, магазина, тренеров, кабинета).

Решения (агент):
1. Включение языков (`06` § 1: «армянский и русский включаются по мере готовности переводов»; § 7.4 «`hreflang` для включённых языков») — ключ `site_settings.locales` = `{ enabled: [...] }`. Нет ключа или он сломан — включены все три (на проде ничего не меняется). Английский выключить нельзя. Порядок — как в `locales`.
2. Вкладка «Языки» в `/admin/settings` (только admin, `settings.write`); сохранение — через `writeSettings` (`settings.update` в журнал). Кеш: `/admin/settings/*` сбрасывает группу `settings`.
3. Выключенный язык: его адреса — `302` на ту же страницу по-английски (временно: язык могут включить), из `(site)/+layout.server.ts` (`hooks.server.ts` не трогаем). Пропадает из переключателя, `hreflang`, `og:locale:alternate`, sitemap. `/admin` — по языку профиля, как раньше.
4. Не делается: выбор языка в профиле и язык писем — по-прежнему все три (письмо со ссылкой `/hy/...` при выключенном армянском ведёт на английскую страницу). Вычитка переводов — носителем языка (владелец).

## Файлы (ожидаемо)

- `src/lib/server/services/site-locales.ts` (+ `.test.ts`) — `parseSiteLocales`, `siteLocales`, `saveSiteLocales`
- `src/lib/i18n/locales.ts` (+ `locales.test.ts`) — `disabledLocaleRedirect`
- `src/lib/seo/alternates.ts`, `meta.ts`, `sitemap.ts` (+ тесты) — список включённых языков
- `src/lib/server/services/seo/base.ts` (+ тест) — `locales` в `SeoBase`
- `src/routes/[[lang=lang]]/(site)/+layout.server.ts`, `src/routes/sitemap.xml/+server.ts`, `LanguageSwitcher.svelte`
- `src/routes/admin/settings/languages/*`, `SettingsTabs.svelte`, `i18n/messages/*-system.ts`

## Не ломать

- Без ключа `locales` всё как сейчас: три языка в переключателе, `hreflang`, sitemap.
- `/en/...` → `/...` (308) и английские адреса без префикса.
- Сохранить настройку может только admin; изменение — в `audit_log`.

## Проверка

- `npx vitest --run src/lib/server/services/site-locales src/lib/i18n src/lib/seo src/lib/server/services/seo`

## Риск

normal (настройка сайта и SEO; без прав, денег и схемы)

## Читать

- `06` § 1 п. 2, § 7.4 (прочитано: языки включаются по готовности; `hreflang` для включённых)
- `03` § 12 п. 3 (прочитано: нет перевода — английский)

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW

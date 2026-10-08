# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

2.8 SEO (`09`): title, description, Open Graph, `sitemap.xml`, `robots.txt`, микроразметка событий и статей. 2.6 (hero) припаркована: SPEC — `git show 7a7041b:docs/todo.md`, вернуть после 2.8.

## Читать (выписано)

- `06` § 7: у каждой публичной страницы title, description, Open Graph (изображение), canonical; `sitemap.xml` из событий, новостей, страниц, товаров; `robots.txt` закрывает `/cabinet`, `/admin`, `/api`, `/certificate`; микроразметка `Event`, `Article`, `Organization`, `Product`; `hreflang` для включённых языков.
- `06` § 4.3, 4.4: `Event` и `Article` — уже есть (`lib/seo/event.ts`, `meta.ts`, 2.4–2.5).
- `06` § 1: EN без префикса, `/hy`, `/ru`; все три включены (переключатель, маршруты).
- `05` § 21 / решение 2026-10-07: `site_settings.site_name`, `seo_description` (`{en,hy,ru}`).

## Что уже есть / чего нет

- Есть: `buildSeo` + `SeoHead` на `/news`, `/news/{slug}`, `/events`, `/events/archive`, `/events/{slug}`; `Article`, `Event` JSON-LD.
- Нет: SEO главной, `/federation`, `/pages/{slug}` (только `<title>`); `hreflang`; `Organization`; название сайта в SEO берётся из перевода, а не из `site_settings`; `seo_description` нигде не выводится; `sitemap.xml` нет; `robots.txt` — статичный «разрешить всё»; страницы входа индексируются.
- Товаров (`Product`) нет — этап 7.

## Правила реализации (решения агента)

- Название сайта в title / `og:site_name` / разметке — `site_settings.site_name` (как шапка и подвал в 2.7), откат на перевод `site.name`. Описание по умолчанию — `seo_description`, откат на перевод `site.description`.
- `hreflang`: на каждой SEO-странице `<link rel="alternate">` для en / hy / ru + `x-default` = en; тот же query, что у canonical; `og:locale:alternate` для двух других языков.
- Главная: title = название сайта (без « — название»), description = `seo_description`, `Organization` JSON-LD (name, url, `sameAs` — соцсети из настроек, email / телефон из контактов, если заданы). Логотипа нет — без `logo` и `og:image`.
- `/federation`, `/pages/{slug}`: title = заголовок, description = начало текста или `seo_description`, canonical (`about` → `/federation`).
- `sitemap.xml` (`+server.ts`): главная, `/events`, `/events/archive`, `/news`, страницы (`published`, не удалены; `about` → `/federation`), новости (видимые: `published`, дата наступила, не удалены), события (открываемые по ссылке: `published` / `finished` / `cancelled`, дата публикации наступила, не удалены). Каждый адрес ×3 языка с `xhtml:link` hreflang + x-default; `lastmod` = `updated_at` (кроме списков). Условия видимости — те же, что у публичных сервисов (экспорт, не копия). Заголовок `Cache-Control: max-age=3600`.
- `robots.txt` (`+server.ts`, статичный файл удалить): `Disallow` `/admin`, `/api`, и `/cabinet`, `/certificate` для `/`, `/hy`, `/ru`; `Sitemap:` абсолютный адрес (`PUBLIC_SITE_URL` или origin).
- Вход, регистрация, сброс пароля, подтверждение email, выход: `<meta name="robots" content="noindex">` (в `robots.txt` не закрываем — иначе поисковик не увидит noindex).

## Файлы (ожидаемо)

- `src/lib/seo/meta.ts` (+ `alternates.ts`, `organization.ts`), `src/lib/components/site/SeoHead.svelte`, `ContentPage.svelte`
- `src/lib/seo/sitemap.ts`, `src/lib/seo/robots.ts` — чистая сборка XML / текста
- `src/lib/server/services/seo/base.ts` (название, описание, адрес сайта), `services/seo/sitemap.ts` (адреса из БД); `posts/public.ts`, `events/public.ts` — экспорт условий видимости; `posts/view.ts`, `events/view.ts` — база SEO
- `src/routes/sitemap.xml/+server.ts`, `src/routes/robots.txt/+server.ts`; удалить `static/robots.txt`
- `src/routes/[[lang=lang]]/(site)/+page.server.ts` (новый), `+page.svelte`; `federation/`, `pages/[slug]/`, `news/`, `events/`, `events/archive/` `+page.server.ts`; `(auth)/+layout.svelte`
- i18n: `site.description` (en, ru)

## Не ломать

- SEO новостей и событий (e2e `news.spec`, `events.spec`: og, canonical, JSON-LD).
- Видимость: черновик, запланированная, удалённая новость; черновик / архивное событие; черновик страницы — **не** попадают в `sitemap.xml`.
- `/pages/about` → 301 на `/federation`; `/en/...` → 308.

## Проверка

- `npx vitest run src/lib/seo src/lib/server/services/seo`
- `npx playwright test tests/e2e/seo.spec.ts tests/e2e/news.spec.ts tests/e2e/events.spec.ts tests/e2e/pages.spec.ts tests/e2e/home.spec.ts`

## Риск

`high` — новые `+server.ts` (по таблице SBR); прочее — серверная логика без прав и данных участников.

## Фазы

- [x] SPEC
- [ ] RED · GREEN · REGRESS · REVIEW · DEPLOY

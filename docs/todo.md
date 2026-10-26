# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

8.4 Скорость: проверка на мобильных (Lighthouse), оптимизация изображений, кеш, подгрузка тяжёлых библиотек по требованию.

Замер до (Lighthouse 12, мобильный, прод Fly v22, 2026-10-25): главная **83** (LCP 3,7 с — заглушка hero 1600 px, 130 КБ; 1 МБ всего), `/events` 98, `/news` 99, `/shop` 99 (списки пустые). Потери главной: фон фестиваля JPG 297 КБ грузится сразу, хотя ниже первого экрана; постер PNG 190 КБ; превью YouTube `maxresdefault` 130 КБ; у шрифтов, логотипа и картинок из `static/` нет срока кеша (`adapter-node` отдаёт `static/` без `Cache-Control`, только `/_app/immutable/` — на год). JS: словари всех трёх языков (с текстами админки и кабинета) — один чанк 340 КБ / 80 КБ gzip на каждой странице. TipTap (400 КБ) уже только на страницах редактора админки.

Решения (агент):
1. Свои картинки и шрифты — через Vite (`src/lib/assets/`): имя с хешем → `/_app/immutable/`, кеш на год без своего сервера. В `static/` остаётся только то, чему нужен постоянный адрес: `favicon.svg`, `og-default.png`, `logo-square.svg` (PDF), фон фестиваля JPG (`og:image` главной).
2. Заглушки — WebP 800 и 1600 px, `srcset` + `sizes`; фон фестиваля — WebP 800 / 1280, лениво; постеры — WebP; логотип в шапке — `svgo` (точность 1 знак, 92 → 47 КБ). Конвертация — разово (Pillow, `npx svgo`), библиотек в проект не добавляется.
3. Шрифты (`woff2`, `ttf` для PDF, `LICENSE.txt`) → `src/lib/assets/fonts/apu-sans/`; `preload` — 400 и 700 (`08` § 4.2: текст и заголовок).
4. Превью видео фестиваля — `srcset` `hqdefault` / `sddefault` / `maxresdefault`.
5. Словари `hy` / `ru` в браузере грузятся по требованию (`loadLocale` в `+layout.ts` корня и админки), английский — всегда (запасной); на сервере — все сразу (письма и cron без запроса страницы).
6. Не делается: несколько размеров и WebP для **загружаемых** картинок (R2) — нужен выбор владельца (вопрос), кеш-заголовки `media.parkour.am` — правило кеша Cloudflare (владелец); HTML по-прежнему без `Cache-Control` (`decisions.md` 2026-10-18).

## Файлы (ожидаемо)

- `src/lib/assets/{placeholders,fest,brand,fonts/apu-sans}/*` (из `static/`)
- `src/lib/components/site/placeholder-photo.ts` (+ `.test.ts`), `EventCard`, `NewsCard`, `hero/HeroBlock`, `FestAnnouncement`, `ParkourVideo`, `SiteHeader`
- `src/app.css`, `src/routes/+layout.svelte`, `services/certificates/pdf-draw.ts` (пути шрифтов)
- `src/lib/i18n/translate.ts`, `dictionaries.ts` (+ тест), `src/routes/+layout.ts`, `src/routes/admin/+layout.ts`
- `tests/e2e/speed.spec.ts`

## Не ломать

- Тексты на `hy` / `ru` на сервере и после гидратации (переключатель языка, админка на языке профиля); письма на языке участника.
- PDF сертификата со шрифтом и логотипом; `og:image` главной.
- Карточки и hero без своей обложки — заглушка; со своей — она.

## Проверка

- `npx vitest --run src/lib/i18n src/lib/components/site src/lib/server/services/certificates/pdf`
- `npx playwright test tests/e2e/speed.spec.ts` + Lighthouse главной локально до / после

## Риск

normal (вёрстка и загрузка ресурсов, i18n на всех страницах; без прав, денег и схемы)

## Читать

- `06` § 7 п. 5, § 8 (прочитано: WebP / AVIF, несколько размеров, размеры заранее, лениво кроме первого экрана; тяжёлое — по требованию)
- `08` § 4.2, § 13 (прочитано: свой домен, `preload` текста и заголовка; hero — современный формат, без «прыжков»)

## Фазы

- [x] SPEC
- [x] RED `b252882`
- [x] GREEN — Vitest задачи 74/74, e2e `speed` + `home`, `i18n`, `admin-shell`, `csp` (видео), `certificate` 23/23, check 0, lint чистый. Lighthouse локально (`vite preview`, HTTP/1.1, dev-база): главная 73 → 85, LCP 6,2 → 3,7 с, вес 1122 → 555–613 КБ; `/hy` 74 → 85. Прод — замерить после деплоя (HTTP/2, ожидается лучше)
- [ ] REVIEW

Сделано сверх SPEC: превью YouTube — WebP (`vi_webp`, 69 КБ вместо 133). Уменьшенный постер 400 px пробовал — при плотности экрана ≥ 1,75 браузер берёт полный, убрал.
Замечено (не моё): точка входа `app.js` после 8.7 — 43 КБ, из них ~34 КБ не используются на главной (браузерный Sentry) — проверить в REVIEW этапа, не грузить ли его лениво.

---

## Параллельно: 8.6 Безопасность (заголовки, `form-action`, чек-лист `04` § 8)

Уже есть (не трогаем): лимиты (`auth/rate-limit.ts`), CSP (`csp.config.ts`), проверка загрузок (media / avatar / consents), права на сервере и тесты `04` § 8 — сверка ниже.

Решения (агент):
1. Заголовки на каждый ответ хуков (страницы, `+server.ts`, редирект `www`): `Strict-Transport-Security: max-age=31536000` (без `includeSubDomains` и `preload` — поддомены не проверены), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin` (Google и оплата — переходом, не окном), `Permissions-Policy` — камера, микрофон, геолокация, оплата, USB, `browsing-topics` выключены. Заданный маршрутом заголовок не перезаписывается.
2. `form-action 'self' https://accounts.google.com https://checkout.vpos.am`: кнопка Google — обычная форма, оплата без JS — тоже (с JS — `location.href`, `form-action` не действует). Chrome проверяет и редиректы после формы.
3. Не делается: заголовки на файлах `static/` и `/_app/immutable/` (`adapter-node` отдаёт их до хуков); отчёты о нарушениях CSP в Sentry (`report-uri` из `SENTRY_DSN`) — отдельным шагом по просьбе.

Файлы: `src/lib/server/http/security-headers.ts` (+ `.test.ts`), `src/hooks.server.ts`, `csp.config.ts`, `tests/e2e/csp.spec.ts`.
Не ломать: вход через Google (форма → `accounts.google.com`); оплата и донат (редирект на `checkout.vpos.am`, mock — на себя); видео YouTube в iframe; PDF сертификата (редирект на подписанную ссылку R2).
Проверка: `npx vitest --run src/lib/server/http`; e2e `csp.spec` — CI (параллельный чат 8.4 держит порт 4173).
Риск: high (`hooks.server.ts`, `*.config.ts`).
Читать: `04` § 5–6, § 8 (прочитано).

Чек-лист `04` § 8 → тесты: чужие платежи / сертификаты / заказы по `id` — `cabinet/payments.test`, `cabinet/progress.test` («PDF key: own»), `cabinet/orders.test`; редактор и модератор на всех страницах и action админки — `e2e/admin-permissions.spec` + `auth/permissions.test`; модератор без баллов и сертификатов — `points/adjust.test`, `certificates/issue.test`, `e2e/admin-points`, `e2e/admin-certificates`; последний админ — `users/account.test`; блокировка сразу — `e2e/admin-users`, `e2e/admin-block`, `auth/session.test`; вебхук без подписи — `payments/webhook.test`, `providers/vpos-webhook.test`, `providers/mock.test`.

- [x] SPEC
- [x] RED `dd6df7e`
- [x] GREEN

---

## Параллельно: 8.11 Сквозные сценарии Playwright

Вступление и оплата, регистрация на событие, выдача сертификата, заказ в магазине — каждый одной цепочкой через интерфейс, от гостя / регистрации до того, что участник видит в кабинете, с переходами между участником и сотрудником.

Решения (агент):
1. Тесты на существующее поведение, кода приложения нет — одним коммитом `test: 8.11` (как 6.10), без RED / GREEN.
2. Оплата взноса — ручная запись админом (`/admin/payments/new`, тип «взнос», email плательщика): e2e-сервер — прод-сборка, mock там 404, VPOS ждёт доступов (3.13). Онлайн-цепочка провайдера — Vitest `payments/acceptance-*.test.ts`; живая — 8.12.
3. SQL — только там, где интерфейса нет или он покрыт другой цепочкой: ссылка подтверждения почты (токен Better Auth `{ email }`, HS256, как `cabinet.spec`), членство для события и экзамена (его даёт цепочка взноса), «прошло время» (событие сдвигается в прошлое перед днём события), недостающие правила баллов (в CI база не сидится), проверки в конце.
4. Цепочка взноса не трогает `/join` и сумму взноса: `membership_fee` в CI вставляет и удаляет `membership.spec` параллельно (`zone-notes` § «Платежи»).
5. Новые товары открываются по адресу, не из каталога: опубликованные товары прошлых прогонов не удаляются, первая страница каталога может быть занята.

Файлы: `tests/e2e/journey-actors.ts` (регистрация, подтверждение почты, роль, членство), `tests/e2e/journey-membership.spec.ts`, `journey-event.spec.ts`, `journey-certificate.spec.ts`, `journey-shop.spec.ts`.
Не ломать: остальные e2e (общая база, лимит регистраций по IP — сброс в `beforeEach`; правила баллов — только вставка недостающих).
Проверка: `npx playwright test tests/e2e/journey-` ; `npm run check`, `npm run lint`.
Риск: low (только тесты).
Читать: `09` этап 8; `zone-notes` § «Платежи», «Регистрации и события», «Экзамены и сертификаты», «Видео и магазин» (прочитано).

- [x] SPEC
- [x] Сценарии зелёные — 4/4, повтор `--repeat-each=2` 8/8 (локально, `parkour_dev`); check 0, lint чистый

Замечено: тип в `/admin/payments/new`, выбранный до гидратации, сбрасывается на «пожертвование» — взнос молча записывается пожертвованием с email участника (первый прогон поймал). Не чинил — вне задачи; заметка — `zone-notes` § «Платежи».

---

## Фикс: выбор в `<select>` до гидратации

Svelte 5.57 при гидратации выставляет `<select bind:value>` по состоянию и затирает выбор пользователя (у `<input>` и чекбоксов Svelte это сам сохраняет, у `<select>` — нет). Затронуты все `Select`; опасно в `/admin/payments/new`: тип (взнос → пожертвование) и валюта (USD → AMD).

Решение: в `ui/Select.svelte` подключение (`{@attach}`, выполняется до эффекта `bind:value`): если в разметке сервера выбрана одна опция (`defaultSelected`), а в DOM уже другая — значение берётся из DOM.
Файлы: `src/lib/components/ui/Select.svelte`, `tests/e2e/admin-payments.spec.ts`.
Не ломать: формы админки с `Select` (значение из `form.values` после ошибки, переход без перезагрузки — в DOM нет `selected`, правило не срабатывает).
Проверка: `npx playwright test tests/e2e/admin-payments.spec.ts tests/e2e/journey-membership.spec.ts`.
Риск: normal (общий компонент формы; деньги — только через верный тип и валюту).

- [x] SPEC
- [ ] RED
- [ ] GREEN

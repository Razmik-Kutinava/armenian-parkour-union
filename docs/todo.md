# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.4 — PDF книжки и раздел «Волонтёрство» в кабинете: QR, «Скачать PDF», блок «Плюшки» (`03` 19.2 п. 3, 19.3, 19.8; `06` 5.12 — блоки «Книжка» (`active`) и «Плюшки»; `05` 28 — «Скачать PDF» в карточке). Миграции нет. «Мои использования» — 10.7, приглашения — 10.8, страница проверки — 10.5.

## Файлы (ожидаемо)

- `src/lib/server/services/volunteer/perks-visible.ts` (+ test) — видимые партнёры и плюшки (`03` 19.3): партнёр и плюшка `published`, сегодня по Еревану внутри `valid_from…valid_until`; у `single` — остаток по книжке (лимит − отметки + обратные, не меньше 0). Одна функция для кабинета, PDF и 10.5
- `src/lib/server/services/volunteer/card-pdf.ts` (+ test) — содержимое PDF: книжка по `userId` (кабинет) или `id` (admin), `active` и действительна (`cardValidity`), иначе `null`; номер, имя (`holderName`), `avatarKey`, «действительна до», адрес проверки `/hy/volunteer/{token}`, партнёры, «актуально на»; язык — параметр
- `src/lib/server/services/volunteer/card-pdf-images.ts` (+ test) — байты фото и логотипов для pdf-lib (только JPEG / PNG): из `media.parkour.am` — через Cloudflare Image Transformations `format=jpeg`, иначе оригинал по `publicUrl`; тип по сигнатуре; ошибка, таймаут, WebP без преобразования — `null`
- `src/lib/server/services/volunteer/card-pdf-render.ts` (+ test) — pdf-lib, A4 книжная: логотип, заголовок, фото, имя, номер, «действительна до», QR, список партнёров (логотип, плюшка, условия; перенос строк и страниц), «актуально на». Шрифты, QR, цвета — из `certificates/pdf-draw.ts`
- маршруты: `[[lang=lang]]/(site)/cabinet/volunteer/pdf/+server.ts` (своя книжка, язык страницы), `admin/volunteer/cards/[id]/pdf/+server.ts` (`volunteer.manage`, язык админки); `cabinet/volunteer/+page.server.ts` + `CardBlock.svelte` (QR, «Скачать PDF») + новый `PerksBlock.svelte`; `admin/volunteer/cards/[id]/+page.svelte` (кнопка); `card-own.ts` (+ test) — адрес проверки и плюшки только у действительной
- `src/lib/server/auth/rate-limit.ts` — лимит `volunteerPdfPerUser`; переводы `{en,hy,ru}-volunteer-cards.ts` (PDF, «Плюшки»)
- e2e: `tests/e2e/volunteer-cards.spec.ts` (скачать свою, чужая и недействительная — 404, admin из карточки), `tests/e2e/admin-access-map.ts` — строка `GET /admin/volunteer/cards/[id]/pdf` (файл 227 строк — см. «Открыто»)

## Решения агента (в пределах документов)

1. PDF не хранится (`03` 19.8): собирается на каждый запрос, ответ `application/pdf`, `Content-Disposition: attachment; filename="{номер}.pdf"`, `cache-control: no-store`. Журнал не пишется — скачивания нет в `03` 19.9.
2. Скачать — только действительная книжка, и admin тоже (`03` 19.2 п. 3: недействительной PDF недоступен): иначе 404, кнопка не показывается. Чужая книжка в кабинете — невозможно (id из сессии).
3. Язык: кабинет — язык страницы (`[[lang]]`, без префикса — английский); admin — язык админки (`user.locale`, как `admin/+layout.server.ts`). Тексты плюшек — язык, иначе EN. QR и адрес под ним — всегда `PUBLIC_SITE_URL` + `/hy/volunteer/{token}` (`06` 4.12).
4. Фото и логотипы: pdf-lib не встраивает WebP / AVIF, библиотек не добавляем — сервер берёт вариант `cdn-cgi/image/width=…,fit=scale-down,format=jpeg[,background=white]/…` с `media.parkour.am` (Transformations владелец включил, 8.4). Не наш хост (dev) — оригинал, если JPEG / PNG. Таймаут 5 с на картинку, загрузка параллельно. Фото не загрузилось — рамка-заглушка и предупреждение в лог; логотип — только название партнёра. PDF не отменяется.
5. Видимость плюшек: исчерпанная разовая (остаток 0) в PDF не попадает, в кабинете видна с остатком 0. В PDF остаток не печатается (документ статичный).
6. Кабинет: QR — `qrSvg(url)` на сервере (как 6.8), адрес и плюшки отдаются только действительной книжке; у недействительной — ни QR, ни PDF, ни плюшек (`06` 5.12).
7. Лимит генерации — `volunteerPdfPerUser` 30 в час на пользователя (и admin): PDF тянет картинки и грузит CPU. Превышен — 429.
8. Страница `/hy/volunteer/{token}` — 10.5; до неё QR ведёт на 404 (как ссылка в карточке после 10.3).

## Не ломать

- Права: участник скачивает только свою действительную книжку; модератор и редактор — 403 на `/admin/volunteer/**`, включая `pdf`; гость — на вход.
- Личные данные: в PDF и кабинете нет email, телефона, даты рождения; фото до 18 — только при действительной книжке (она уже требует `privacy`).
- Блок «Книжка» 10.3 во всех остальных состояниях, заявка, решения admin; PDF сертификатов (`certificates/pdf-*` — только импорт, без правок).

## Проверка

- `npx vitest run src/lib/server/services/volunteer src/routes/admin/access-coverage.test.ts`; `npm run check`, `npm run lint`
- `npx playwright test tests/e2e/volunteer-cards.spec.ts`

## Риск

`high` — `+server.ts` (выдача файла), личные данные (фото, имя, данные до 18), права, `auth/rate-limit.ts`.

## Читать

- `03` § 19.2 п. 3, 19.3, 19.8 (выписано выше); `06` § 5.12 (блоки «Книжка», «Плюшки»), § 4.12 (адрес QR); `05` § 28 «Карточка»; `08` § 10 (стиль PDF: navy, без градиентов, читается в ч/б)
- `zone-notes.md` § «Волонтёрство», § «Экзамены и сертификаты» (6.4 PDF, 6.8 QR в кабинете)
- образцы: `certificates/pdf-render.ts`, `pdf-draw.ts`, `pdf-content.ts` (`holderName`, `yerevanDate`), `qr-svg.ts`; `cabinet/progress/[id]/pdf/+server.ts`; `components/site/media-photo.ts` (адрес Transformations); `cabinet/avatar.ts` (`sniffMime`)

## Открыто

- `tests/e2e/admin-access-map.ts` уже 227 строк (> 200): новая строка — только по ответу владельца (исключение для таблицы или сплит отдельным шагом).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

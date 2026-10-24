# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`.

## Задача

6.4 PDF сертификата: тот же вид для всех типов, три языка, QR, подпись и печать; хранение в R2; пересоздание. «ебашь» владельца — 2026-10-24, без REVIEW на задаче. Без миграции (`certificates.file_key` из 6.1). Библиотеки — `d67149d` (`01-STACK`).

Решения (`03` 4 п. 5; `05` разд. 8; `08` разд. 10; `questions.md` этап 6 — библиотеки, печать):
- Вид (`08` § 10): A4 альбомный, рамка navy `#1F4E78` (без градиентов, читается в ч/б), логотип сверху (вектор из `static/brand/logo-square.svg`, два пути `evenodd`), название федерации (`site_settings.site_name` по языкам, откат на `site.name`, повторы убираются), «Հավաստագիր» крупно + остальные языки строкой ниже, имя владельца крупно (`first_name last_name`, иначе `name`; длинное — уменьшается до ширины), тип и уровень (`certificates.kind.*`), категория (тренер / судья, если есть), внизу: номер, дата выдачи, «действителен до» (только тренер / судья), подпись и печать (~4 см), QR проверки + адрес.
- Языки: армянский и английский всегда, русский — `site_settings.certificates.pdf_russian` (по умолчанию `true`, предложено — `questions.md`). Даты — `ДД.ММ.ГГГГ` по Еревану (одинаково на всех языках). Шрифт — APU Sans 400 / 700 (`woff2` встраивается через fontkit).
- QR — вектором (`qrcode` → квадраты), адрес `{PUBLIC_SITE_URL}/certificate/{public_token}` без языкового префикса (6.5). Нет `PUBLIC_SITE_URL` — PDF не собирается (`site_url_missing`).
- Печать и подпись: dev — `CERTIFICATE_ASSETS_DIR` (`seal.png`, `signature.png`; в приоритете), иначе приватный бакет `certificate-assets/seal.png`, `certificate-assets/signature.png` (загрузка через админку — 6.7; до неё владелец кладёт руками в R2). Только PNG (прозрачность). Нет любого файла — PDF не собирается (`assets_missing`): без печати не выдаём.
- Хранение: приватный бакет (`R2_PRIVATE_BUCKET`), ключ `certificates/{user_id}/{certificate_id}.pdf` — пересоздание перезаписывает тот же объект; затем `file_key`. Не публичный бакет: PDF отозванного не остаётся по прямой ссылке. Нет бакета — `storage_missing`. Скачивание (подписанная ссылка) — 6.7 / 6.8.
- Выдача (6.3): PDF — после коммита, до письма; любой сбой — `console.warn`, выдача не откатывается, `file_key` пуст, в результате `pdf` — итог (для админки 6.7). Письмо без вложения (ссылки как в 6.3).
- Пересоздание (`regenerateCertificatePdf`): право `certificates.issue` (admin, `05` разд. 8 «пересоздать PDF»); отозванный — `revoked`; журнал `certificate.pdf` (номер, ключ). Итоги: `ok`, `not_allowed`, `not_found`, `revoked`, `assets_missing`, `storage_missing`, `site_url_missing`.
- Хранилище: `PrivateStorage` + `put(key, bytes, mime)` и `read(key)` (нет объекта — `null`).

## Файлы (ожидаемо)

- `src/lib/server/services/certificates/` — `pdf-content.ts` (+ `.test.ts`: тексты и языки, чисто), `pdf-render.ts` + `pdf-draw.ts` (+ `pdf-render.test.ts`), `pdf-assets.ts` (+ `.test.ts`), `pdf-store.ts` (+ `.test.ts`: хранение, пересоздание, выдача с PDF), `issue.ts`, `issue-types.ts`, `settings.ts` (+ `.test.ts`), `index.ts`
- `src/lib/server/storage/{types,r2}.ts`, `services/media/fake-storage.ts`
- `src/lib/i18n/messages/{en,hy,ru}-certificates.ts` — подписи PDF
- `src/lib/server/seed/settings.ts` (+ `.test.ts`) — `pdf_russian`
- `src/env.ts`, `.env.example` — `CERTIFICATE_ASSETS_DIR`

## Не ломать

- Выдача 6.3: степень, баллы, журнал, письмо — как были; сбой PDF не откатывает выдачу и не глушит письмо.
- Отзыв не трогает PDF; отозванный не пересоздаётся.
- Печать и подпись не попадают в репозиторий и в публичный бакет.
- Согласия (`r2Private`, `fakeStorage`) — прежний контракт.

## Проверка

- `npx vitest --run src/lib/server/services/certificates src/lib/server/seed/settings.test.ts src/lib/server/services/consents`
- `npm run check`, `npm run lint`

## Риск

high (степени — выдача, личные данные в PDF, `.env.example`, `package.json`).

## Читать

- `03` 4 п. 5. `05` разд. 8 (действия). `08` разд. 2, 4.1, 10. `01` таблица стека, переменные.

## Фазы

- [x] SPEC — `2c11c2e`
- [x] RED — `f89a8e2`
- [x] GREEN — тесты задачи 96/96 (18 файлов; `revoke.test` один раз упал по таймауту 20 с под нагрузкой — отдельно 3/3), `points.test` 3/3, check и lint PASS, `npm run build` PASS
- [ ] REVIEW — общим шагом в конце этапа

Сверх SPEC: шрифт — TTF-копии `static/fonts/apu-sans/apu-sans-{400,700}.ttf` (fontTools из тех же `woff2`, глифы не менялись; `LICENSE.txt` дополнен): `woff2` pdf-lib встраивает как есть, просмотрщики (MuPDF) его не читают, а `subset: true` теряет буквы. Тесты после RED поправлены только в проверках: картинки с прозрачностью дают ещё маску (`SMask`) — считаются картинки страницы; словарь шрифта в сжатом потоке — проверяется через структуру PDF; у отозванного в фикстуре — причина и дата (проверка базы). Превью с настоящей печатью смотрено глазами (уровень и судья, три языка). Шрифт в серверном бандле сборки ещё не виден — ни один маршрут не импортирует сервис до 6.7.

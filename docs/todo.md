# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`.

## Задача

6.5 Публичная страница проверки `/certificate/{public_token}` (`noindex`). «ебашь» владельца — 2026-10-24, без REVIEW на задаче. Без миграции.

Решения (`06` 4.10; `03` 4 п. 5; `06` 1 п. 7):
- Показывает: имя владельца (`first_name last_name`, иначе `name` — как в PDF, для несовершеннолетних тоже только имя и фамилия), тип и уровень (`certificates.kind.*`), категория (если есть), номер, дата выдачи, «действителен до» (только у тренера / судьи), статус «Действителен» / «Истёк» / «Отозван» (`certificateState`: истёк — и по статусу, и по дате до ежедневной задачи 6.9).
- Не показывает и **не отдаёт из `load`**: контакты, дату рождения, id участника, причину и дату отзыва, `file_key`, экзамен, кто выдал.
- 404: токена нет, токен не похож на наш (не base64url / длиннее 64), владелец мягко удалён (`users.deleted_at`; предложено — `questions.md`: удалённый аккаунт публично не показываем).
- Адрес без языкового префикса = английский (QR из PDF); `/hy/…`, `/ru/…` — те же данные на языке. Дата — `dateStyle: long` по Еревану (как новости и квитанция).
- `noindex`: `<meta name="robots">` + заголовок `x-robots-tag: noindex`; `cache-control: no-store` (статус меняется при отзыве — без кеша). В `robots.txt` `/certificate` уже закрыт.
- Сервис — `services/certificates/public.ts`: `findPublicCertificate(db, token, now)` → `PublicCertificate | null` (только нужные поля). Маршрут тонкий.

## Файлы (ожидаемо)

- `src/lib/server/services/certificates/public.ts` (+ `public.test.ts`), `pdf-content.ts` (вынести `holderName`), `index.ts`
- `src/routes/[[lang=lang]]/(site)/certificate/[token]/+page.server.ts`, `+page.svelte`
- `src/lib/i18n/messages/{en,hy,ru}-certificates.ts` — `certificates.verify.*`
- `tests/e2e/certificate.spec.ts`

## Не ломать

- PDF 6.4: имя владельца то же (`holderName` общий).
- Публичная проверка не раскрывает контакты, дату рождения, причину отзыва (K4).
- `robots.txt`, остальные страницы сайта.

## Проверка

- `npx vitest --run src/lib/server/services/certificates/public.test.ts src/lib/server/services/certificates/pdf-content.test.ts`
- `npx playwright test tests/e2e/certificate.spec.ts`; `npm run check`, `npm run lint`

## Риск

normal (публичная страница с личными данными — имя; права не меняются).

## Читать

- `06` 1 п. 7, 4.10. `03` 4 п. 5.

## Фазы

- [x] SPEC — `8a486ff`
- [x] RED — `1138ca9`
- [x] GREEN — `public.test` + `pdf-content.test` 12/12, e2e `certificate.spec` 4/4, check и lint PASS
- [ ] REVIEW — общим шагом в конце этапа

Сверх SPEC: `certificateTitleKey` считается в `load` (страница — клиентский код, серверный `mail.ts` в неё не импортируется); маршрут импортирует `public.ts` напрямую, не `index.ts` — в бандл страницы не тянутся PDF-библиотеки и приватное хранилище.

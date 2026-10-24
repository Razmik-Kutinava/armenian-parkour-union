# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`; 6.7c админка тренеров и судей (решения и «для REVIEW») — `git show ba7fd1a:docs/todo.md`.

## Задача

6.8 — кабинет `/cabinet/progress`: шкала степеней, экзамены, сертификаты, скачивание PDF, ссылка проверки и QR. Без миграции. «ебашь» владельца — 2026-10-24. REVIEW — общим в конце этапа 6.

Факты (`06` § 3.2, 5.5; `04` § 3.1, 5.3, 7; `03` § 3–5): шкала `novice → advanced → pro` с отметкой текущей; экзамены — назначенные и пройденные (дата, результат); сертификаты — тип, номер, дата, срок, статус, скачать PDF, копировать ссылку проверки, QR; активный профиль тренера / судьи — блок «Мой профиль» с публичностью. Всё — только своё (`user_id` из сессии; чужое — 404). Ссылка проверки и QR — тот же адрес, что в PDF: `{PUBLIC_SITE_URL}/certificate/{token}` без префикса языка (`zone-notes` 6.5). PDF — `certificatePdfLink` (6.7b), проверив владельца.

Решения агента 6.8 (в рамках документов):
- **Публичность профиля тренера** — в кабинете только показ (вид, категория, лицензия, «показан на сайте» / «скрыт», ссылка на `/federation/team`) и подсказка «включает федерация»: в `04` `staff_profiles.write` только у admin, предложение в `questions.md` — «меняет только admin» (`06` § 10 п. 4). Неактивные профили не показываются.
- **Следующий шаг** (под шкалой): нет степени — «новичок — с первой оплатой взноса» и ссылка на членство; `pro` — «высшая степень»; иначе экзамен на следующую степень через `checkExamAdmission` + `readExamFacts` (как 6.7a) на `now`: допуск есть — «экзамен назначает федерация»; `no_membership` — ссылка на членство; `already_scheduled` / `awaiting_certificate` — текстом; `retake_too_soon` / `level_too_recent` — «не раньше {дата}». Кнопки заявки нет (вопрос «заявка участником» открыт, таблицы заявок нет).
- **Экзамены**: все свои, сначала назначенные (по дате), затем решённые (новые сверху): вид, дата, результат, оценка. Заметки и экзаменатор не отдаются (внутреннее).
- **Сертификаты**: все свои, новые сверху; состояние — `certificateState`. Отозванный — только строка со статусом: без PDF, ссылки и QR. `file_key` и `revoke_reason` на страницу не уходят — только `hasPdf`.
- **Скачивание**: `GET /cabinet/progress/[id]/pdf` (`+server.ts`): `requireUser` → свой, не отозванный, с файлом → 303 на подписанную ссылку (5 мин, генерируется на клик — страница не протухает); иначе 404 (и без бакета). `cache-control: no-store`.
- **QR**: на сервере из `qrcode` (`QRCode.create`) — SVG-путь (тёмные отрезки строк, как `drawQr` в PDF), в разметке `<svg><path>` внутри `<details>` «QR-код», без `{@html}` и без библиотеки в браузере.
- **Меню кабинета**: «Прогресс» между «Мои события» и «Баллы» (порядок `06` § 3.2). Блок «Прогресс» на обзоре (`06` § 5.1) и экзамен в «Требует действия» — не в 6.8 (отдельный шаг, в отчёт).

## Файлы (ожидаемо)

- `src/lib/server/services/cabinet/progress.ts` (+ `progress.test.ts`) — `getOwnProgress(db, userId, now)`, `ownCertificatePdfKey(db, userId, id)`
- `src/lib/server/services/cabinet/progress-next.ts` — `nextLevelStep(db, user, now)` (тест — в `progress.test.ts`)
- `src/lib/server/services/certificates/qr-svg.ts` (+ `.test.ts`) — `qrSvg(url)` → `{ size, d }`
- `src/routes/[[lang=lang]]/(site)/cabinet/progress/+page.server.ts`, `+page.svelte`, `LevelScale.svelte`, `OwnCertificate.svelte`; `[id]/pdf/+server.ts`
- `src/routes/[[lang=lang]]/(site)/cabinet/+layout.svelte` — пункт меню
- `src/lib/i18n/messages/{en,hy,ru}-cabinet-progress.ts` + подключение в `{en,hy,ru}.ts`
- `tests/e2e/cabinet-progress.spec.ts` (новый)

## Не ломать

- Чужие сертификаты и экзамены не видны и не скачиваются (подмена `id` в адресе PDF — 404), гость — на вход (K1, `04` § 8).
- На страницу не уходят `file_key`, причина отзыва, заметки экзамена, контакты (K4).
- Отозванный сертификат не скачивается и не даёт QR (K3 по смыслу — недействительный документ).
- Остальные разделы кабинета и их меню.

## Проверка

- `npx vitest --run src/lib/server/services/cabinet/progress.test.ts src/lib/server/services/certificates/qr-svg.test.ts`
- `npx playwright test tests/e2e/cabinet-progress.spec.ts`; `npm run check`, `npm run lint`

## Риск

high (`+server.ts`, свои сертификаты — K1 / K4). Сервисы выдачи, экзаменов и PDF не меняются — только чтение.

## Читать

- `06` § 3.2, 5.5, 10 (п. 4). `04` § 3.1, 5.3, 7. `03` § 3–5 (прочитаны). `zone-notes.md` § «Экзамены и сертификаты» (6.2 «для 6.8», 6.4, 6.5, 6.7b), § «Кабинет».

## Фазы 6.8

- [x] SPEC
- [x] RED — `e947e38` (нет модулей `cabinet/progress`, `certificates/qr-svg`; страницы нет)
- [x] GREEN — сервисы `cabinet/progress.ts`, `cabinet/progress-next.ts`, `certificates/qr-svg.ts`; страница `/cabinet/progress` (+ `LevelScale`, `OwnExams`, `OwnCertificate`), `GET /cabinet/progress/[id]/pdf`; пункт меню; переводы `*-cabinet-progress.ts`. Vitest 9/9 (+ i18n 31/31); e2e `cabinet-progress` 2/2; check 0, lint чистый
- [ ] REVIEW — общим шагом в конце этапа

Сверх SPEC / для REVIEW 6.8:
- e2e после RED поправлен под разметку (сертификаты новыми сверху — ссылка и QR проверяются в карточке своего номера; текст следующего шага), требования те же.
- `progress.ts` — 143 строки (норма 120): типы и две выборки; дробить — по просьбе.
- Успешное скачивание (303 на подписанную ссылку) e2e не проверено: на dev нет `R2_PRIVATE_BUCKET` — там 404, как «PDF нет». Подписанная ссылка — без `Content-Disposition: attachment` (как в админке 6.7b): браузер откроет PDF, а не скачает.
- Блок «Прогресс» на обзоре `/cabinet` (`06` § 5.1) и экзамен в «Требует действия» — не сделаны (вне строки 6.8 роадмапа).
- Экраны руками в браузере не смотрел: e2e проходит шкалу, следующий шаг, экзамены, сертификаты, ссылку, QR, профиль тренера и 404 на чужой / отозванный PDF.

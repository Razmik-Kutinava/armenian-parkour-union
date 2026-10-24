# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`.

## Задача

6.6 Автосоздание и деактивация профилей тренеров и судей, публичная страница `/federation/team`. «ебашь» владельца — 2026-10-24, без REVIEW на задаче. Без миграции (`staff_profiles` — 6.1).

Решения (`03` § 5, § 13 п. 3; `06` § 4.6, § 1 п. 7; `02` `staff_profiles`):
- Профиль включён ⇔ у участника есть **живой** сертификат того же вида: `status = 'active'` и `expires_at > now`. Одна функция `syncStaffProfile(tx, userId, kind, now, category)` — под блокировкой строки `users` (выдача её уже держит; отзыв и истечение встают в очередь — без гонки «выдали новый, пока отзывали старый»).
  - Выдача `trainer` / `judge` (в транзакции `issueCertificate`): нет профиля — создать (`is_active = true`, `category` из сертификата, `is_public = false` — по `02`); выключен — включить (`category` заполнить, только если пусто; `is_public` не трогать).
  - Отзыв (в транзакции `revokeCertificate`): выключить, если другого живого сертификата того же вида нет (переаттестация: два живых — отзыв одного профиль не гасит).
  - Истечение: `deactivateLapsedStaff(db, now)` — выключает профили без живого сертификата, журнал `staff_profile.deactivate` (actor — система, `null`). Вызов из ежедневной задачи — 6.9. Страница и до 6.9 не показывает истёкших: живой сертификат проверяется в самом запросе.
  - Журнал: в `certificate.issue` / `certificate.revoke` — поле `staffProfile` (`created` / `activated` / `deactivated` / `unchanged`; у сертификата уровня его нет).
- Публичность (вопрос в `questions.md`, предложено — меняет только admin): автосозданный профиль **не публичный**; на сайт его выводит admin в 6.7. До 6.7 — только руками в базе.
- Страница `/federation/team` (`06` § 4.6): две секции — тренеры, судьи; карточка — фото, имя, категория, описание. Только `is_public`, `is_active`, живой сертификат, участник `active` и не удалён. Имя — `holderName` (как в PDF). Фото — `users.avatar_key` (предложено, `questions.md`). Описание — `bio` на языке страницы, запасной — английский. Не отдаются из `load`: email, телефон, дата рождения, id участника, `license_number`.
- Несовершеннолетний (или дата рождения неизвестна): фото и описание — только при действующем согласии `privacy` (`03` § 13 п. 3); имя и категория — всегда.
- Кеш: группа `staff` (60 с, как остальные публичные списки); сброс — запись в `/admin/users` (имя, блокировка) и любые неизвестные разделы (`/admin/certificates`, `/admin/staff` из 6.7 — сбрасывают всё). Смена аватара в кабинете — по сроку кеша.
- Ссылка на страницу — со страницы «О федерации»; в `sitemap.xml` — да (страница индексируется).

## Файлы (ожидаемо)

- `src/lib/server/services/staff/profile.ts` (+ `profile.test.ts`) — `syncStaffProfile`, `deactivateLapsedStaff`
- `src/lib/server/services/staff/public.ts` (+ `public.test.ts`) — `listPublicStaff(db, locale, now)`
- `src/lib/server/services/certificates/issue.ts`, `issue-audit.ts`, `revoke.ts` — вызов `syncStaffProfile`
- `src/lib/server/cache/memory.ts`, `admin-groups.ts` (+ test) — группа `staff`; `services/seo/sitemap.ts`
- `src/routes/[[lang=lang]]/(site)/federation/team/+page.server.ts`, `+page.svelte`; `federation/+page.svelte` — ссылка
- `src/lib/i18n/messages/{en,hy,ru}-team.ts` + подключение в `{en,hy,ru}.ts`
- `tests/e2e/team.spec.ts`

## Не ломать

- Выдача и отзыв 6.3: отказы, баллы, степень, журнал — как были (`issue*.test.ts`, `revoke.test.ts`).
- Несовершеннолетние: без `privacy` — ни фото, ни описания; контакты и дата рождения не уходят в `load` (K4).
- Профиль не даёт ролей и прав (`03` § 5 п. 4) — `users.role` не трогается.
- Кеш остальных групп сбрасывается как раньше.

## Проверка

- `npx vitest --run src/lib/server/services/staff src/lib/server/services/certificates src/lib/server/cache src/lib/server/services/seo`
- `npx playwright test tests/e2e/team.spec.ts`; `npm run check`, `npm run lint`

## Риск

high (степени и сертификаты: транзакция выдачи и отзыва; данные несовершеннолетних на публичной странице).

## Читать

- `03` § 5, § 13 п. 3. `06` § 4.6, § 1 п. 7. `02` `staff_profiles`. `04` — `staff_profiles.write` только admin.

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW — общим шагом в конце этапа

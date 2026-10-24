# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`.

## Задача

6.7 — админка экзаменов, сертификатов, тренеров и судей (`05` § 7–9). Без миграции. Три шага, REVIEW — общим в конце этапа 6:

- 6.7a — «Экзамены» — GREEN `a89554d`.
- 6.7b — «Сертификаты» — GREEN `4b80d65`.
- **6.7c (текущий)** — «Тренеры и судьи»: список и карточка с формой правки профиля. «ебашь» владельца — 2026-10-24.

### 6.7c — SPEC

Факты (`05` § 9; `03` § 5; `04` § 3, 5.1; `02` `staff_profiles`): список — участник, вид, категория, номер лицензии, сертификат, публичный, активен; фильтры — вид, активные, публичные. Форма (admin) — участник, вид, категория, номер лицензии, описание ×3 языка, фото, «показывать публично», «активен». Профиль создаётся выдачей сертификата и выключается отзывом / истечением (`syncStaffProfile`, 6.6); здесь — корректировка. Права: просмотр — moderator, admin; правка и скрытие — admin (`staff_profiles.write`). Фото — `users.avatar_key` (`questions.md`, предложено).

Решения агента 6.7c (в рамках документов):
- **Адреса**: `/admin/staff` (список), `/admin/staff/[id]` (карточка; у admin — форма `?/update`). Страницы создания нет: профиль без сертификата — не тренер (`02` § 1, `03` § 5 п. 1–2); пустой список подсказывает «появится при выдаче сертификата».
- **Право просмотра**: в `04` § 5.1 нет кода `staff_profiles.read`, а по таблице § 3 смотрят moderator и admin — беру `certificates.read` (те же роли); пункт меню «Тренеры и судьи» — тоже на нём (сейчас `staff_profiles.write`, модератор раздела не видит). Документ не правлю — владельцу в отчёт.
- **Список**: фильтры `kind` (`trainer` / `judge`), `active` и `public` (`yes` / `no`). Поиск — имя и номер лицензии, admin — и email. Сортировка — по имени (колонки даты в `05` § 9 нет). Колонка «Сертификат» — номер живого сертификата того же вида (`liveCertificateOf`, последний выданный) со ссылкой на карточку, иначе «—». Удалённые участники не показываются. Email в строках не отдаётся.
- **Карточка**: участник (ссылка на `/admin/users/[id]`), вид, фото участника (только показ — меняет сам участник в кабинете), живой сертификат (номер, срок) или «нет действующего». Модератор видит то же без формы.
- **Форма**: категория (≤ 100, как у сертификата), номер лицензии (≤ 60), описание EN / HY / RU (обычный текст, ≤ 2000 каждое; всё пустое — `bio = null`; HY или RU без EN — ошибка у EN, `05` § 1 п. 4), «показывать публично», «активен». Участник и вид не меняются.
- **«Активен»**: выключить — всегда; включить — только при живом сертификате того же вида (иначе отказ `no_live_certificate` у поля), проверка в той же транзакции под блокировкой строки `users` (как `syncStaffProfile` — без гонки с выдачей / отзывом). Выключенный руками профиль снова включится следующей выдачей сертификата этого вида (6.6).
- **Журнал**: `staff_profile.update` (entity `staff_profile`), `before` / `after` — изменённые поля; ничего не изменилось — запись не пишется, ответ «Сохранено». Кеш `/federation/team` сбрасывается уже сейчас (раздел `staff` → все группы, `admin-groups.ts`) — не трогаю.

## Файлы 6.7c (ожидаемо)

- `src/lib/server/services/staff/admin-list.ts` (+ `admin-list.test.ts`) — `staffListOptions`, `listStaffProfiles(db, viewer, state, now)`
- `src/lib/server/services/staff/admin-card.ts` (+ `admin-card.test.ts`) — `getStaffCard(db, id, now)`, `updateStaffProfile(db, actor, id, values, ip, now)`
- `src/lib/validation/admin-staff.ts` (+ `.test.ts`), `staff-enums.ts`
- `src/lib/server/admin/nav.ts` (+ тест меню, если есть) — пункт на `certificates.read`
- `src/routes/admin/staff/` — список, `[id]/` (+ `StaffForm.svelte`, `BioField.svelte`)
- `src/lib/i18n/messages/{en,hy,ru}-staff-admin.ts` + подключение
- `tests/e2e/admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-certificates.ts` (действие профиля — сюда: `admin-audit-actions.ts` уже 203 строки), `admin-permissions.spec.ts` (200 строк — подстановку путей этапа 6 унести в `admin-permissions-certs.ts`), `admin-permissions-certs.ts`, `admin-staff.spec.ts` (новый)

## Не ломать 6.7c

- Права: модератор видит список и карточку, но не правит (403, профиль не меняется); редактор и участник — ничего (K1).
- Профиль не включается без живого сертификата того же вида: на `/federation/team` не попадает тот, кто не тренер (K3 по смыслу `03` § 5).
- Email, телефон и дата рождения участника не уходят в список и карточку (K4). Фото и описание несовершеннолетнего на сайте — по-прежнему только с `privacy` (`public.ts` не трогаю).

## Проверка 6.7c

- `npx vitest --run src/lib/server/services/staff src/lib/validation/admin-staff.test.ts src/lib/server/admin src/routes/admin`
- `npx playwright test tests/e2e/admin-staff.spec.ts tests/e2e/admin-permissions.spec.ts tests/e2e/admin-audit.spec.ts`; `npm run check`, `npm run lint`

## Риск

high (права — K1; включение профиля в обход сертификата). Сервисы 6.3 / 6.6 не меняются, поверх — список и форма.

## Читать

- `05` § 1, 9. `04` § 3, 5.1. `03` § 5. `02` `staff_profiles` (прочитаны). Сервисы 6.6 — `zone-notes.md` § «Экзамены и сертификаты».

## Фазы 6.7c

- [x] SPEC
- [x] RED — `abbfe75` (нет модулей `staff/{admin-list,admin-card}`, `validation/admin-staff`; карты прав и журнала без страниц; меню модератора без раздела)
- [x] GREEN — сервисы `staff/admin-list.ts`, `staff/admin-card.ts`; `validation/{admin-staff,staff-enums}.ts`; страницы `/admin/staff`, `/admin/staff/[id]` (+ `StaffForm`, `BioField`); меню на `certificates.read`; переводы `*-staff-admin.ts`. Vitest зоны 32/32; e2e `admin-staff` + `admin-permissions` + `admin-audit` 7/7; check 0, lint чистый
- [ ] REVIEW — общим шагом в конце этапа

Сверх SPEC / для REVIEW 6.7c:
- Право просмотра — `certificates.read` (в `04` § 5.1 нет `staff_profiles.read`): если владелец захочет отдельный код — добавить в `04` и `permissions.ts`, поменять в `nav.ts`, двух маршрутах, `listStaffProfiles` и карте прав.
- Подстановка путей `/certificates/[id]` и `/staff/[id]` в `admin-permissions.spec.ts` вынесена в `admin-permissions-certs.ts` (`stageSixPath`) — спека 194 строки вместо 200. Действие профиля для `admin-audit.spec` — в `admin-audit-certificates.ts` (`admin-audit-actions.ts` по-прежнему 203 строки — план сплита за REVIEW).
- Модератору карточка показывает описание только на английском (без формы). Фото — `publicUrl(avatar_key)` без проверки `show_avatar`: в админке видно всегда, на сайте — по правилам `public.ts`.
- Экраны руками в браузере не смотрел: e2e проходит поиск, правку, показ на `/federation/team`, отказ включения без сертификата и просмотр модератором.

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`.

## Задача

6.7 — админка экзаменов, сертификатов, тренеров и судей (`05` § 7–9). «ебашь» владельца — 2026-10-24. Без миграции. Делится на три шага (как 5.7), REVIEW — общим в конце этапа 6:

- **6.7a (текущий)** — «Экзамены»: список, назначение (с пересдачей), карточка и результат.
- **6.7b** — «Сертификаты»: список, выдача, карточка (PDF: скачать, пересоздать; отзыв; ссылка проверки); кнопка «Выдать сертификат» на сданном экзамене.
- **6.7c** — «Тренеры и судьи»: список, правка профиля (категория, лицензия, описание ×3, публичность).

### 6.7a — SPEC

Факты (`05` § 7, `04` § 3–5): список — участник, тип, дата, экзаменатор, результат, оценка; фильтры — тип, результат, период. Форма — участник (поиск), тип, дата и время, событие (необязательно), экзаменатор (moderator / admin), заметки. Результат — сдал / не сдал / отменён, оценка, комментарий. Допуск — `03` § 3 (сервис 6.2); степень не та — предупреждение. Право — `exams.manage` (moderator, admin) на всё.

Решения агента 6.7a (в рамках документов):
- **Адреса**: `/admin/exams` (список), `/admin/exams/new` (назначение), `/admin/exams/[id]` (карточка + `?/result`). Меню уже есть (`nav.ts`).
- **Список**: фильтры `kind`, `result`, `from` / `to` (день по Еревану, по `scheduled_at`); поиск по имени (admin — и по email, как журнал баллов); сортировка по дате (по умолчанию — новые сверху), без даты — в конце. Email в строках не отдаётся никому (в `05` § 7 колонки нет).
- **Участник**: GET-поиск на `/admin/exams/new?q=` тем же `listUsers` (у модератора — только `member` и только по имени, `04` § 4, 6.5), выбор — `?member=<id>`; карточка выбранного — имя, степень, статус. Без новых библиотек и JS-эндпоинтов.
- **Предупреждение о степени**: сабмит → сервис вернул `confirm_level` → форма с теми же значениями, текст предупреждения и галочка «Назначить всё равно» (`confirmLevel`); повторный сабмит сохраняет. До сохранения админ видит предупреждение — это и есть «предупреждение» `05` § 7.
- **Экзаменатор**: список активных moderator / admin (только имя), пусто — «внёсший результат» (сервис 6.2). **Событие**: необязательный список — не удалённые события с началом от 90 дней назад и до года вперёд (до 200).
- **Карточка**: участник (ссылка на `/admin/users/[id]`), тип, дата, событие, экзаменатор, заметки, результат, оценка, дата решения. Форма результата — только у `scheduled`. У `failed` / `cancelled` — ссылка «Назначить пересдачу» (`/admin/exams/new?member=…&kind=…`). «Выдать сертификат» — в 6.7b.
- **Отказы** сервиса → понятные сообщения у формы (`blocked`, `no_membership`, `already_scheduled`, `awaiting_certificate`, `retake_too_soon`, `level_too_recent`, `user_not_found`, `event_not_found`, `examiner_invalid`; результата — `already_decided`, `too_early`, `not_found` → 404).
- Изменения даты / экзаменатора у назначенного экзамена нет (в сервисе 6.2 нет; `05` не требует) — отменить и назначить заново.

## Файлы 6.7a (ожидаемо)

- `src/lib/server/services/exams/list.ts` (+ `list.test.ts`) — `examListOptions`, `listExams(db, viewer, state)`
- `src/lib/server/services/exams/card.ts` (+ `card.test.ts`) — `getExamCard`, `examinerOptions`, `examEventOptions`, `examMember`
- `src/lib/validation/admin-exams.ts` (+ `admin-exams.test.ts`) — схемы назначения и результата
- `src/routes/admin/exams/` — `+page.server.ts`, `+page.svelte`, `new/+page.server.ts`, `new/+page.svelte`, `[id]/+page.server.ts`, `[id]/+page.svelte`, `outcome.ts`
- `src/lib/i18n/messages/{en,hy,ru}-exams-admin.ts` + подключение в `{en,hy,ru}.ts`
- `tests/e2e/admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-exams.ts` (новый), `admin-audit-actions.ts`, `admin-permissions-fixtures.ts`, `admin-permissions.spec.ts`; `tests/e2e/admin-exams.spec.ts` (новый)

## Не ломать 6.7a

- Права: редактор и участник не видят и не назначают (`admin-permissions.spec`, `access-coverage`); модератору не уходят email и дата рождения участника, поиск по email — только admin (K4).
- Сервис 6.2 (допуск, отказы, журнал) — без изменений (`exams/*.test.ts`).
- Степень не меняется ни назначением, ни результатом (K3).

## Проверка 6.7a

- `npx vitest --run src/lib/server/services/exams src/lib/validation/admin-exams.test.ts src/routes/admin`
- `npx playwright test tests/e2e/admin-exams.spec.ts tests/e2e/admin-permissions.spec.ts tests/e2e/admin-audit.spec.ts`; `npm run check`, `npm run lint`

## Риск

normal (формы и списки поверх готового сервиса; права — `exams.manage`, данные участника — K4). Общий REVIEW этапа — `high` (6.3, 6.6).

## Читать

- `05` § 1, 7. `04` § 3–5 (прочитаны). Сервис 6.2 — `zone-notes.md` § «Экзамены и сертификаты».

## Фазы 6.7a

- [x] SPEC
- [x] RED — `8e4f72e` (нет модулей `exams/{list,card}`, `validation/admin-exams`; карты прав и журнала без страниц)
- [x] GREEN — сервисы `exams/list.ts`, `exams/card.ts`; `validation/{admin-exams,exam-enums}.ts`; страницы `/admin/exams`, `/new` (+ `ScheduleForm`), `/[id]` (+ `ResultForm`); переводы `*-exams-admin.ts`. Vitest зоны 37/37; e2e `admin-exams` 1/1, `admin-permissions` + `admin-audit` 5/5; check 0, lint чистый
- [ ] REVIEW — общим шагом в конце этапа

Сверх SPEC / для REVIEW 6.7a:
- События в форме — по близости к сегодня (не по дате убыванием): в dev-базе сотни e2e-событий, ближайшие нужнее; тест — с опорной датой в 2300 году.
- На dev выпадающий список событий длинный (до 200 e2e-остатков) — на проде событий мало; поиск по событиям не делался.
- Экраны руками в браузере (и на телефоне) не смотрел: e2e проходит назначение с предупреждением и результат через интерфейс модератором.

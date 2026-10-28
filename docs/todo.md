# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

**9.4** (`09` этап 9): доступ — заявка из кабинета с проверкой условий, одобрение / отказ / закрытие, письма, `/cabinet/training`.

Граница: без миграций (`course_access` — 9.1). Внеочередная попытка и карточка участника в заявке (попытки, практика, экзамен) — 9.6–9.8 (данных ещё нет). Портал курса `/cabinet/training/{slug}` и пункт «Открыть портал» в обзоре кабинета — 9.5. Памятка 9.3 — `git show e5e9027:docs/todo.md`.

Факты из документов (прочитаны, выписано):
- `03` § 18.1: условия курса — действующее членство (`requires_membership`), возраст ≥ `min_age`, степень ≥ `required_level`; проверка на сервере при подаче и ещё раз при одобрении; не выполнены — показать, чего не хватает, заявка не создаётся. `pending` → `approved` / `rejected` (причина); отклонённый подаёт снова — та же строка в `pending`. `revoked` — у `approved`, причина обязательна; история остаётся. Блокировка закрывает портал.
- `03` § 18.6: журнал — решение по заявке и закрытие доступа. Письма после коммита: новая заявка — админу (адрес — `site_settings.contacts.email`, как в § 18.5); одобрена (со ссылкой на портал), отклонена, закрыта (с причиной) — участнику.
- `05` § 27 «Заявки» (`/admin/training/access`, admin): участник, курс, дата, статус, возраст, степень, членство до; по умолчанию `pending`, старые сверху; фильтры курс, статус. «Одобрить», «Отклонить» (причина), у одобренных — «Закрыть доступ» (причина).
- `06` § 5.11: `/cabinet/training` — опубликованные курсы, описание и состояние: условия не выполнены (какие, кнопки нет) · «Запросить доступ» · `pending` «Заявка на рассмотрении» · `rejected` / `revoked` — причина, «Подать снова» только у `rejected` · `approved` — «Открыть портал» · курс завершён (`exam_id`) — «Курс пройден, ждёт выдачи сертификата».
- `02` § 11 / zone-notes 9.1: unique (курс, участник) — `23505`; `rejected` / `revoked` — непустой `review_note`; `pending` ⇔ `reviewed_at` пуст; повторная заявка обнуляет `reviewed_by` / `reviewed_at` / `review_note`. Права: `training.manage` — admin.

## Решения (агент)

1. **Условия** — чистая функция `courseConditions` (`services/training/access-rules.ts`): список недостающего `membership | age | level` (порядок фиксирован). Возраст — `ageOn(birthDate, now)`; нет даты рождения — `age`. Степень: `novice < advanced < pro`, нет степени — ниже любой. `min_age` / `required_level` пусты, `requires_membership = false` — условие не проверяется. Пользователь не `active` — отказ `blocked` (отдельно от списка).
2. **Подача** `applyForCourse(db, userId, courseId, deps)` (`access.ts`): курс `published`, иначе `not_found`; условия не выполнены — `{ missing }`, строка не создаётся; строки нет — `pending`; `rejected` — та же строка в `pending` с обнулением полей решения; `pending` / `approved` / `revoked` — `bad_state`; гонка (`23505`) — `bad_state`. Журнал не пишется (§ 18.6 — только решения). После коммита — письмо на `contacts.email`; адреса нет — письма нет (`console.warn`), ошибка отправки заявку не отменяет. Язык письма админу — `en` (адресат без языка, как гость — решение 3.7).
3. **Решение** `decideAccess(db, actor, accessId, input, deps)`: `training.manage`, иначе `not_allowed`; причина у `reject` / `revoke` — trim, 1–1000 (`invalid`); строка под `FOR UPDATE`; `approve` / `reject` — только из `pending`, `revoke` — только из `approved` (`bad_state`); удалённый участник или нет строки — `not_found`. `approve` перепроверяет условия на «сейчас» — не выполнены: `{ missing }`, ничего не меняется. Решение о своей заявке не запрещено (в документах нет; журнал пишет актора). Журнал в той же транзакции: `course_access.approve | reject | revoke`, `entityType = course_access`, `entityId` — id строки, before `{ status }`, after `{ status, courseId, userId, reviewNote? }`. Письмо участнику после коммита на его `locale`.
4. **Письма** (`access-mail.ts`): заявка — админу: курс, имя, ссылка `/admin/training/access`; одобрена — ссылка `/cabinet/training/{slug}` (страница — 9.5, этап выкатывается целиком); отклонена / закрыта — причина и ссылка `/cabinet/training`. Название курса — `pickPortal(title, locale)`.
5. **Список в админке** (`access-list.ts`): дата — `updated_at` (подача или последнее решение; повторная подача поднимает её); фильтр статуса по умолчанию `pending`, `all` — все; сортировка — дата по возрастанию, затем `id`; фильтр курса; страницы — как у других списков (`list-state`). Поля: участник (имя, ссылка на `/admin/users/{id}`), курс, дата, статус, возраст (по `birth_date`, admin — `users.read_full`), степень, членство до (`paidUntil`), причина.
6. **Кабинет** (`cabinet-courses.ts`): опубликованные курсы по `created_at`; состояние — `finished | approved | pending | revoked | rejected | can_apply | missing` + `missing[]` и `reviewNote`; у `rejected` «Подать снова» — если условия выполнены. Действие `?/apply` (`courseId`), ответ — сообщение у курса. Пункт «Обучение» в меню кабинета.
7. **Админка:** пункт меню «Заявки» в группе «Обучение» (`training.manage`); счётчик заявок в списке курсов — ссылка на `/admin/training/access?course=<id>`. Причина отказа / закрытия — поле в форме у строки (без JS — обычный POST).
8. **Переводы:** `{en,hy,ru}-training-access.ts` (админка и письма) — через `*-training-admin.ts`; `{en,hy,ru}-cabinet-training.ts` — через `*-cabinet.ts`.

## Файлы (ожидаемо)

- `src/lib/server/services/training/access-rules.ts`, `access.ts`, `access-mail.ts`, `access-list.ts`, `cabinet-courses.ts` (+ тесты), `test-support.ts`.
- `src/routes/admin/training/access/+page.server.ts`, `+page.svelte`; `src/routes/admin/training/+page.svelte` (ссылка счётчика); `src/lib/server/admin/nav.ts` (+ test), `src/lib/components/admin/nav-icons.ts`.
- `src/routes/[[lang=lang]]/(site)/cabinet/training/+page.server.ts`, `+page.svelte`; `cabinet/+layout.svelte` (меню).
- `src/lib/i18n/messages/{en,hy,ru}-training-access.ts`, `{en,hy,ru}-cabinet-training.ts`.
- `tests/e2e/admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-training.ts`, `admin-permissions-training.ts`.

## Не ломать

- Права и журнал прочих разделов (`access-coverage`, `audit-coverage`, `admin-permissions.spec.ts`); editor и moderator не видят «Заявки» и не могут решать.
- Курсы, темы, уроки, банк 9.2–9.3; счётчик «Заявки» в списке курсов.
- Участник видит и подаёт только свою заявку (id — из сессии); чужой `courseId` неопубликованного курса — как несуществующий.

## Проверка

- `npx vitest run src/lib/server/services/training src/lib/server/admin/nav.test.ts src/routes/admin/access-coverage.test.ts src/routes/admin/audit-coverage.test.ts` → PASS.
- `npm run check`, `npm run lint`.

## Риск

`high` — права (`training.manage`, свой / чужой участник), возраст участника в админке, журнал решений, письма.

## Читать

- `03` § 18.1, 18.6; `05` § 27 «Заявки»; `06` § 5.11; `02` § 11 `course_access` (выписано); `zone-notes.md` § «Обучающий портал» (прочитано).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

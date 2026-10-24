# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`.

## Задача

6.1 Таблицы `exams`, `certificates`, `staff_profiles` (миграция 0012). «go» владельца — 2026-10-24 («ебашь», без REVIEW на задаче).

Миграция 0012 (только `CREATE`): enum `staff_kind`, `certificate_kind`, `certificate_status`, `exam_kind`, `exam_result`; таблицы по `02` разд. 1–2. Сверх списка полей `02` — по «Общим соглашениям» `02`: `created_at` / `updated_at` у всех трёх (изменяемые). Ограничения (защита степени и баллов, `03` разд. 3–4):
- `certificates`: `level` есть ⇔ `kind = 'level'`, и только `advanced` / `pro`; у `level` нет `expires_at` (бессрочные, `03` 4.6); `revoked` ⇔ `revoked_at` и непустая `revoke_reason` (`03` 4.7); unique(`exam_id`) среди неотозванных (один сертификат на экзамен — от двойной выдачи); unique(`user_id`, `level`) среди действующих сертификатов уровня (повторная степень = повторные баллы).
- `exams`: `score` numeric(5,2); индексы `user_id`, (`result`, `scheduled_at`).
- `staff_profiles`: unique(`user_id`, `kind`), `is_public` false, `is_active` true.
- FK без каскада: пользователя, экзамен, событие с записями не удалить.

Откат: `DROP TABLE certificates, exams, staff_profiles; DROP TYPE staff_kind, certificate_kind, certificate_status, exam_kind, exam_result;` + удалить запись 0012 из `drizzle.__drizzle_migrations` и файлы `drizzle/0012_*`, `drizzle/meta/0012_snapshot.json`, строку журнала. Данных в новых таблицах до 6.2 нет — откат без потерь.

## Файлы (ожидаемо)

- `src/lib/server/db/schema/enums.ts`, `schema/certification.ts` (новый), `schema/index.ts`
- `drizzle/0012_*.sql`, `drizzle/meta/*`
- `src/lib/server/db/certification-schema.test.ts` (новый)

## Не ломать

- Миграции 0000–0011 и их тесты схемы (`*-schema.test.ts`).
- `users` / `events`: удаление со ссылками — по-прежнему запрещено FK.
- `npm run check` (типы схемы во всех сервисах).

## Проверка

- `npx vitest --run src/lib/server/db/certification-schema.test.ts`
- `npm run check`, `npm run lint`

## Риск

high (степени, баллы через сертификат, миграция).

## Читать

- `02` Общие соглашения, Enum-типы, разд. 1 `staff_profiles`, разд. 2 `exams`, `certificates`, Карта связей.
- `03` разд. 3–5.

## Фазы

- [x] SPEC
- [x] RED — `8cb0390`
- [x] GREEN — миграция 0012 на `parkour_dev`, тесты `src/lib/server/db` 28/28, check и lint PASS
- [ ] REVIEW — общим шагом в конце этапа

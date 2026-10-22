# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы (REVIEW — общим шагом в конце этапа 5) — `git show ce61380:docs/todo.md`.

## Задача

5.2 — согласия: загрузка участником (`/cabinet/documents`), админка проверки (`/admin/consents`, `05` § 10). Владелец 2026-10-22: REVIEW 5.1–5.x — одним шагом в конце этапа 5; здесь SPEC → RED → GREEN → REGRESS.

Решения владельца (2026-10-22): файлы — в **отдельном приватном бакете** R2 (`R2_PRIVATE_BUCKET`, те же ключи R2; без него загрузка — «недоступно»); JPEG / PNG / WebP / PDF до 10 МБ, тип — по первым байтам.

Решения агента (в `decisions.md`):
- Ключ `consents/<user id>/<uuid>.<ext>`; подпись — 10 в час на участника; просмотр — подписанная ссылка на 5 мин (`presignGet`, `Content-Type` по ключу), ни публичного URL, ни ключа в интерфейсе.
- Виды в кабинете: несовершеннолетнему — `parental`, `medical`, `privacy`; взрослому — только `medical` (`03` § 13.4; фото взрослого — флаг `show_avatar`).
- Каждая загрузка — новая строка `pending`; есть `pending` того же вида — файл заменяется в ней (старый объект удаляется). Одобренная остаётся в силе, пока новая на проверке.
- `signed_at` — дата подписи, вводит участник (не в будущем); `guardian_name` — из профиля (`parental`, `privacy`).
- «Действует» = `approved` и (`valid_until` пусто или > сейчас). `valid_until` — по желанию при одобрении, конец дня по Еревану, не в прошлом. Статус `expired` в базе не ставится (нужен cron) — истёкшее показывается «истекло» по дате.
- Решение — только из `pending` (`FOR UPDATE`); отказ — с причиной (≤ 500); журнал `consent.approve` / `consent.reject` на пользователя; письмо участнику после коммита на его языке.
- Модератор: имя, возраст, данные родителя; email — только с `users.read_full` (`04` § 4).
- «Требует действия» в кабинете: несовершеннолетний без действующего `parental` и без `pending` — `consent_parental`.

## Файлы (ожидаемо)

- `src/lib/validation/consents.ts` — типы файлов, ключ, схемы форм
- `src/lib/server/storage/types.ts`, `r2.ts`, `services/media/fake-storage.ts` — приватный бакет, `presignGet`
- `src/lib/server/services/consents/` — `files.ts` (загрузка), `own.ts` (кабинет), `review.ts` + `mail.ts` (решение), `admin-list.ts` (список и карточка), `valid.ts` (действующее согласие — и для 5.3)
- `src/routes/[[lang=lang]]/(site)/cabinet/documents/` — страница, загрузка; меню кабинета; `cabinet/overview.ts` — действие
- `src/routes/admin/consents/` — список, `[id]` — карточка, «Одобрить» / «Отклонить»
- `tests/e2e/admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-actions.ts`; `tests/e2e/consents.spec.ts`
- `src/lib/i18n/messages/{en,hy,ru}-consents.ts`; `.env.example`

## Не ломать

- Фото профиля (`services/cabinet/avatar.ts`) и медиатека — публичный бакет как был.
- Доступ: участник видит только свои согласия; гость и `editor` в `/admin/consents` — 403/404 (`access-coverage`, `admin-permissions`).
- Журнал: каждое действие админки — в картах (`audit-coverage`).
- Обзор кабинета взрослого без изменений.

## Проверка

- `npx vitest --run src/lib/server/services/consents src/lib/server/services/cabinet src/routes/admin`
- `npx playwright test tests/e2e/consents.spec.ts tests/e2e/admin-audit.spec.ts tests/e2e/admin-permissions.spec.ts`; `npm run check`, `npm run lint`

## Риск

`high` (личные данные несовершеннолетних, права, журнал).

## Читать

`02` § 9 · `03` § 13 · `04` § 2, 4, 5.1 · `05` § 10 · `06` § 5.1, 5.10

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW — общим шагом в конце этапа 5 (решение владельца 2026-10-22)

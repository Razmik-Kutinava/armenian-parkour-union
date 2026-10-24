# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`; 6.7c админка тренеров и судей (решения и «для REVIEW») — `git show ba7fd1a:docs/todo.md`; 6.8 кабинет `/cabinet/progress` (решения и «для REVIEW») — `git show 9b82a38:docs/todo.md`; 6.9 ежедневная задача сертификатов (решения, миграция 0013, «для REVIEW») — `git show f3ffcb4:docs/todo.md`; 6.10 тесты этапа 6 (охрана `users.level`, гонки) — `git show 2e15b67:docs/todo.md`.

## Задача

**7.1** (`09` этап 7): таблица `videos`, форма в кабинете, проверка платформы и дублей, лимит в месяц.

Граница с соседними задачами: модерация, скрытие и баллы `video_approved` — 7.2; полная видеоистория (причина отказа, пометка баллов, удаление до одобрения) — 7.7. В 7.1 на `/cabinet/videos` — форма и короткий список своих видео со статусом (чтобы видеть результат добавления).

Факты из документов:
- `02` § 6: `videos` — `id`, `user_id` FK, `url` not null, `platform` text (`youtube | instagram | tiktok | other`), `title`, `event_id` FK null, `status video_status` default `pending`, `reviewed_by`, `reviewed_at`, `reject_reason`, `created_at`; unique(`user_id`, `url`); индексы `user_id`, (`status`, `created_at`).
- `03` § 8: только ссылки YouTube / Instagram (список настраивается, Vimeo не нужен); одна ссылка у пользователя — один раз; статус `pending`, баллов до одобрения нет. § 6.2.7, § 16: лимит — «не более N одобренных видео в месяц», по умолчанию 5, ключ `site_settings`.
- `04` § 7: добавление видео — вход и активное членство.
- `06` § 5.7: форма — ссылка, название, событие (необязательно); проверка платформы и дублей.
- Разбор ссылок уже есть: `parseVideoUrl` (`components/site/hero/youtube.ts`, YouTube: watch / youtu.be / shorts / embed; Instagram: `/p/`, `/reel/`).

## Решения (приняты владельцем 2026-10-24, все — как предложено)

1. **Скрытие (`03` § 17 п. 3, для 7.2):** поле `hidden_at timestamptz null` в той же миграции (статус остаётся `approved`, баллы и подсчёт лимита не трогаются; как `hero_blocks.archived_at`). Альтернатива из `questions.md` — значение `hidden` в `video_status`.
2. **Лимит в месяц:** проверяется при добавлении — не больше N видео за календарный месяц по Еревану, считаются все добавленные (и отклонённые), удалённые участником — нет. Тогда и одобренных за месяц не больше N; в 7.2 отдельного лимита на баллы нет. Ключ `site_settings.videos` = `{ "monthly_limit": 5, "platforms": ["youtube", "instagram"] }`; нет или битый — значения по умолчанию (как `certificates`). Форма правки ключа в админке — в 7.2.
3. **Дубли:** в `url` хранится нормализованная ссылка (`https://www.youtube.com/watch?v=<id>`, `https://www.instagram.com/p|reel/<id>/`), поэтому `youtu.be/X` и `youtube.com/watch?v=X` — один дубль; unique(`user_id`, `url`) ловит гонку двух отправок.
4. **Активное членство** — обязательно (`04` § 7; `questions.md` — «предложено: да»).
5. **Удаление до одобрения** (7.7) — жёсткое: на `pending` / `rejected` баллов и ссылок нет; `deleted_at` не нужен.
6. **Событие в форме:** `published` или `finished`, уже начавшееся, не удалённое; список — последние 50.
7. **`updated_at`** — по соглашениям `02` (таблица изменяемая), как `consents` в 0011.

## Миграция 0014 («go» 2026-10-24, применена на dev)

`drizzle/0014_videos.sql`:
- `CREATE TYPE video_status AS ENUM ('pending', 'approved', 'rejected')`.
- `CREATE TABLE videos` — поля `02` § 6 + `hidden_at` (решение 1) + `updated_at`; `platform text not null` с check по списку `02`; FK на `users` (`user_id`, `reviewed_by`) и `events`.
- unique(`user_id`, `url`); индексы `user_id`, (`status`, `created_at`).
- check: `rejected` ⇔ непустая `reject_reason`; `hidden_at` только у `approved`; у `pending` нет `reviewed_at`.

Откат — `scripts/rollback/0014_down.sql`: `DROP TABLE videos; DROP TYPE video_status;` (только по «go»; данные видео теряются — на проде таблица пуста до деплоя этапа 7), затем убрать строку 0014 из `drizzle.__drizzle_migrations` и из `drizzle/meta`. Применение на dev — `npm run db:migrate` под Node 24; прод — Deploy (`release_command`).

## Файлы (ожидаемо)

- `src/lib/server/db/schema/videos.ts` (+ `enums.ts`, `index.ts`) — таблица и enum.
- `drizzle/0014_videos.sql`, `scripts/rollback/0014_down.sql` — миграция и откат.
- `src/lib/server/services/videos/submit.ts` (+ `submit.test.ts`) — `addVideo`: членство, платформа, нормализация, дубль, лимит, событие; одна транзакция с блокировкой `users` (гонка за лимит).
- `src/lib/server/services/videos/settings.ts` — чтение `site_settings.videos` со значениями по умолчанию.
- `src/routes/[[lang=lang]]/(site)/cabinet/videos/+page.server.ts`, `+page.svelte` — форма и список; пункт меню в `cabinet/+layout.svelte`; тексты — `messages/*`.
- `tests/e2e/cabinet-videos.spec.ts` — добавление и отказ по дублю.

## Не ломать

- Кабинет: гость на `/cabinet/videos` → `/login` с возвратом; чужие видео не видны.
- Баллы: добавление видео не пишет в `points_ledger` (баллы — только 7.2).
- Существующие миграции 0000–0013 и тесты схемы (`db/*-schema.test.ts`).
- Hero: `parseVideoUrl` и его тесты не меняются.

## Проверка

- `npx vitest run src/lib/server/services/videos src/lib/server/db` → PASS.
- `npx playwright test tests/e2e/cabinet-videos.spec.ts` → PASS; `npm run check`, `npm run lint`.

## Риск

`high` — миграция (`drizzle/*.sql`).

## Читать

- `02` § 6 (выписано выше), `03` § 8, § 6.2 п. 7, § 16 (выписано), `04` § 7 (выписано), `06` § 5.7 (выписано).
- `zone-notes.md` § «Кабинет», § «Баллы» (прочитаны).

## Фазы

- [x] SPEC (`fa4b61f`)
- [x] «go» на миграцию 0014 и решения 1–7
- [x] RED (`b58fc94`)
- [x] GREEN — Vitest задачи 95/95 (`src/lib/server/db`, `i18n`, `services/videos`, `validation/videos`), e2e `cabinet-videos` 2/2, `check`, `lint`
- [ ] REVIEW (этапа)

## Для REVIEW

- Блокировка строки `users` в `addVideo` — лимит и дубль под одновременными отправками; гонки отдельным тестом — в 7.8.
- `created_at` пишется временем сервиса (`now`), не `now()` базы: месяц лимита считается от того же времени.
- Сервер импортирует `parseVideoUrl` из `components/site/hero/youtube.ts` (как `services/hero/public.ts`).

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`; 6.7c админка тренеров и судей (решения и «для REVIEW») — `git show ba7fd1a:docs/todo.md`; 6.8 кабинет `/cabinet/progress` (решения и «для REVIEW») — `git show 9b82a38:docs/todo.md`; 6.9 ежедневная задача сертификатов (решения, миграция 0013, «для REVIEW») — `git show f3ffcb4:docs/todo.md`; 6.10 тесты этапа 6 (охрана `users.level`, гонки) — `git show 2e15b67:docs/todo.md`; 7.1 таблица `videos`, форма в кабинете (решения, миграция 0014, «для REVIEW») — `git show 1dddb1d:docs/todo.md`.

## Задача

**7.2** (`09` этап 7): очередь модерации видео — одобрить, отклонить, скрыть, пакетная обработка; баллы `video_approved` при одобрении; форма ключа `site_settings.videos` в админке (перенесена из 7.1).

Граница: видеохистория участника (причина отказа, пометка баллов, удаление) — 7.7; гонка двойного одобрения отдельным тестом — 7.8; публичного показа видео в MVP-роадмапе нет — скрытие пока только меняет поле.

Факты из документов:
- `05` § 11: очередь — по умолчанию «на проверке», старые сверху; колонки — участник, ссылка, платформа, событие, дата, статус; фильтры — статус, платформа; просмотр — плеер или «Открыть ссылку»; одобрить (баллы), отклонить (причина обязательна), скрыть; быстрые кнопки в строке и пакетная обработка выбранных.
- `03` § 8 п. 4–5: одобряет модератор или админ, `video_approved` — один раз; скрыть можно одобренное, баллы остаются. § 6.3 п. 5: модератор одобряет видео, но вручную баллы не начисляет. § 14: письмо «решение по видео» — после коммита, ошибка отправки не ломает действие. § 6.1: `video_approved` = 10.
- `04`: `videos.moderate` — moderator, admin. `05` § 21: «Параметры правил» — `settings.write` (admin), каждое изменение — в `audit_log`.
- Код: `awardPoints(tx, { rule: 'video_approved', userId, sourceId })` (повтор — тихий пропуск); check базы: `rejected` ⇔ непустая `reject_reason`, `reviewed_at` у всех, кроме `pending`, `hidden_at` только у `approved`.

## Решения (агент, по документам и образцу согласий 5.2; в `questions.md` — «предложено»)

1. **Переходы:** одобрить и отклонить — только `pending` (под блокировкой строки видео); скрыть — только `approved` и ещё не скрытое. Иначе — пропуск (`wrong_status`). Отклонённое не одобряется: участник удаляет и добавляет заново (7.7; удалённые в лимит не считаются). «Вернуть на сайт» в `05` нет — не делаю.
2. **Своё видео** сотрудник не одобряет и не отклоняет (`own_video`): одобрение своего = ручное начисление себе (`03` § 6.3 п. 5). Скрыть своё можно.
3. **Удалённый участник** — `not_found` (как согласия); заблокированный — модерируется.
4. **Журнал:** `video.approve` / `video.reject` / `video.hide`, `entity_type = 'user'`, `entity_id` = участник (видно в карточке участника, как согласия); в `after` — `videoId`, статус, баллы (`awarded` / причина пропуска) или причина отказа.
5. **Пакет:** до 25 id (размер страницы), одно действие на все, у отказа — одна причина на все; каждое видео — своя транзакция (ошибка одного не откатывает остальные); итог — `{ done, skipped }`. Быстрая кнопка в строке — тот же пакет из одного id.
6. **Письма:** одобрено (с числом баллов, если начислены) и отклонено (с причиной) — на языке участника, ссылка `/cabinet/videos`; скрытие — без письма.
7. **Список:** без `status` в адресе — `pending`; значения `pending | approved | hidden | rejected | all`; `approved` — без скрытых; сортировка `createdAt` (по умолчанию по возрастанию); поиск — имя участника; удалённые участники не видны. Просмотр — «Открыть ссылку» (новая вкладка, `rel="noopener noreferrer"`); встроенный плеер — нет (CSP, Instagram).
8. **Настройки:** вкладка `/admin/settings/videos` — лимит в месяц (1–100) и платформы (YouTube, Instagram, хотя бы одна); `saveVideoSettings` → `writeSettings` (журнал `settings.update`), только admin.
9. **Кеш:** публичного показа видео нет — `videos: []` в `cache/admin-groups.ts`.

## Файлы (ожидаемо)

- `src/lib/server/services/videos/review.ts` (+ `review.test.ts`, проект `server-points`) — `moderateVideos(db, actor, action, ids, input, deps)`: права, переходы, баллы, журнал, письма после коммита.
- `src/lib/server/services/videos/mail.ts` — `videoDecisionLetter`.
- `src/lib/server/services/videos/admin-list.ts` (+ `admin-list.test.ts`) — `listVideos`, `videoListOptions`.
- `src/lib/server/services/videos/settings.ts` (+ `settings.test.ts`) — `saveVideoSettings`.
- `src/lib/validation/videos.ts` (+ `videos.test.ts`) — схемы пакета, причины, формы настроек.
- `src/routes/admin/videos/+page.server.ts`, `+page.svelte` (+ компонент действий) — очередь; `src/routes/admin/settings/videos/+page.server.ts`, `+page.svelte`, `SettingsTabs.svelte`.
- `src/lib/i18n/messages/{en,hy,ru}-videos-admin.ts` (+ подключение); `cache/admin-groups.ts`; `vite.config.ts` (`RULES_TESTS`).
- e2e: `tests/e2e/admin-videos.spec.ts`; карты `admin-audit-map.ts`, `admin-access-map.ts`, исполнитель `admin-audit-videos.ts` + `admin-audit-actions.ts`.

## Не ломать

- Баллы: одобрение начисляет `video_approved` ровно один раз; повтор, отказ, скрытие, своё видео — без записи в `points_ledger`; выключенное правило — одобрение проходит без баллов.
- Права: member / editor — 403 на страницу и действия, данные не меняются (`admin-permissions.spec.ts`); модератор — очередь да, настройки видео нет.
- 7.1: `addVideo` и `/cabinet/videos` — как были; `parseVideoSettings` с ключом без поля — значения по умолчанию.
- Существующие вкладки настроек и `payment-settings` e2e.

## Проверка

- `npx vitest run --project server-points src/lib/server/services/videos/review.test.ts` и `npx vitest run src/lib/server/services/videos src/lib/validation/videos.test.ts src/lib/server/cache src/routes/admin` → PASS.
- `npx playwright test tests/e2e/admin-videos.spec.ts` → PASS; `npm run check`, `npm run lint`.

## Риск

`high` — баллы, журнал действий, права.

## Читать

- `05` § 11, § 21 (выписано), `03` § 8, § 6.1, § 6.3 п. 5, § 14 (выписано), `04` `videos.moderate` (выписано).
- `zone-notes.md` § «Видео», § «Баллы», § «Контент и админка» (прочитаны).

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

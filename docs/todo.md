# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`.

## Задача

6.7 — админка экзаменов, сертификатов, тренеров и судей (`05` § 7–9). Без миграции. Три шага, REVIEW — общим в конце этапа 6:

- 6.7a — «Экзамены» — GREEN `a89554d`.
- **6.7b (текущий)** — «Сертификаты»: список, выдача, карточка (PDF: открыть, пересоздать; отзыв; ссылка проверки); «Выдать сертификат» на сданном экзамене. «ебашь» владельца — 2026-10-24.
- 6.7c — «Тренеры и судьи».

### 6.7b — SPEC

Факты (`05` § 8, § 1 п. 7; `04` § 3–4): список — номер, участник, тип, уровень или категория, дата выдачи, срок, статус; фильтры — тип, статус, истекающие в 60 дней. Выдача (admin) — участник (поиск), тип, уровень / категория, экзамен (сданный или пусто с комментарием), дата выдачи и срок (по умолчанию из настроек), комментарий. После — степень и баллы одной транзакцией, затем PDF и письмо (всё в `issueCertificateNow`). Действия — открыть PDF, пересоздать PDF, отозвать (admin, причина, диалог подтверждения), скопировать ссылку проверки. Номер не редактируется. Права: просмотр — moderator, admin (`certificates.read`); выдача и пересоздание PDF — `certificates.issue`; отзыв — `certificates.revoke` (admin).

Решения агента 6.7b (в рамках документов):
- **Адреса**: `/admin/certificates` (список), `/admin/certificates/new` (выдача, только admin), `/admin/certificates/[id]` (карточка, `?/pdf`, `?/revoke`). Меню уже есть.
- **Список**: фильтры `kind` (`level_advanced` / `level_pro` / `trainer` / `judge` — как названия сертификатов), `state` (`active` / `expired` / `revoked` — по `certificateState`: `active` с прошедшим `expires_at` — истёк, не дожидаясь 6.9), `expiring` (`60` — действует и истекает в 60 дней). Поиск — имя и номер, admin — и email. Сортировка — дата выдачи (новые сверху) и срок (без срока — в конце). Email в строках не отдаётся.
- **PDF**: в карточке — пятиминутная подписанная ссылка на приватный бакет (как согласия, `presignGet(file_key, 'application/pdf')`), открывается в новой вкладке, браузер показывает и даёт скачать. Отдельного `+server.ts` нет. Нет бакета или файла — «PDF ещё не создан» и кнопка «Пересоздать PDF». `Content-Disposition: attachment` (заметка 6.4) не ставлю: файл делает наш сервер, без JS, и лежит на чужом домене R2 — расширять `PrivateStorage` ради имени файла не стал.
- **Выдача**: участник — как в 6.7a (GET `?q=` → `?member=`; `examMember`, admin видит всех). `?exam=<id>` — сданный экзамен: участник, тип, уровень и экзамен подставляются. Экзамен — список сданных экзаменов участника без живого сертификата. Тип — `level` / `trainer` / `judge`; уровень — только у степени; категория и срок — только у тренера / судьи (с JS лишние поля скрыты; без JS сервер их отбрасывает по типу). Дата выдачи — день (пусто или сегодня — сейчас; прошлый день — полночь Еревана); срок — день (полночь Еревана), пусто — `staff_valid_months` (подсказка с числом). После выдачи — карточка с `?issued=<итог PDF>`: «Выдан» и почему нет PDF.
- **Отзыв**: `ConfirmDialog` с обязательным комментарием (= причина), только у неотозванного и только admin. Степень и баллы не трогаются (сервис 6.3) — текст диалога это говорит.
- **Ссылка проверки**: `PUBLIC_SITE_URL` (или адрес запроса) + `/certificate/{token}` — тот же адрес, что в QR; поле только для чтения и кнопка «Копировать».
- **Карточка экзамена**: у сданного — живой сертификат (номер, ссылка) или admin-у «Выдать сертификат» (`/admin/certificates/new?exam=<id>`).
- **Отказы** → сообщения у поля: `expiry_invalid` → срок, `comment_required` → комментарий, `exam_*` → экзамен; остальное — над формой. Пересоздание: `assets_missing`, `storage_missing`, `site_url_missing`, `revoked`; `not_found` → 404.

## Файлы 6.7b (ожидаемо)

- `src/lib/server/services/certificates/list.ts` (+ `list.test.ts`) — `certificateListOptions`, `listCertificates(db, viewer, state, now)`
- `src/lib/server/services/certificates/card.ts` (+ `card.test.ts`) — `getCertificateCard`, `issuableExams`, `certificateOfExam`, `certificatePdfLink`
- `src/lib/validation/admin-certificates.ts` (+ `.test.ts`), `certificate-enums.ts`
- `src/routes/admin/certificates/` — список, `new/` (+ `IssueForm.svelte`), `[id]/` (+ действия), `outcome.ts`; `src/routes/admin/exams/[id]/` — ссылка выдачи
- `src/lib/i18n/messages/{en,hy,ru}-certificates-admin.ts` + подключение
- `tests/e2e/admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-actions.ts`, `admin-audit-certificates.ts` (новый), `admin-audit.spec.ts`, `admin-permissions.spec.ts`, `admin-permissions-certs.ts` (новый — `admin-permissions-fixtures.ts` уже 229 строк), `admin-certificates.spec.ts` (новый)

## Не ломать 6.7b

- Права: модератор видит список и карточку, но не выдаёт, не отзывает и не пересоздаёт PDF (403, данные не меняются); редактор и участник — ничего (K1).
- Степень меняется только выдачей сертификата степени, без пропуска уровня; отзыв степень не трогает (K3, сервис 6.3 без изменений — `certificates/*.test.ts`).
- Email и дата рождения участника не уходят в список и карточку (K4).

## Проверка 6.7b

- `npx vitest --run src/lib/server/services/certificates/list.test.ts src/lib/server/services/certificates/card.test.ts src/lib/validation/admin-certificates.test.ts src/routes/admin`
- `npx playwright test tests/e2e/admin-certificates.spec.ts tests/e2e/admin-permissions.spec.ts tests/e2e/admin-audit.spec.ts`; `npm run check`, `npm run lint`

## Риск

high (выдача и отзыв — степени и баллы, K3; права — K1). Сервис выдачи не меняется, поверх — формы.

## Читать

- `05` § 1, 8. `04` § 3–4 (прочитаны). Сервисы 6.3–6.6 — `zone-notes.md` § «Экзамены и сертификаты».

## Фазы 6.7b

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW — общим шагом в конце этапа

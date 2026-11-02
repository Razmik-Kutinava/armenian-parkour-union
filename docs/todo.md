# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.10 — фотоотчёт с мероприятия (фото или ссылка), проверка admin, баллы `volunteer_report` через журнал (`09` п. 10.10; `03` § 19.7 п. 2–4, § 19.9). Миграции нет (таблица `volunteer_reports` в 0018).

## Файлы (ожидаемо)

- `src/lib/server/services/volunteer/report-submit.ts` (+ test) — участник после `attended`: фото (приватный бакет) или ссылка + комментарий; замена `pending`; после `rejected` — новая строка
- `src/lib/server/services/volunteer/report-review.ts` (+ test) — admin: принять (`awardPoints` `volunteer_report`, source = отчёт) / вернуть (комментарий); свой — отказ; письмо
- `src/lib/server/services/volunteer/report-files.ts` + `report-link.ts` (+ test ссылок) — ключ `volunteer/<user>/<uuid>.ext`, sniff JPEG/PNG/WebP ≤ 10 МБ; нормализация Instagram / YouTube / Drive
- `src/lib/server/services/volunteer/report-list.ts` / `report-own.ts` — очередь admin, карточка + история по приглашению, статус в кабинете; дашборд / обзор
- `src/routes/admin/volunteer/reports/*` + `cabinet/volunteer` (форма в `InvitesBlock`) + i18n; карты e2e `admin-access-map` / `admin-audit-volunteer` / `admin-permissions-volunteer`

## Решения агента (в пределах документов)

1. Ссылка — один хелпер: Instagram (`normalizeVideoUrl`) + YouTube + Google Drive (`normalizePracticeUrl`); иначе отказ.
2. Фото: ключ `volunteer/<userId>/<uuid>.<ext>` (`02` § 12); type по сигнатуре (`sniffMime`); лимит 10 МБ; rate-limit как у согласий (`volunteerReportUploadPerUser`).
3. `pending` — обновление той же строки (файл/url/note); `rejected` — insert новой; `approved` — нельзя менять и отзывать.
4. Принять / вернуть: только `pending`, не своё; журнал `volunteer_report.approve|reject`; баллы один раз (`source_type`/`source_id` = отчёт); письмо после коммита.
5. Сверка «показанного» при решении (как 9.14): скрытое `url` или `fileKey` с карточки — иначе `changed`.
6. Порядок блокировок: приглашение → строка отчёта. Фотоотчёты не публичны — admin смотрит по `presignGet` 5 мин.
7. Дашборд: счётчик `pending` отчётов (`05` § 3); обзор кабинета — вернули отчёт (`06` § 5.12). Образцы: `practice-submit` / `practice-review`, `videos/review` (баллы), `consents/files` (upload).

## Не ломать

- Баллы (K3): повтор «Принять» / второй отчёт на то же приглашение не дублируют `volunteer_report`; `volunteer_participation` при явки — без регресса.
- Права (K1): модератор / редактор / участник не решают чужие отчёты; чужой `invitationId` / `reportId` в кабинете — отказ; свой отчёт admin — без кнопок.
- Приватность (K4): `file_key` и сырой бакет не отдаются клиенту; только подписанная ссылка admin; фото не в публичный R2.
- 10.8–10.9: ответы, явка, streak, finish — без регресса; схема 0018 без миграций.

## Проверка

- `npx vitest run src/lib/server/services/volunteer/report-submit.test.ts src/lib/server/services/volunteer/report-review.test.ts src/lib/server/services/volunteer/report-link.test.ts`
- `npm run check`, `npm run lint`

## Риск

`high` — баллы (K3), `volunteer.manage`, `audit_log`, приватные фото (K4), письма.

## Читать

- `03` § 19.7 п. 2–4; § 19.9; § 6.1 (`volunteer_report`)
- `05` § 28 «Фотоотчёты»; § 3 дашборд (счётчик отчётов)
- `06` § 5.12 «Приглашения» (форма отчёта), обзор кабинета; § 6 письма
- `04` § 3.1–3.2 (фотоотчёт), § 5.1 `volunteer.manage`
- `02` § 12 `volunteer_reports`; § 5 ledger `source_type = volunteer_report`
- `zone-notes.md` § «Волонтёрство» (10.9 → 10.10); § «Баллы» (`awardPoints`, `RULE_SOURCES`)
- образцы: `practice-submit.ts`, `practice-review.ts`, `videos/review.ts`, `consents/files.ts`, `videos/link.ts`, `practice-link.ts`

## Фазы

- [x] SPEC
- [x] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

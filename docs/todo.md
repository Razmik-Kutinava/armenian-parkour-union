# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.1 — таблицы волонтёрства одной миграцией (`drizzle/0018_volunteer.sql`) строго по `02` разд. 12. Migration Gate: план и откат ниже → ждать «go» до RED.

## Файлы (ожидаемо)

- `src/lib/server/db/schema/enums.ts` — 3 enum + 2 значения `points_reason`
- `src/lib/server/db/schema/volunteer-partners.ts` — `volunteer_partners`, `volunteer_perks`, `partner_cashiers`
- `src/lib/server/db/schema/volunteer-cards.ts` — `volunteer_cards`, `perk_redemptions`
- `src/lib/server/db/schema/volunteer-requests.ts` — `volunteer_requests`, `volunteer_invitations`, `volunteer_reports`
- `src/lib/server/db/schema/index.ts` — экспорт трёх файлов
- `drizzle/0018_volunteer.sql` + `drizzle/meta` — `db:generate`, руками дописан триггер append-only
- `scripts/rollback/0018_down.sql`
- `src/lib/server/db/volunteer-schema.test.ts` — RED

## Не ломать

- `points_ledger`: начисления, обратные записи, «один раз на источник» (`points_ledger_source_once_key`) — только добавляются значения enum, таблица не меняется.
- Существующие 18 миграций и `release_command` на проде: миграция только добавляет (`CREATE`, `ALTER TYPE … ADD VALUE`), ничего не меняет и не удаляет.
- Портал (`practice_status`): enum переиспользуется без изменений.

## Проверка

- `npx vitest run src/lib/server/db/volunteer-schema.test.ts src/lib/server/db/points-schema.test.ts src/lib/server/db/schema.test.ts`
- `npm run check`, `npm run lint`

## Риск

`high` — миграция (`drizzle/*.sql`), касается enum баллов.

## Читать

- `02` § Общие соглашения, § Enum-типы, § 12 Волонтёрство (прочитано: факты ниже в плане)
- образец: `schema/training-progress.ts`, `drizzle/0009_points.sql` (триггер), `scripts/rollback/0016_down.sql`

## Migration Gate — план

**Новые enum:** `volunteer_card_status` (`pending, active, rejected, revoked`), `perk_kind` (`reusable, single`), `volunteer_request_status` (`draft, open, finished, cancelled`), `volunteer_answer` (`invited, accepted, declined, expired, excused, attended, no_show`).
**Изменение enum:** `points_reason` + `volunteer_participation`, `volunteer_report` (в конец, `ALTER TYPE … ADD VALUE`). `practice_status` — без изменений, используется в `volunteer_reports`.

**Таблицы** (поля, FK, индексы — как в `02` разд. 12; `id uuid default gen_random_uuid()`, `created_at` / `updated_at` `timestamptz not null default now()`):

| Таблица | Ограничения и индексы сверх полей |
|---|---|
| `volunteer_partners` | индекс (`status`, `sort_order`) |
| `volunteer_perks` | индекс (`partner_id`, `status`); check `(kind = 'single') = (uses_limit IS NOT NULL)`, `uses_limit >= 1`, `valid_from <= valid_until` |
| `partner_cashiers` | unique `invite_token_hash`, unique `device_token_hash`; индекс `partner_id` |
| `volunteer_cards` | unique `user_id`, `number`, `public_token`; индексы (`status`, `applied_at`), `flagged_at` where not null; check `decline_streak >= 0`, `review_note` непустой при `rejected` / `revoked` |
| `perk_redemptions` | **append-only**: триггеры `forbid_append_only_change()` на UPDATE/DELETE и TRUNCATE (как `points_ledger`); unique `reversal_of_id`; индексы (`card_id`, `perk_id`), (`partner_id`, `created_at` desc), (`cashier_id`, `created_at` desc); check: обратная запись ⇔ `reversal_of_id`, `comment` (непустой), `created_by` заполнены и `cashier_id` пуст; у отметки — наоборот |
| `volunteer_requests` | индексы (`status`, `respond_by`), `event_id`; check `ends_at >= starts_at`, `places >= 1`, `respond_by <= starts_at` |
| `volunteer_invitations` | unique (`request_id`, `user_id`); индексы (`user_id`, `created_at` desc), (`request_id`, `status`) |
| `volunteer_reports` | check `num_nonnulls(file_key, url) = 1`, `review_note` непустой при `rejected`; partial unique (`invitation_id`) where `status in ('pending','approved')`; индексы (`status`, `created_at`), `user_id` |

Все FK — `ON DELETE no action` (удаление мягкое). Данных в миграции нет; ключ `site_settings.volunteer` и правила баллов `volunteer_*` — seed, в задачах 10.9–10.10.
`ALTER TYPE … ADD VALUE` внутри транзакции мигратора допустим (PostgreSQL ≥ 12): новые значения в этой же миграции не используются.

**Применение:** dev (`parkour_dev`) — `npm run db:migrate` после «go»; прод — `release_command` при следующем деплое (по «деплой»).

## Migration Gate — откат

`scripts/rollback/0018_down.sql`, одной транзакцией, только по «go» и после того, как код перестал читать таблицы:
1. `DROP TABLE` в обратном порядке: `volunteer_reports`, `volunteer_invitations`, `volunteer_requests`, `perk_redemptions` (триггеры уходят с таблицей), `volunteer_cards`, `partner_cashiers`, `volunteer_perks`, `volunteer_partners`.
2. `DROP TYPE` `volunteer_answer`, `volunteer_request_status`, `perk_kind`, `volunteer_card_status`.
3. Значения `volunteer_participation`, `volunteer_report` в `points_reason` **остаются**: PostgreSQL не удаляет значение enum, а записи `points_ledger` с ними (если появятся) удалять нельзя — журнал append-only. Без кода они ни на что не влияют.
4. Удалить строку 0018 из `drizzle.__drizzle_migrations` и запись 0018 из `drizzle/meta`.

Теряется: все партнёры, плюшки, кассиры, книжки, использования, запросы, ответы и фотоотчёты (начисленные баллы остаются в `points_ledger`). Сейчас данных нет — откат до запуска фичи ничего не теряет.

## Фазы

- [x] SPEC
- [ ] «go» на миграцию
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

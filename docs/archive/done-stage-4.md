# Сделано — этап 4 (архив)

Формат: `дата | задача | итог | коммит`. Переносится из `PROGRESS.md` («Сделано»), когда там больше 5 записей.

- 2026-10-20 | 4.1 | миграция 0009 на dev («go» владельца; откат `scripts/rollback/0009_down.sql`, не прогонялся): enum `points_reason`, `points_rules` (+ `created_at`), `points_ledger` — UPDATE / DELETE / TRUNCATE запрещены триггером, один источник — одно начисление (кроме `manual` / `reversal`), запись отменяется один раз (unique `reversal_of_id`), проверки `delta <> 0`, комментарий у `manual` / `reversal`, `reversal_of_id` только у `reversal`; `users.points_balance` уже был; RED до миграции 6/6 падений → после 6/6; Vitest 856/857 (`hero/public` — часы машины); `check` 0, `lint` чистый | `4499425`

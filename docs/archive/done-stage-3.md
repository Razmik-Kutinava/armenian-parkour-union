# Сделано — этап 3 (архив)

Формат: `дата | задача | итог | коммит`. Переносится из `PROGRESS.md` («Сделано»), когда там больше 5 записей.

- 2026-10-18 | 3.1 | миграция 0007 на dev (откат `scripts/rollback/0007_down.sql`, не прогонялся): `memberships`, `payments`, `payment_webhook_events`, `donation_purposes` и 3 enum по `02`; журнал вебхуков — менять можно только `processed_at` и `error`, удалять и очищать нельзя (триггер); `memberships.updated_at`, метки времени у `donation_purposes` (решение 2026-10-18); unit 528; REVIEW: bugbot 0, security 0, crit-audit CLEAN | `034fc4b`

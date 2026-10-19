# Сделано — этап 3 (архив)

Формат: `дата | задача | итог | коммит`. Переносится из `PROGRESS.md` («Сделано»), когда там больше 5 записей.

- 2026-10-18 | 3.1 | миграция 0007 на dev (откат `scripts/rollback/0007_down.sql`, не прогонялся): `memberships`, `payments`, `payment_webhook_events`, `donation_purposes` и 3 enum по `02`; журнал вебхуков — менять можно только `processed_at` и `error`, удалять и очищать нельзя (триггер); `memberships.updated_at`, метки времени у `donation_purposes` (решение 2026-10-18); unit 528; REVIEW: bugbot 0, security 0, crit-audit CLEAN | `034fc4b`
- 2026-10-18 | Deploy этапов 1–2 и 3.1 | runs 39135268763 (`c6f621d`) и 39136554995 (`ee07760`, фикс: `www.parkour.am` отдавал 500 — `redirect()` SvelteKit 3 не пускает на другой хост, теперь 301; e2e `canonical-host`, bugbot 0, security 0): `release_command` применил 0003–0007; `/`, `/ru`, `/hy`, `/events`, `/news`, `/login`, `/register`, `sitemap.xml` → 200, `/admin` → 303, `www.` → 301; текст фестиваля не менялся (заголовок `h1` → `h2`); `/federation` → 404 до `db:seed` | `ee07760`

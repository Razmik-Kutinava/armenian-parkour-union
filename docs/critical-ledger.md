# Журнал критических находок (`/crit-audit`)

> Правила — `.cursor/commands/crit-audit.md`, список K1–K5 — `.cursor/rules/sbr.mdc`.
> Только дописывается; статус строки меняется, строки не удаляются.

| Параметр | Значение |
|---|---|
| `last_audited_sha` | `4119ae4` |
| Дата | 2026-10-08 |
| Вердикт | CLEAN |

## Находки

Статусы: `open` · `fixed` · `rejected: no-repro` · `rejected: not-K` · `accepted-risk` (только решением владельца).

| ID | K | Где (`файл:строка`) | Сценарий | Тест | Статус | Коммит |
|---|---|---|---|---|---|---|
| C1 | — | `src/lib/server/auth/return-to.ts:13` | `/login?returnTo=/.//evil.com` → после входа `//evil.com` (открытый редирект) | `return-to.test.ts` | rejected: not-K (исправлено) | 1.5 REVIEW |
| C2 | — | `src/lib/server/auth/register.ts:44` | регистрация отвечает «email уже есть» — можно проверить, зарегистрирован ли адрес | — | rejected: not-K (в «Известные проблемы») | — |
| C3 | — | `src/lib/server/auth/sign-in.ts:31` | «аккаунт заблокирован» видно только при верном пароле | — | rejected: not-K | — |
| C4 | K4 | `src/lib/server/mail/index.ts:5` | ссылки с токенами сброса и подтверждения пишутся в лог Fly | — | accepted-risk (решение владельца 2026-10-07: письма в лог до 0.10) | — |
| C5 | — | `verify-email/+page.server.ts:8` | почтовый сканер откроет ссылку раньше пользователя | — | rejected: no-repro (токен — JWT, повторное открытие даёт «подтверждён») | — |
| C6 | — | `src/lib/i18n/locales.ts:27` | `https://parkour.am//evil.com` → ссылки переключателя языка `//evil.com` (уход на чужой сайт) | `locales.test.ts` | rejected: not-K (исправлено) | `473d27f` |
| C7 | K1 | `src/lib/server/seed/admin.ts:37` | пока на сайте нет админа, кто-то регистрируется на email будущего админа → `db:seed` с `SEED_ADMIN_EMAIL` повышает этот аккаунт, пароль `SEED_ADMIN_PASSWORD` не сверяется → чужой человек — admin | `seed/admin.test.ts` «refuses to promote…» | fixed (повышение только при совпадении пароля аккаунта) | `2d60f2e` |
| C8 | — | `src/lib/server/services/media/upload.ts:61` | editor загружает PDF со встроенным JavaScript (`%PDF-` в начале проходит проверку) → публичная ссылка открывается во встроенном просмотрщике | — | rejected: not-K (загружают только editor/admin; в «Известные проблемы»: отдавать PDF с `Content-Disposition: attachment` при подключении R2) | — |

## История аудитов

| Дата | Scope | Вердикт | Новых | Коммит |
|---|---|---|---|---|
| 2026-10-07 | 1.5 авторизация: `src/lib/server/auth`, `validation`, `(auth)` | CLEAN | 0 критичных (C1–C5 не K или приняты) | 1.5 REVIEW |
| 2026-10-07 | 1.6 сессия: `hooks.server.ts`, `auth/session.ts`, `canonical-host.ts` | CLEAN | 0 | `2d44b3f` |
| 2026-10-07 | 1.7 права: `permissions.ts`, `guard.ts`, `role-rules.ts`, `routes/admin` | CLEAN | 0 | `c9555ff` |
| 2026-10-07 | 1.8 каркас: `(site)/+layout*`, `components/site`, `services/site-settings.ts`, `validation/site-settings.ts`, `+error` | CLEAN | 0 критичных (C6 не K, исправлено) | `473d27f` |
| 2026-10-07 | 1.9 оболочка админки: `server/admin/nav.ts`, `components/admin`, `routes/admin`, `admin/locale/+server.ts`, `hooks.server.ts` | CLEAN | 0 | `1b857a1` |
| 2026-10-07 | 1.10a пользователи и роли: `services/users/*`, `services/audit.ts`, `auth/credential.ts`, `validation/admin-users.ts`, `routes/admin/users`, `routes/admin/roles` | CLEAN | 0 (bugbot: 2 отклонены валидатором; security: 0) | `7d1f517` |
| 2026-10-07 | 1.10b журнал и настройки: `services/audit-list.ts`, `audit-csv.ts`, `site-settings.ts`, `validation/site-settings*.ts`, `routes/admin/audit`, `routes/admin/settings`, `FilterBar`, `LocalizedInput` | CLEAN | 0 (bugbot: 1 отклонена валидатором; security: 0) | `527a26d` |
| 2026-10-07 | 1.11 аудит действий админки: только тесты (`routes/admin/audit-coverage.test.ts`, `tests/e2e/admin-audit*`) | CLEAN | 0 (bugbot: 0) | `8380bd8` |
| 2026-10-07 | 1.12 seed: `server/seed/*`, `scripts/seed.ts`, `package.json` | CLEAN | 1 (C7 K1, fixed; bugbot: 1 не K — `.env` не читается при заданном `DATABASE_URL`, намеренно) | `2d60f2e` |
| 2026-10-07 | 1.13 тесты этапа: только тесты (`access-coverage.test.ts`, `tests/e2e/admin-access-map.ts`, `admin-permissions.spec.ts`, `admin-block.spec.ts`, `account.test.ts`, `schema.test.ts`); кода приложения нет | CLEAN | 0 (bugbot: 0; мутации прав ловятся матрицей) | `d533ede` |
| 2026-10-07 | 2.1 медиабиблиотека: `services/media/*`, `storage/*`, `validation/media.ts`, `routes/admin/media`, `env.ts`, `drizzle/0002`, `package.json` (AWS SDK v3) | CLEAN | 0 (bugbot: 2 отклонены валидатором; security: 1 средняя — C8 не K) | `a30b0bf` |
| 2026-10-08 | 2.2 редактор: `server/rich-text/*`, `components/admin/RichText*`, `rich-text-extensions.ts`, `app.css`, `package.json` (TipTap, sanitize-html) | CLEAN | 0 (bugbot: 2 не K — грязная форма и `aria-invalid`, исправлены `19a0204`; security: 0) | `19a0204` |
| 2026-10-08 | 2.3 страницы: `services/pages/*`, `services/media/usage.ts`, `validation/pages.ts`, `seed/pages.ts`, `routes/admin/pages`, `(site)/pages`, `(site)/federation`, `components/site`, `drizzle/0003` | CLEAN | 0 (bugbot: 0; security: 0; свой проход: гонка двух одновременных созданий с одним адресом → 500, без теста — не K) | `b59755b` |
| 2026-10-08 | 2.4 новости: `services/posts/*`, `services/media/usage.ts`, `media/list.ts`, `validation/posts.ts`, `lib/seo/*`, `components/site/News*`, `SeoHead`, `ShareButton`, `routes/admin/news`, `(site)/news`, `drizzle/0004` | CLEAN | 0 (bugbot: 1 не K — выбор обложки только из 25 картинок, исправлено `4119ae4`; security: 0; свой проход: невозможная дата в фильтре периода админки → 500, только для staff — не K, исправлено `4119ae4`) | `4119ae4` |

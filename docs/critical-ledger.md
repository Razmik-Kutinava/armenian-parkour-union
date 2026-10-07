# Журнал критических находок (`/crit-audit`)

> Правила — `.cursor/commands/crit-audit.md`, список K1–K5 — `.cursor/rules/sbr.mdc`.
> Только дописывается; статус строки меняется, строки не удаляются.

| Параметр | Значение |
|---|---|
| `last_audited_sha` | 1.12 GREEN (коммит `fix: C7`) |
| Дата | 2026-10-07 |
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
| C7 | K1 | `src/lib/server/seed/admin.ts:37` | пока на сайте нет админа, кто-то регистрируется на email будущего админа → `db:seed` с `SEED_ADMIN_EMAIL` повышает этот аккаунт, пароль `SEED_ADMIN_PASSWORD` не сверяется → чужой человек — admin | `seed/admin.test.ts` «refuses to promote…» | fixed (повышение только при совпадении пароля аккаунта) | 1.12 |

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
| 2026-10-07 | 1.12 seed: `server/seed/*`, `scripts/seed.ts`, `package.json` | CLEAN | 1 (C7 K1, fixed; bugbot: 1 не K — `.env` не читается при заданном `DATABASE_URL`, намеренно) | 1.12 |

# Архив: этап 0 — Подготовка

> Перенесено из `PROGRESS.md` командой `/trim`. Только дописывается, не правится.
> Читать только по запросу (поиск по истории). Короткая история — `git log`.

## Сделано

Формат записи: `дата | задача | что сделано | затронутые файлы | как проверить`

- 2026-10-06 | документация | правила агента и документы 00–09, PROGRESS; документы связаны ссылками, согласованные правки внесены | `.cursor/rules/main.mdc`, `docs/*` | открыть `docs/`, проверить ссылки между документами
- 2026-10-06 | GitHub | репозиторий подключён: `origin` → github.com/Razmik-Kutinava/armenian-parkour-union, ветка `master` | — | `git remote -v`
- 2026-10-06 | 0.6 (частично) | CI по образцу CoffeeOS: `ci.yml` (docs, lint, typecheck, scan_deps, test с Postgres, e2e с Postgres), `codeql.yml` (actions, javascript-typescript), `semgrep.yml`. Dependabot не подключён: он создаёт свои ветки и PR, а работаем в одной ветке `master`. Пока нет `package.json`, задачи с кодом пропускаются с notice и остаются зелёными; после задачи 0.3 начинают проверять по-настоящему | `.github/*` | вкладка Actions на GitHub — все запуски зелёные
- 2026-10-06 | процесс | SBR по образцу CoffeeOS: правило `sbr.mdc`, команды `/start` `/spec` `/sbr` `/regress` `/review` `/deploy` `/patch`, трекер `docs/todo.md`; REVIEW с двумя субагентами (`bugbot`, `security-review`), push внутри REVIEW, деплой по апруву | `.cursor/rules/sbr.mdc`, `.cursor/commands/*`, `docs/todo.md`, `main.mdc`, `09` | набрать `/` в чате Cursor — команды видны
- 2026-10-06 | решения владельца | хостинг Fly + секреты, языки (en по умолчанию), Google-вход, почта отложена, баллы за места, доступ гостя и участника; дефолты по расхождениям | `00`, `01`, `02`, `03`, `05`, `06`, `09`, `PROGRESS` | `docs/questions.md`
- 2026-10-06 | 0.1, 0.3, 0.5 | `.gitignore` (его не было), `.env.example`, локальный `.env` (не в git); SvelteKit + TS strict, Tailwind, ESLint, Prettier, Vitest (unit), Playwright, adapter-node через `sv create`; папки из `01`, заглушка на `/` в `(site)`, e2e `tests/e2e/home.spec.ts`; Prettier не трогает `docs/`, `.cursor/`, `.github/`; в CI `db:migrate --if-present` до задачи 0.4 | корень, `src/`, `tests/`, `.github/workflows/ci.yml` | `npm run dev` → http://localhost:5173
- 2026-10-06 | 0.7 (часть 1: подготовка к деплою) | `Dockerfile` (node 22 slim, двухэтапная сборка, запуск от `node`), `.dockerignore`, `fly.toml` (app `armenian-parkour-union`, регион `fra`, порт 3000, HTTPS, `release_command = npm run db:migrate --if-present`, 512 МБ, машина засыпает без трафика), ручной workflow `deploy.yml` (только `workflow_dispatch`, ветка `master`, environment `production`, секрет `FLY_API_TOKEN`); приложение создано на Fly (`fly apps create`), деплоя ещё не было | `Dockerfile`, `.dockerignore`, `fly.toml`, `.github/workflows/deploy.yml` | `npm run build`, затем `node build` → http://localhost:3000; `fly config validate`
- 2026-10-06 | fix деплоя | миграции через `scripts/migrate.js` (drizzle-orm migrator, без drizzle-kit в проде; пропуск, если миграций нет); `db:migrate` и `release_command` используют его; в образ копируются `drizzle/` и скрипт; `DATABASE_URL` необязателен при сборке (Docker, CI), обязателен при обращении к БД | `scripts/migrate.js`, `Dockerfile`, `fly.toml`, `src/env.ts`, `src/lib/server/db/index.ts` | сборка и запуск без `.env` → 200
- 2026-10-06 | 0.7 (часть 2) | первый `fly deploy` по апруву владельца — образ 68 МБ, `release_command` прошёл (миграций нет — пропуск), машина `fra` запущена, health check проходит; секрет `DATABASE_URL` (`parkour_prod`) задан владельцем в панели Fly. IP при первом деплое не выдались автоматически — выделены вручную: shared IPv4 `66.241.125.31`, IPv6 `2a09:8280:1::1a9:6a4a:0` | — | запрос по IP → 200, заголовок «Armenian Parkour Union»
- 2026-10-06 | 0.7 (деплой из GitHub) | владелец добавил `FLY_API_TOKEN` в GitHub Secrets; workflow Deploy (ручной запуск) прошёл, `release_command` → `Migrations applied` на `parkour_prod`. Контур замкнут: код → GitHub (CI) → Deploy → Fly → Neon (dev и prod на одной миграции `0000_init`) | `.github/workflows/deploy.yml` | сайт по имени → 200
- 2026-10-06 | 0.4 («go» владельца) | пустая миграция `drizzle/0000_init.sql` (`drizzle-kit generate --custom`), применена к `parkour_dev` — `drizzle.__drizzle_migrations` = 1 запись. На `parkour_prod` применяется при деплое (`release_command`) | `drizzle/` | `npm run db:migrate`
- 2026-10-06 | Fly | лишнее приложение `armenian-parkour-union-rhzcwq` (автодеплой из GitHub через панель Fly) удалено владельцем; остаётся одно — `armenian-parkour-union` | — | `fly apps list`
- 2026-10-06 | процесс | `/trim`: PROGRESS порезан, архив этапа 0, `questions.md`, `decisions.md`, оглавления в больших документах | `docs/*`, `.cursor/commands/trim.md` | `PROGRESS.md` ≤ 80 строк
- 2026-10-06 | 0.7 (домен) | `parkour.am` подключён владельцем: сертификат Fly `Issued`, `https://parkour.am` → 200. `www.parkour.am` без сертификата; `PUBLIC_SITE_URL`/`ORIGIN` на Fly не заданы — в «Известные проблемы» | — | `fly certs list -a armenian-parkour-union`; открыть https://parkour.am
- 2026-10-06 | процесс | из CoffeeOS: `/crit-audit` (K1–K5 из `sbr.mdc`, падающий тест обязателен, вердикт CLEAN/BLOCKED, журнал `docs/critical-ledger.md`), встроен в шаг 2 `/review`; `/trace-bug` для оплаты, прав, баллов; `.cursor/commands/README.md`; `Next:` в `/trim` | `.cursor/commands/*`, `.cursor/rules/sbr.mdc`, `main.mdc`, `docs/critical-ledger.md` | набрать `/` в чате — видны `crit-audit`, `trace-bug`

## Статус документации на конец этапа 0

| Документ | Отвечает за | Статус |
|---|---|---|
| `.cursor/rules/main.mdc` | как работает агент | написан |
| `00-PROJECT` | что за проект, роли, MVP | написан |
| `01-STACK` | технологии, папки, команды, переменные | написан (открытые решения внутри) |
| `02-DATABASE` | таблицы, поля, enum, связи | написан (поля платежей внесены) |
| `03-BUSINESS-RULES` | логика: членство, степени, баллы, события | написан (значения «УТОЧНИТЬ» внутри) |
| `04-ROLES-PERMISSIONS` | кто что может | написан |
| `05-ADMIN-PANEL` | разделы админки | написан |
| `06-PUBLIC-SITE` | страницы сайта и кабинета | написан |
| `07-PAYMENTS` | платежи | написан (провайдер не выбран) |
| `08-DESIGN` | дизайн-система | написан (ждёт логотип, фото, проверку армянского шрифта) |
| `09-ROADMAP` | порядок сборки | написан |
| `ADMIN-GUIDE` | инструкция для админов | не создан (этап 8) |

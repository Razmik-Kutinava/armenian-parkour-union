# /review — PHASE 3 REVIEW

Канон: `.cursor/rules/sbr.mdc` § PHASE 3. Порядок не менять.

1. Local: `npm run check`, `npm run lint`, `npm run test` (+ «Проверка» из todo). FAIL → `/sbr`.
2. Субагенты **по уровню риска** (таблица в `sbr.mdc` § PHASE 3; «Риск» из todo, сверить с диффом, высший уровень побеждает): `high` — `bugbot` + `security-review` параллельно; `normal` — только `bugbot`; `low` — без субагентов. Субагенты — **только на отфильтрованном диффе** (ниже), `Diff: uncommitted changes`. Их находки + свой проход по диффу → `/crit-audit` (`.cursor/commands/crit-audit.md`): K1–K5, падающий тест, журнал. `BLOCKED` → фикс → шаг 1.
3. Сверка со SPEC (todo) и «Готово, когда» задачи в `09-ROADMAP.md`.
4. `PROGRESS.md`: «Сделано», убрать из «В работе»; todo очистить до шаблона. Сработал триггер `/trim` — выполнить его. Коммит.
5. `git push` без вопроса. Ждать CI одной командой, без `Start-Sleep` и опроса `gh run list`: `gh run list -L 1 -w CI --json databaseId -q '.[0].databaseId'` → `gh run watch <id> --exit-status`. Run ещё не появился — один повтор через `gh run watch` без id (интерактивный выбор не использовать).
6. CI красный → субагент `ci-investigator` → фикс → local → коммит → push. Пока не зелёный.
7. CI зелёный → **стоп**.

## Фильтр диффа для субагентов

Субагенты видят: `src`, `tests`, `scripts`, `drizzle/*.sql` и инфраструктуру — `package.json`, `Dockerfile`, `.dockerignore`, `fly.toml`, `.github`, `.env.example`, `*.config.ts`. Не видят: `docs`, `package-lock.json`, `drizzle/meta`, `src/lib/i18n`. Cursor собирает дифф сам, поэтому лишнее временно прячется в локальный коммит (не пушится).

**До субагентов** (одним вызовом; упало — субагентов не запускать):

```powershell
if (git status --porcelain) { throw 'Незакоммиченные изменения: сначала коммит (GREEN), потом ревью' }
git rev-parse HEAD > .git/review-base-sha
git reset -q '@{u}'
git add -A -- . ':(exclude)src' ':(exclude)tests' ':(exclude)scripts' ':(exclude,glob)drizzle/*.sql' `
  ':(exclude)package.json' ':(exclude)Dockerfile' ':(exclude).dockerignore' ':(exclude)fly.toml' `
  ':(exclude).github' ':(exclude).env.example' ':(exclude,glob)*.config.ts'
git add -A -- src/lib/i18n
git diff --cached --quiet; if ($LASTEXITCODE) { git commit -q --no-verify -m "tmp: review base" }
git add -A
git diff --cached --name-only HEAD          # это и увидят субагенты; пусто — субагенты не нужны
```

**После субагентов** (сразу, до любых фиксов; также если что-то упало посередине):

```powershell
git reset -q (Get-Content .git/review-base-sha); Remove-Item .git/review-base-sha
git status --porcelain                       # должно быть пусто
```

## Отчёт
Сделано · Не сделано · Local PASS/FAIL · `Риск: high | normal | low` · `Субагенты: bugbot (критичных N) | security-review (критичных N) | нет — low` · `crit-audit: CLEAN | BLOCKED: N` · CI green + ссылка · `Коммит: <хеш>`

## Обязательно в конце

`Next: /deploy — только по апруву владельца`

Дыры до push: `Next: /sbr`

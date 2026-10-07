# /review — PHASE 3 REVIEW

Канон: `.cursor/rules/sbr.mdc` § PHASE 3. Порядок не менять.

1. Local: `npm run check`, `npm run lint`, `npm run test` (+ «Проверка» из todo). FAIL → `/sbr`.
2. Субагенты **по уровню риска** (таблица в `sbr.mdc` § PHASE 3; «Риск» из todo, сверить с диффом, высший уровень побеждает): `high` — `bugbot` + `security-review` параллельно; `normal` — только `bugbot`; `low` — без субагентов. Субагенты — **только на отфильтрованном диффе** (ниже), `Diff: uncommitted changes`. Их находки + свой проход по диффу → `/crit-audit` (`.cursor/commands/crit-audit.md`): K1–K5, падающий тест, журнал. `BLOCKED` → фикс → шаг 1.
3. Сверка со SPEC (todo) и «Готово, когда» задачи в `09-ROADMAP.md`.
4. `PROGRESS.md`: «Сделано», убрать из «В работе»; todo очистить до шаблона. Сработал триггер `/trim` — выполнить его. Коммит.
5. `git push` без вопроса. Смотреть все job (`gh run watch`).
6. CI красный → субагент `ci-investigator` → фикс → local → коммит → push. Пока не зелёный.
7. CI зелёный → **стоп**.

## Фильтр диффа для субагентов

Субагенты видят только `src`, `tests`, `scripts`, `drizzle/*.sql`. Не видят: `docs`, `package-lock.json`, `drizzle/meta`, `src/lib/i18n`, прочие файлы корня. Cursor собирает дифф сам, поэтому лишнее временно прячется в локальный коммит (не пушится):

```powershell
$S = git rev-parse HEAD                      # рабочее дерево должно быть чистым
git reset -q '@{u}'
git add -A -- . ':(exclude)src' ':(exclude)tests' ':(exclude)scripts' ':(exclude,glob)drizzle/*.sql'
git add -A -- src/lib/i18n
git diff --cached --quiet; if ($LASTEXITCODE) { git commit -q --no-verify -m "tmp: review base" }
git add -A
# → субагенты по уровню риска с Diff: uncommitted changes
git reset -q $S                              # сразу после ответа субагентов
```

После возврата: `git rev-parse HEAD` = `$S`, `git status` пуст. Иначе — стоп и вернуть `git reset -q $S`. Фиксы по находкам — только после возврата.

## Отчёт
Сделано · Не сделано · Local PASS/FAIL · `Риск: high | normal | low` · `Субагенты: bugbot (критичных N) | security-review (критичных N) | нет — low` · `crit-audit: CLEAN | BLOCKED: N` · CI green + ссылка · `Коммит: <хеш>`

## Обязательно в конце

`Next: /deploy — только по апруву владельца`

Дыры до push: `Next: /sbr`

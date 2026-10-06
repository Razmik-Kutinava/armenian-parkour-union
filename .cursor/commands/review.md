# /review — PHASE 3 REVIEW

Канон: `.cursor/rules/sbr.mdc` § PHASE 3. Порядок не менять.

1. Local: `npm run check`, `npm run lint`, `npm run test` (+ «Проверка» из todo). FAIL → `/sbr`.
2. Два субагента **параллельно и всегда оба**: `bugbot` и `security-review`. Их находки + свой проход по диффу → `/crit-audit` (`.cursor/commands/crit-audit.md`): K1–K5, падающий тест, журнал. `BLOCKED` → фикс → шаг 1.
3. Сверка со SPEC (todo) и «Готово, когда» задачи в `09-ROADMAP.md`.
4. `PROGRESS.md`: «Сделано», убрать из «В работе»; todo очистить до шаблона. Сработал триггер `/trim` — выполнить его. Коммит.
5. `git push` без вопроса. Смотреть все job (`gh run watch`).
6. CI красный → субагент `ci-investigator` → фикс → local → коммит → push. Пока не зелёный.
7. CI зелёный → **стоп**.

## Отчёт
Сделано · Не сделано · Local PASS/FAIL · `Субагенты: bugbot (критичных N) | security-review (критичных N)` · `crit-audit: CLEAN | BLOCKED: N` · CI green + ссылка · `Коммит: <хеш>`

## Обязательно в конце

`Next: /deploy — только по апруву владельца`

Дыры до push: `Next: /sbr`

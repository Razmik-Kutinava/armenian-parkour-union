# /review — PHASE 3 REVIEW

Канон: `.cursor/rules/sbr.mdc` § PHASE 3. Порядок не менять.

1. Local: `npm run check`, `npm run lint`, `npm run test` (+ «Проверка» из todo). FAIL → `/sbr`.
2. Два субагента **параллельно и всегда оба**: `bugbot` и `security-review`. Находки — по списку критичного K1–K5; критичное только с падающим тестом → фикс → шаг 1.
3. Сверка со SPEC (todo) и «Готово, когда» задачи в `09-ROADMAP.md`.
4. `PROGRESS.md`: «Сделано», убрать из «В работе»; todo очистить до шаблона. Коммит.
5. `git push` без вопроса. Смотреть все job (`gh run watch`).
6. CI красный → субагент `ci-investigator` → фикс → local → коммит → push. Пока не зелёный.
7. CI зелёный → **стоп**.

## Отчёт
Сделано · Не сделано · Local PASS/FAIL · `Субагенты: bugbot (критичных N) | security-review (критичных N)` · CI green + ссылка · `Коммит: <хеш>`

## Обязательно в конце

`Next: /deploy — только по апруву владельца`

Дыры до push: `Next: /sbr`

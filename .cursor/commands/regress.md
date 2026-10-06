# /regress — регрессия зоны до REVIEW

Канон: `.cursor/rules/sbr.mdc` § `/regress`.

## Сделай
1. Команды из «Проверка» в `docs/todo.md`.
2. `npm run test` целиком; опасная зона — плюс её e2e (`npm run test:e2e`).
3. FAIL — назад в GREEN, не в REVIEW.

## Отчёт
Команды + PASS/FAIL (сколько тестов, сколько упало).

## Обязательно в конце

PASS: `Next: /review`
FAIL: `Next: /sbr`

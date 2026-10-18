# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

2.9 (исправление после проверки, решение 2026-10-18): необязательные многоязычные тексты — «EN обязателен, если заполнен другой язык», как в настройках и кнопке hero. Поля: текст страницы, краткое описание и текст новости, описание события, подзаголовок hero, alt медиа. Ошибка — у поля EN; пустое во всех языках по-прежнему можно. Существующие записи в базе не трогаем (проверка — при сохранении формы). После — закрыть 2.9.

## Файлы (ожидаемо)

- `src/lib/validation/localized.ts` — правило одной функцией
- `src/lib/validation/{pages,posts,events,hero,media}.ts` — подключить
- `src/lib/validation/en-required.test.ts` — тест на все поля

## Не ломать

- Заголовки (EN уже обязателен), кнопка hero (своё правило)
- alt пустой во всех языках → `null` (декоративное изображение, `08`)
- e2e форм админки (страницы, новости, события, hero, медиа)

## Проверка

- `npx vitest --run src/lib/validation`
- `npx playwright test tests/e2e/pages.spec.ts tests/e2e/news.spec.ts tests/e2e/events.spec.ts tests/e2e/hero.spec.ts tests/e2e/admin-media.spec.ts --workers=1`

## Риск

`normal` — валидация форм админки.

## Читать

- `decisions.md` 2026-10-18 (2.9) — правило и список полей

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

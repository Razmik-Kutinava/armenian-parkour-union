# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

1.9 Оболочка админки: боковая панель, верхняя панель, DataTable, FilterBar, FormLayout, ConfirmDialog (`08` разд. 8.3; `05` разд. 1, 2).

Решения владельца (2026-10-07): язык админки — `users.locale` сотрудника, переключатель EN / HY / RU в меню пользователя сохраняет выбор в профиль; в меню все разделы `05` разд. 2, доступные роли по `04` 5.1 (пока раздела нет — 404); поиска в верхней панели пока нет (поиск — в FilterBar раздела).

- Боковая панель: `navy-900`, 240 px, группы с иконками, только разделы с правом роли; на мобильных — кнопка «Меню».
- Верхняя панель: хлебные крошки, меню пользователя (имя, роль, язык, «На сайт», «Выйти»).
- DataTable: строка 44 px, закреплённая шапка, сортировка ссылками (состояние в URL), выбор строк, пустое состояние, на мобильных — карточки. Пагинация 25.
- FilterBar: GET-форма (поиск + фильтры), активные фильтры чипами со сбросом, состояние в URL.
- FormLayout: секции с заголовками, «Сохранить» / «Отмена» закреплены внизу.
- ConfirmDialog: текст последствий, кнопка `danger`, необязательное обязательное поле комментария, отправка формой (POST action).
- Демонстрация компонентов — на `/dev/design` (только dev).

## Файлы (ожидаемо)

- `src/lib/server/admin/nav.ts` — разделы и группы, фильтр по `can()`
- `src/lib/components/admin/list-state.ts` — сортировка, фильтры, страница из URL; ссылки
- `src/lib/components/admin/breadcrumbs.ts` — крошки по меню и адресу
- `src/lib/server/services/profile.ts` — `setLocale`; `src/routes/admin/locale/+page.server.ts` — action смены языка
- `src/hooks.server.ts`, `src/lib/i18n/index.svelte.ts`, `src/app.d.ts` — язык `/admin` из профиля
- `src/routes/admin/+layout.server.ts`, `+layout.svelte`, `+page.svelte`
- `src/lib/components/admin/` — `AdminSidebar`, `AdminTopbar`, `Breadcrumbs`, `DataTable`, `Pagination`, `FilterBar`, `FormLayout`, `ConfirmDialog`
- `src/routes/dev/design/AdminDemo.svelte`; `en.ts`, `ru.ts`

## Не ломать

- `/admin`: гость → вход, участник → 404, понижение роли — со следующего запроса (e2e `admin-access.spec.ts`).
- Сайт и `<html lang>` по URL (e2e `site-layout.spec.ts`, `auth.spec.ts`).
- Смена языка: только свой профиль, только `en | hy | ru`, возврат только внутрь `/admin`, участник → 404.

## Проверка

- `npm run test`
- `npm run test:e2e`

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.2 — админка: партнёры и плюшки (`05` разд. 28 «Партнёры», без вкладки «Кассиры» — она в 10.6). Миграции нет: таблицы из 0018.

## Файлы (ожидаемо)

- `src/lib/server/auth/permissions.ts` (+ test) — `volunteer.manage`: admin (`04` 5.1)
- `src/lib/validation/volunteer-partners.ts` (+ test) — формы партнёра, плюшки, ↑ / ↓
- `src/lib/server/services/volunteer/partners-admin.ts` (+ test) — список со счётчиками, карточка, создание, правка, ↑ / ↓
- `src/lib/server/services/volunteer/perks-admin.ts` (+ test) — плюшки партнёра: список, карточка, создание, правка
- `src/lib/server/services/media/usage.ts` — логотип партнёра (`volunteer_partner`), ссылка в `admin/media/[id]`
- `src/routes/admin/volunteer/partners/` — список, `new`, `[id]` (layout с вкладками «Партнёр» / «Плюшки»), `[id]/perks`, `[id]/perks/new`, `[id]/perks/[perkId]`; формы `PartnerForm.svelte`, `PerkForm.svelte`, `form.ts`
- `src/lib/server/admin/nav.ts` (+ test), `components/admin/nav-icons.ts` — группа «Волонтёрство» перед «Деньгами» (`05` разд. 2)
- `src/lib/server/cache/admin-groups.ts` — `volunteer: []` (страница проверки, PDF, кабинет не кешируются)
- `src/lib/i18n/messages/{en,hy,ru}-volunteer-admin.ts`
- e2e-карты: `admin-access-map.ts`, `admin-audit-map.ts`, `admin-audit-volunteer.ts` (исполнитель), `admin-permissions-volunteer.ts` (фикстуры); `tests/e2e/admin-volunteer-partners.spec.ts`

## Решения агента (в пределах документов)

1. Порядок партнёров — ↑ / ↓ в списке (`05`), меняет места с соседом и нумерует всех 0…n−1 под блокировкой строк партнёров; новый — в конец. Порядок плюшек — числовое поле формы (`05`: «…статус, порядок»).
2. Статус партнёра и плюшки — поле формы `draft / published / archived`; смена статуса пишется как `*.update` с `before` / `after`. Коды: `volunteer_partner.create|update|reorder`, `volunteer_perk.create|update`.
3. Логотип — картинка медиатеки, строка `media` берётся `FOR SHARE`; не картинка или удалена — ошибка у поля. Архивные партнёры тоже держат файл (могут вернуться).
4. Сайт — только `http(s)` (попадёт в `href` на странице проверки). Адрес и условия — однострочные поля ×3 (до 300 и 500 символов), английский обязателен, если заполнен любой язык.
5. Плюшка: у `reusable` лимит не сохраняется; у `single` — 1…100. Даты — `YYYY-MM-DD`, «по» не раньше «с». Смена вида и лимита после отметок разрешена (`03` 19.3 п. 2).
6. Счётчики списка: плюшек `published`; доступов кассиров — привязан и не отключён; использований за 30 дней — отметки без обратной записи.

## Не ломать

- Медиатека: удаление файла, который где-то используется, по-прежнему запрещено; поиск использований остальных разделов не меняется.
- Права: модератор и редактор не открывают `/admin/volunteer/**` (403), участник — 404 (`04` раздел 8, п. «Волонтёрство»).
- Меню и карты e2e остальных разделов.

## Проверка

- `npx vitest run src/lib/validation/volunteer-partners.test.ts src/lib/server/services/volunteer src/lib/server/auth/permissions.test.ts src/lib/server/admin/nav.test.ts src/routes/admin/access-coverage.test.ts src/routes/admin/audit-coverage.test.ts src/lib/server/cache`
- `npx playwright test tests/e2e/admin-volunteer-partners.spec.ts`; `npm run check`, `npm run lint`

## Риск

`high` — права (`permissions.ts`), новые разделы админки с журналом действий.

## Читать

- `05` § 2 (группа «Волонтёрство» перед «Деньгами»), § 28 «Партнёры»; `02` § 12 `volunteer_partners`, `volunteer_perks`; `03` § 19.3, 19.9 п. 1; `04` 5.1 (`volunteer.manage` — admin)
- `zone-notes.md` § «Волонтёрство», § «Контент и админка» (карты e2e, кеш, медиа `FOR SHARE`)
- образцы: `services/donations/purposes-admin.ts`, `services/training/topics.ts` (↑ / ↓), `services/shop/items.ts` (дифф в журнал), `routes/admin/training/[id]/+layout.svelte` (вкладки)

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

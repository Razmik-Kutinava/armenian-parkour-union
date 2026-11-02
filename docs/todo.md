# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.6 — доступ кассиров и отметка плюшки (`09` п. 10.6; `03` § 19.4; `05` § 28 «Кассиры»; `06` § 4.12–4.13; `04` § 2, § 8): ссылка-приглашение и вкладка в админке, привязка телефона (`/partner/join/{token}`, `/partner`), отключение; на странице проверки книжки — баннер кассира, остаток разовых у **своего** партнёра, кнопка «Отметить» (форма без JS, второе нажатие — подтверждение), списание разовых через `perk_redemptions`. Миграции нет (0018). Отмена обратной записью — 10.7.

## Файлы (ожидаемо)

- `src/lib/server/services/volunteer/cashier-access.ts` (+ test) — cookie `apu_cashier`, invite/bind/find; хеши токенов в БД
- `src/lib/server/services/volunteer/cashiers-admin.ts` (+ test) — create / relink / disable / list; журнал `partner_cashier.*`
- `src/lib/server/services/volunteer/settings.ts` (+ test) — `site_settings.volunteer.cashier_invite_hours` (default 72)
- `src/lib/server/services/volunteer/perk-mark.ts` (+ test) — транзакция отметки: lock книжки, проверки 19.4, insert `perk_redemptions`, `last_used_at`, идемпотентность 1 мин
- `src/routes/admin/volunteer/partners/[id]/cashiers/*` — вкладка «Кассиры», ссылка один раз
- `src/routes/[[lang=lang]]/(site)/partner/*` — join и статус привязки
- `src/routes/[[lang=lang]]/(site)/volunteer/[token]/+page.server.ts`, `+page.svelte`, `MarkPerk.svelte` — кассир, action `?/mark`, без `cardId` в load
- `src/lib/i18n/messages/*-volunteer-cashier.ts`, правки `*-volunteer-admin.ts`, `en|ru|hy.ts` (namespace)
- `src/lib/seo/robots.ts` (+ test) — `Disallow: /partner` на каждом языке
- `tests/e2e/volunteer-cashier.spec.ts` — админ + bind; сценарий отметки на `/hy/volunteer/{token}`

## Решения агента (в пределах документов)

1. Привязка — POST-кнопка на join (превью мессенджера не сжигает ссылку); одна страница ошибки для used / expired / disabled / unknown.
2. «Новая ссылка» обнуляет `device_token_hash` — старый телефон перестаёт работать (`03` 19.4 п. 2).
3. На проверке книжки: гость — как 10.5 (исчерпанные разовые скрыты). Кассир — баннер «Вы — {партнёр}, {подпись}»; у своего партнёра плюшки из `visiblePartners` **без** отсева `remaining === 0`, показывается остаток у `single`; чужие партнёры без кнопок.
4. Action `mark`: снова `findPublicCard` + `findCashier` по cookie; `perkId` и `partnerId` из формы — только если `partnerId === cashier.partnerId` и плюшка видима; иначе отказ. Книжку — `FOR UPDATE`.
5. Идемпотентность 1 мин (`03` 19.4 п. 4): повтор card+perk+cashier без `reversal_of_id` за последние 60 с → успех с той же `createdAt`, новой строки нет.
6. Подтверждение — два submit подряд (`06` 4.12): hidden `confirm=1` после первого «Отметить».
7. Коды отказа — ключи i18n (`invalid_card`, `no_access`, `wrong_partner`, `perk_unavailable`, `no_uses_left`); в audit отметку не дублировать (`03` 19.9 п. 1).

## Не ломать

- Страница проверки для гостя (K4): без cookie кассира — как 10.5; `id` книжки и участника не отдавать.
- Права (K1): без действующего cookie кассира своего партнёра action отклоняется; admin/editor с cookie не отмечает чужой партнёр; подмена `perkId` / `partnerId` / токена книжки.
- `perk_redemptions` append-only; отметка только insert с `cashier_id`.
- 10.5: `no-store`, `noindex`, `/certificate`, PDF и `cardCheckUrl` не менять.

## Проверка

- `npx vitest run src/lib/server/services/volunteer/cashier-access.test.ts src/lib/server/services/volunteer/cashiers-admin.test.ts src/lib/server/services/volunteer/settings.test.ts src/lib/server/services/volunteer/perk-mark.test.ts`
- `npm run check`, `npm run lint`
- `npx playwright test tests/e2e/volunteer-cashier.spec.ts`

## Риск

`high` — cookie кассира, `perk_redemptions`, обход партнёра (K1); публичная страница с кнопками действия.

## Читать

- `03` § 19.3–19.4, 19.9 п. 1; `06` § 4.12–4.13; `05` § 28 (партнёры → кассиры); `04` § 2, § 8 (волонтёрство — кассир)
- `zone-notes.md` § «Волонтёрство» (схема, `visiblePartners`, страница 10.5 → 10.6)
- образцы: `perks-visible.ts`, `card-public.ts`, `volunteer-cards-schema.test.ts` (redemptions); e2e `admin-audit-volunteer.ts`, `admin-permissions-volunteer.ts`

## Фазы

- [x] SPEC
- [x] RED `c836181`
- [x] GREEN
- [ ] REVIEW (этапа)

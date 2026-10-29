# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.6 — доступ кассиров и отметка плюшки (`03` § 19.4, `04` § 2, § 5.2 п. 7, § 7, § 8; `05` § 28 «Кассиры»; `06` § 4.12, 4.13; `02` `partner_cashiers`, `perk_redemptions`). Миграции нет (таблицы — 0018). Файлов ~15 — две части, каждая своим RED → GREEN:
- **10.6a** — вкладка «Кассиры» в админке (создать доступ, новая ссылка, отключить), привязка телефона `/partner/join/{token}`, `/partner`.
- **10.6b** — на странице проверки `/volunteer/{token}`: блок кассира, «Отметить» с подтверждением, списание разовых, двойной клик.

## Файлы 10.6a (ожидаемо)

- `src/lib/server/services/volunteer/cashiers-admin.ts` (+ test) — `listCashiers`, `createCashier`, `newCashierLink`, `disableCashier`: actor admin, журнал, ссылка возвращается один раз
- `src/lib/server/services/volunteer/cashier-access.ts` (+ test) — токены (`randomBytes(32)` base64url, SHA-256 hex), `bindCashier(db, inviteToken, now)` → device token | `null`, `findCashier(db, deviceToken)` → `{ id, partnerId, partnerName, label }` | `null`; имя cookie и срок
- `src/lib/server/services/volunteer/settings.ts` (+ test) — `site_settings.volunteer.cashier_invite_hours`, нет или битый — 72 (по образцу `certificates/settings.ts`)
- `src/routes/admin/volunteer/partners/[id]/cashiers/+page.server.ts`, `+page.svelte`; вкладка в `[id]/+layout.svelte`
- `src/routes/[[lang=lang]]/(site)/partner/+page.server.ts`, `+page.svelte`; `partner/join/[token]/+page.server.ts`, `+page.svelte`
- `src/lib/i18n/messages/{en,hy,ru}-volunteer-cashier.ts` (новые, подключить в `en.ts` / `hy.ts` / `ru.ts`; `*-volunteer-cards.ts` уже 110 строк) + ключи вкладки в `*-volunteer-admin.ts` (70 строк)
- `src/lib/seo/robots.ts` (+ test) — `/partner` на всех языках; `tests/e2e/admin-audit-map.ts`, `admin-audit-volunteer.ts`, `admin-permissions-volunteer.ts` — новые действия; `tests/e2e/volunteer-cashier.spec.ts` (новый)

## Файлы 10.6b (ожидаемо)

- `src/lib/server/services/volunteer/perk-redeem.ts` (+ test) — `redeemPerk(db, { deviceToken, cardToken, perkId }, now)`; `cashierPerks(db, cardToken, partnerId, now)` — плюшки своего партнёра с остатком (через `visiblePartners`, исчерпанные не отсеиваются)
- `src/routes/[[lang=lang]]/(site)/volunteer/[token]/+page.server.ts` — cookie → `findCashier`, блок кассира в `load`, `?mark={perkId}` → подтверждение, action `redeem`
- `src/routes/[[lang=lang]]/(site)/volunteer/[token]/CashierPerks.svelte` (новый; `+page.svelte` уже 100 строк — только подключить)
- `src/lib/i18n/messages/{en,hy,ru}-volunteer-cashier.ts` — тексты блока, подтверждения, отказов
- `tests/e2e/volunteer-cashier.spec.ts` — сценарии отметки

## Решения агента (в пределах документов)

1. **Привязка — по кнопке, не при открытии.** `GET /partner/join/{token}` только проверяет ссылку: действует — «Привязать этот телефон к {партнёр}» (POST); иначе общая «Ссылка недействительна…». Превью ссылок в мессенджерах (Telegram, WhatsApp, Viber) открывают GET и сожгли бы одноразовую ссылку до кассира. Отступ от буквы `06` § 4.13 — в `questions.md` (этап 10) «ждёт подтверждения».
2. Привязка — один `UPDATE … WHERE invite_token_hash = $1 AND disabled_at IS NULL AND invite_expires_at > now RETURNING`: ссылка срабатывает ровно раз и при двух одновременных открытиях. `invite_token_hash` → `null`, `device_token_hash`, `bound_at`. В `audit_log` не пишется (`03` § 19.9 не перечисляет; admin видит `bound_at`).
3. Cookie `apu_cashier`: httpOnly, Secure, `sameSite: lax` (QR открывается переходом извне), `path: /`, 400 дней (потолок браузеров, ≥ года по `03` 19.4 п. 1). В базе только SHA-256; токены и хеши — не в журнал и не в логи.
4. Ссылка — `{PUBLIC_SITE_URL}/hy/partner/join/{token}` (как QR — армянская версия), показывается один раз после «Создать доступ» / «Новая ссылка» с «Копировать»; срок — `cashier_invite_hours` (ключа `volunteer` в seed нет — 72 из кода; seed — с 10.9 вместе с порогом отказов).
5. «Новая ссылка» — привязанному или ждущему доступу (сбрасывает телефон, `02` правило); отключённому — нет: отключение окончательно, новый кассир — «Создать доступ». Подпись 1–80 символов.
6. Журнал: `partner_cashier.create | relink | disable`, `entity_type = 'partner_cashier'`, в `after` — `partner_id`, `label`, `invite_expires_at`. Права — `volunteer.manage` в `load` и каждом action + проверка актора в сервисе; чужой `id` доступа (другого партнёра) — 404.
7. `/partner`, `/partner/join/*` — `no-store`, `x-robots-tag` + `<meta robots>` `noindex`, `robots.txt` `Disallow: /partner`. Кассир — не пользователь: ни в кабинет, ни в админку cookie не пускает.
8. (10.6b) Кассир определяется по cookie и в `load`, и в action заново (`04` § 5.2 п. 7); отключённый, перепривязанный, неизвестный — как гость, без кнопок. Блок кассира — только у действительной книжки; над списком «Вы — {партнёр}, {подпись}».
9. (10.6b) Свои плюшки — все видимые (`03` 19.3), разовая с остатком 0 — «Использовано», без кнопки. Чужие партнёры — как у всех, без кнопок.
10. (10.6b) Подтверждение без JS: «Отметить» — ссылка `?mark={perkId}` → блок «Отметить «…»?» с POST «Да, отметить» (`?/redeem`) и «Отмена». После отметки — «Отмечено в {ЧЧ:ММ}» (Ереван).
11. (10.6b) `redeemPerk` — транзакция: книжка по `public_token` `FOR UPDATE` → действительна (`card-sql` + `cardValidity`, владелец не удалён) → доступ по хешу (не отключён, привязан) → плюшка видна и её `partner_id` = партнёр доступа → у `single` остаток > 0 (под блокировкой) → та же книжка + плюшка + доступ за последние 60 с — вернуть ту отметку, новой не создавать → insert (`partner_id` из плюшки) + `last_used_at`. Ответ `{ at, repeat }` | `not_cashier | card_invalid | perk_unavailable | used_up`; неизвестный токен книжки — 404. Только `id` плюшки из формы; книжка — из адреса.
12. (10.6b) Отметка не в `audit_log` (`03` § 19.9: она сама запись). Лимита запросов нет — нужен привязанный телефон.

## Не ломать

- Права (K1): без cookie, с отключённым, перепривязанным или чужим доступом кнопки нет и прямой POST отклоняется; подмена токена книжки и `id` плюшки; admin без cookie не отмечает; модератор и редактор не открывают «Кассиры».
- Баллы-подобный счётчик (K3): разовая не уходит ниже 0 при двух одновременных отметках; двойной клик — одна запись; `perk_redemptions` только insert.
- Ссылка-приглашение: срабатывает один раз, не после срока, не у отключённого; новая ссылка гасит старый телефон.
- Страница проверки 10.5: гость и недействительная книжка — как сейчас (никаких новых данных), `no-store`, `noindex`.

## Проверка

- 10.6a: `npx vitest run src/lib/server/services/volunteer/cashiers-admin.test.ts src/lib/server/services/volunteer/cashier-access.test.ts src/lib/server/services/volunteer/settings.test.ts src/lib/seo/robots.test.ts`; `npx playwright test tests/e2e/volunteer-cashier.spec.ts tests/e2e/admin-volunteer-partners.spec.ts`
- 10.6b: `npx vitest run src/lib/server/services/volunteer/perk-redeem.test.ts` (в т. ч. две одновременные отметки разовой с лимитом 1 → одна запись); `npx playwright test tests/e2e/volunteer-cashier.spec.ts tests/e2e/volunteer-check.spec.ts`
- обе: `npm run check`, `npm run lint`

## Риск

`high` — новый субъект прав (кассир по cookie), одноразовые ссылки, списание разовых, журнал действий (K1, K3).

## Читать

- `03` § 19.4, § 19.9 — выписано выше; `02` `partner_cashiers`, `perk_redemptions` (строки 721–778) — выписано; `04` § 2 (строка 38), § 5.2 п. 7, § 8 (строка 253); `05` § 28 «Партнёры» (строки 442–446); `06` § 4.12 (кассир), § 4.13 — выписано
- `zone-notes.md` § «Волонтёрство» (10.2 вкладки и фикстуры, 10.5 «Для 10.6»)
- образцы: `volunteer/partners-admin.ts` (+ test, журнал), `perks-admin.ts`, `card-public.ts`, `perks-visible.ts`, `card-sql.ts`, `card-rules.ts`, `test-support.ts`; `certificates/settings.ts`; `certificates/number.ts` (`newPublicToken`); `routes/admin/volunteer/partners/[id]/perks/*`; `volunteer/[token]/*`; `tests/e2e/admin-audit-map.ts`, `admin-permissions-volunteer.ts`, `volunteer-check.spec.ts`

## Фазы

- [x] SPEC
- [ ] 10.6a RED
- [ ] 10.6a GREEN
- [ ] 10.6b RED
- [ ] 10.6b GREEN
- [ ] REVIEW (этапа)

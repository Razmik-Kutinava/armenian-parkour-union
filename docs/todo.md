# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки для общего REVIEW: 3.6b — `git show c3b6468:docs/todo.md`, 3.7 — `git show 2c0aee1:docs/todo.md`, 3.8 — `git show 8e2b410:docs/todo.md`, 3.9 — `git show b9582c3:docs/todo.md`, 3.10 — `git show 110eb1e:docs/todo.md`, 3.11 — этот файл до следующей задачи (раздел «Для общего REVIEW»).

## Задача

3.11 — параметры оплаты в настройках админки: размер взноса, лимиты донатов, время ожидания оплаты (`05` § 21 «Членство»; `decisions.md` 2026-10-19, 3.6 и 3.7 — «правка — 3.11»). Миграции нет. REVIEW — в общем прогоне (без push).

Правила:
1. **Раздел** `/admin/settings/payments` — вторая вкладка «Настроек сайта» (вкладки «Сайт» / «Членство и оплата» на обеих страницах); меню админки не меняется (`05` § 2). Право — `settings.write` (только admin, `04` стр. 105) в `load` и action; сервис сам проверяет `role = admin`.
2. **Поля:** взнос — сумма (в основных единицах валюты, `priceToMinor`), валюта (`CURRENCIES`), срок в месяцах (1–120); лимиты доната — валюта, минимум, максимум (≥ 1, минимум ≤ максимума); ожидание оплаты взноса и доната — минуты (5–1440). Сумма взноса **0** разрешена — оплата взноса выключена (как seed, `parseMembershipFee` → `null`, кнопки нет).
3. **Хранение:** ключи `site_settings` в прежнем формате — `membership_fee` `{ amount_minor, currency, period_months }`, `donation_limits` `{ currency, min_minor, max_minor }`, `payment_wait_minutes` (число); читают их без изменений `parseMembershipFee` / `parsePeriodMonths`, `parseDonationLimits`, `parseWaitMinutes`.
4. **Журнал** (`05` § 21): каждый изменённый ключ — `settings.update` с прежним и новым значением, в одной транзакции с записью (`FOR UPDATE`); без изменений — записи нет. Общий цикл записи вынести из `saveSettings` (`writeSettings`), поведение `saveSettings` не меняется.
5. **Сломанное значение в базе** — поле формы пустое (как в 2.7), сохранение перезаписывает ключ целиком.
6. **Действует сразу:** кеш `/join`, `/cabinet/membership`, `/donate` (группа `settings`) сбрасывается — раздел `settings` уже в `cache/admin-groups.ts`. Уже созданные платежи не меняются (сумма и срок ожидания зафиксированы при создании); срок членства берётся на момент подтверждения оплаты (3.6a) — подсказка у поля.
7. **Не в 3.11 (решения агента, в отчёт):** время удержания места события — этап 5 (вопрос в `questions.md`, ключа нет); «Параметры правил» (`03` § 16) — этап 4; выбор валюты в форме `/donate` — нет (валюта из лимитов, решение 3.7).
8. Тексты — `i18n/messages/{en,ru}-system.ts`; HY — откат на EN.

## Файлы (ожидаемо)

- `src/lib/validation/payment-settings.ts` (+ тест) — форма → значения ключей, значения → поля формы
- `src/lib/server/services/payment-settings.ts` (+ тест с БД) — `getPaymentSettings`, `savePaymentSettings`
- `src/lib/server/services/site-settings.ts` — `writeSettings` (общий цикл с журналом)
- `src/routes/admin/settings/payments/{+page.server.ts,+page.svelte}`, `src/routes/admin/settings/SettingsTabs.svelte`, `+page.svelte`
- `tests/e2e/admin-payment-settings.spec.ts`; карты `admin-audit-map.ts`, `admin-access-map.ts`, исполнитель в `admin-audit-money.ts`
- `src/lib/i18n/messages/{en,ru}-system.ts`

## Не ломать

- Сумма взноса и лимиты доната берутся только из `site_settings` на сервере (C11): после сохранения `/join` и `/donate` показывают и принимают новые значения; 0 — оплаты взноса нет.
- Не-админ (editor, moderator, member) не открывает раздел и не сохраняет прямым POST (403) (K1).
- Форма «Сайт» (`/admin/settings`) сохраняет и журналирует как раньше; сломанное значение ключа не роняет страницу.

## Проверка

- `npx vitest --run src/lib/validation src/lib/server/services/site-settings src/lib/server/services/payment-settings src/lib/server/services/memberships src/lib/server/services/donations src/lib/server/seed`
- `npx playwright test tests/e2e/admin-payment-settings.spec.ts tests/e2e/admin-system.spec.ts tests/e2e/admin-audit.spec.ts tests/e2e/admin-permissions.spec.ts tests/e2e/membership.spec.ts tests/e2e/donate.spec.ts`; `npm run check`, `npm run lint`, `npm run test`

## Риск

`high` (взносы и лимиты денег: сумма, которую сервер берёт в оплату; права админа; журнал действий).

## Читать

- `05` § 2, 21; `07` § 5.1, 5.2, 13, 14; `04` стр. 105 (`settings.write`); `decisions.md` 2026-10-19 (3.6, 3.7) — прочитаны в SPEC.

## Для общего REVIEW — что проверить в 3.11

Дифф: `git diff b08390e..3957e02 -- src tests` (RED `95cda1e`, GREEN `3957e02`). Риск `high` → bugbot + security-review параллельно, затем `/crit-audit`.

1. **Деньги (K2, C11)** — `validation/payment-settings.ts`: сумма взноса и лимиты переводятся в минимальные единицы **по выбранной валюте** (`priceToMinor`: AMD — целые, USD / EUR — до 2 знаков); диапазоны совпадают с читателями (`parseMembershipFee` 0 → «нет оплаты», `parsePeriodMonths` 1–120, `parseDonationLimits` min ≥ 1, min ≤ max, `parseWaitMinutes` 1–1440; форма — 5–1440). Проверить: нельзя сохранить значение, которое читатель сочтёт сломанным (тогда взнос / донаты пропадут молча); `storedPaymentSettings` — то же, что принимают читатели. Уже созданные платежи не меняются (сумма и `expires_at` записаны при создании); срок членства берётся при подтверждении (`activate.ts`) — смена срока действует и на ждущие оплаты.
2. **Права (K1)** — `routes/admin/settings/payments/+page.server.ts`: `requirePermission('settings.write')` в `load` и action; `savePaymentSettings` сам отказывает не-админу; e2e — editor / moderator 403 на GET и прямой POST; карты `admin-access-map` / `admin-audit-map` дополнены.
3. **Журнал и транзакция** — `writeSettings` (вынесен из `saveSettings`, `site-settings.ts`): блокирует `FOR UPDATE` только переданные ключи, пишет `settings.update` с before / after на каждый изменённый, без изменений — без записи; `saveSettings` по-прежнему пишет только ключи формы сайта (ключи форм не пересекаются — unit). Проверить, что поведение `saveSettings` не изменилось.
4. **Кеш** — POST `/admin/settings/*` сбрасывает группу `settings` (`cache/admin-groups.ts`, раздел `settings`): `/join`, `/cabinet/membership`, `/donate` видят новое сразу (e2e в `membership.spec` и `donate.spec`).
5. **Форма** — одна `transform` проверяет все поля, чтобы все ошибки показывались разом; поле-файл вместо строки даст сообщение zod без перевода (только админ).
6. **Не K, решения агента** — раздел — вкладка «Членство и оплата» внутри «Настроек сайта» (меню без изменений); валюта взноса и доната — из `CURRENCIES` (AMD / USD / EUR; провайдер может не принять USD / EUR — 3.13); ожидание оплаты от 5 минут (читатель допускает 1); удержание места события — этап 5 (вопрос открыт); e2e: проверки `/join` и `/donate` — в их spec (они владеют ключами при параллельном прогоне), исполнитель журнала меняет только ожидание (777 / 778); `donate.spec` — проверка суммы в публичном списке сужена до своей строки (`cabinet.spec` оставляет платные донаты 7 000 в dev-базе).

## Фазы

- [x] SPEC — `b08390e`
- [x] RED (`test: … [RED]`) — `95cda1e`
- [x] GREEN (`feat: … [GREEN]`) — `3957e02`
- [x] REGRESS — Vitest 811/812 (`hero/public` — часы машины, известное); unit зоны 257/257; e2e зоны: параллельно 24 прошли, 3 упали на известной медленной первой регистрации в воркере (`admin-audit`, `admin-system` editor, `admin-payment-settings` editor), эти файлы последовательно 13/13; `check`, `lint` чистые
- [ ] REVIEW — общим прогоном в конце этапа 3, без push до него
- [ ] DEPLOY (только по апруву)

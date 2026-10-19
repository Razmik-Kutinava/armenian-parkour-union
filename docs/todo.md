# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

3.2 — контракт провайдера оплаты (`07` § 4), реестр, провайдеры `mock` (только `development`) и `manual`. Без сервиса платежей (3.3), вебхук-маршрута (3.4) и страниц. Миграции нет.

Решения агента (поправить, если не так):
- Код — `src/lib/server/services/payments/providers/` (`07`: сервис платежей и модули провайдеров отдельно; новых разделов в `server/` нет).
- Онлайн-провайдер выбирается переменной `PAYMENT_PROVIDER` (пусто — онлайн-оплаты нет), выключатель без деплоя — `site_settings.feature_flags.payments_online` (`false` — выкл., нет ключа — вкл.). `manual` не зависит ни от того, ни от другого (`07` § 1.8).
- `PAYMENT_PROVIDER=mock` вне `development` или неизвестное имя — ошибка конфигурации (не тихий `null`); `mock` вне `development` не находится и по id (вебхуки и сверка старых платежей).
- `mock`: состояние в памяти процесса, ID `mock_<uuid>`, подпись вебхука HMAC-SHA256 от тела с секретом, случайным на процесс; `simulate()` меняет статус и выдаёт подписанный вебхук (для тестов 3.3–3.4). Адрес оплаты — `/dev/mock-pay/<id>`; сама страница — в 3.4 (нужен маршрут вебхуков).
- `manual`: без операций (`online: false`), валюты `AMD | USD | EUR`; платёж создаёт админ сразу `paid` (3.9).

## Файлы (ожидаемо)

- `src/lib/server/services/payments/providers/types.ts` — контракт: операции, входы и выходы, ошибки
- `src/lib/server/services/payments/providers/mock.ts` + `mock.test.ts` — `mock`
- `src/lib/server/services/payments/providers/manual.ts` — `manual`
- `src/lib/server/services/payments/providers/registry.ts` + `registry.test.ts` — реестр, выбор онлайн-провайдера, флаг
- `src/lib/server/services/payments/providers/index.ts` — привязка к `$app/env` и `site_settings`
- `src/env.ts`, `.env.example` — `PAYMENT_PROVIDER`

## Не ломать

- Вне `development` провайдер `mock` недоступен ни как онлайн, ни по id — поддельный вебхук `mock` на проде невозможен (K2).
- Вебхук `mock` с неверной или отсутствующей подписью, изменённым телом или кривым JSON — «не распознано», статус не меняется.
- Сборка и запуск без `PAYMENT_PROVIDER` (прод сейчас) — онлайн-оплаты просто нет, сайт работает.
- Остальной Vitest зелёный (528).

## Проверка

- `npx vitest --run src/lib/server/services/payments`
- `npm run check` · `npm run lint` · `npm run test`

## Риск

`high` — платежи (bugbot + security-review).

## Читать

- `07` § 1, § 4, § 6 (п. 2), § 10, § 14 — уже прочитаны, факты выше.

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

1.12 — seed: первый админ из `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, ключи `site_settings`. Страницы-заглушки — в 2.3 вместе с таблицей `pages` (решение владельца 2026-10-07, `questions.md`).

Поведение (повторный запуск безопасен, ничего не перезаписывает):
- **Админ.** Переменные не заданы → пропуск с сообщением. Уже есть активный `admin` → пропуск. Нет — пользователь с этим email (в нижнем регистре): нет такого → создаётся (`role=admin`, `email_verified=true`, пароль — хеш Better Auth в `account`, `provider_id=credential`); есть активный → роль `admin` (пароль не меняется); заблокирован или удалён → ошибка. Пароль проверяется по `PASSWORD_MIN/MAX`. Запись в `audit_log` с `actor_id = null` (система): `user.create` или `user.role_change`, в одной транзакции.
- **site_settings.** Только отсутствующие ключи (`on conflict do nothing`): `site_name {en: "Armenian Parkour Union"}`, `contacts {}`, `socials {}`, `footer {}`, `requisites {}`, `feature_flags {}`, `membership_fee {amount_minor: 0, currency: "AMD", period_months: 12}` (0 = не задан, сумму задаёт владелец до этапа 3). `seo_description` не сидим — текста нет, форма потребует при первом сохранении. Значения проходят схемы `validation/site-settings*.ts`.
- **Запуск.** `npm run db:seed` локально, на прод — с `DATABASE_URL` прода с машины владельца. В Docker-образ не входит.

## Файлы (ожидаемо)

- `src/lib/server/seed/admin.ts` (+ `.test.ts`) — первый админ
- `src/lib/server/seed/settings.ts` (+ `.test.ts`) — ключи `site_settings`
- `scripts/seed.ts` — тонкий запуск: `.env`, подключение, вызовы, итог в консоль
- `package.json` — `db:seed`

## Не ломать

- Последний админ и смена роли — правила `role-rules` (1.7) не обходятся: seed не понижает и не трогает существующих админов
- Изменённые владельцем настройки не перезаписываются (подвал, форма `/admin/settings`)
- Вход созданного админа через обычную форму входа (хеш совместим с Better Auth)

## Проверка

- `npm run test -- src/lib/server/seed`
- `npm run db:seed` дважды на `parkour_dev` → второй раз «ничего не изменено»

## Риск

`high` — создание админа (роли), `audit_log`, `package.json`.

## Читать

- `02` § 10 `site_settings` (ключи), § «Начальные данные (seed)»
- `04` § 6 п. 1–3: первый админ только через seed; всегда ≥ 1 активный admin
- `03` вводная: «УТОЧНИТЬ — временное значение в seed»

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

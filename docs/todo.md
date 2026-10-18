# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

0.10 Почта через Resend (решение владельца 2026-10-18: сейчас, чтобы закрыть этап 1 — «подтвердить email» у обычного пользователя). HTTP API Resend через `fetch`, без новых библиотек.

- Есть `MAIL_API_KEY` и `MAIL_FROM` → письмо уходит в Resend (`POST https://api.resend.com/emails`, текст, таймаут 10 с).
- Нет ключей: в разработке (`dev`) — письмо целиком в лог, как раньше; в собранном приложении — в лог только адрес и тема, без текста (ссылки с токенами больше не попадают в лог Fly — `critical-ledger` C4).
- Ошибка Resend (не 2xx, сеть, таймаут) — в лог (без ключа и текста письма), регистрация и сброс пароля не падают.

## Файлы (ожидаемо)

- `src/lib/server/mail/resend.ts` (+ test) — отправитель без окружения (ключ, отправитель, `fetch`, лог — параметрами)
- `src/lib/server/mail/index.ts` — `sendMail` берёт окружение
- `src/env.ts` — `MAIL_API_KEY`, `MAIL_FROM`

## Не ломать

- Регистрация, сброс пароля, письмо «задайте пароль» из админки (`auth.spec`, `admin-users.spec`)
- e2e берут токены из таблицы `verification`, не из лога

## Проверка

- `npx vitest --run src/lib/server/mail`
- `npx playwright test tests/e2e/auth.spec.ts --workers=1`

## Риск

`high` — секреты окружения, письма с токенами.

## Читать

- `06` § 6 — письма ведут на `PUBLIC_SITE_URL` (`/verify-email`, `/reset-password`)

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

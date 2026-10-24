# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`.

## Задача

6.3 Сервис сертификатов: выдача одной транзакцией (сертификат, степень, баллы, журнал; письмо после коммита), номер `APU-{год}-{номер}`, отзыв, срок действия. «ебашь» владельца — 2026-10-24, без REVIEW на задаче. Без миграции (схема 6.1).

Решения (`03` разд. 3, 4, 6.1, 14, 15; `04` 5.1, 8; `05` разд. 8):
- Выдаёт — `certificates.issue`, отзывает — `certificates.revoke` (только admin). Модератор — `not_allowed`.
- Выдача (`issueCertificate`): участник (не удалён, не заблокирован), тип `level` / `trainer` / `judge`; для `level` — `advanced` / `pro`, категории нет; для тренера / судьи — категория ≤ 100 (необязательно). Экзамен — необязателен: есть — только `passed`, того же участника, того же типа (`level_advanced` ↔ `level`/`advanced`, `level_pro` ↔ `level`/`pro`, `trainer`, `judge`), без неотозванного сертификата; нет — комментарий обязателен (`03` 4.8). Комментарий ≤ 2000 — в журнал (в `certificates` поля нет).
- **Пропуск уровня** (`03` 3.1) — запрет при любой выдаче (с экзаменом и без): `advanced` — только участнику с `novice`, `pro` — только с `advanced`. Нет степени → `level_skip`; степень выше выдаваемой → `level_below` (сертификат не понижает). **Та же степень** (сертификат отозван, степень вручную не понизили) — можно, степень не меняется (предложено, `questions.md`).
- Порядок блокировок: строка участника `FOR UPDATE` → строка экзамена `FOR UPDATE` → номер (`pg_advisory_xact_lock`). Неотозванный сертификат на экзамен / уровень — `already_issued` (проверка + `23505` при гонке).
- Номер: `APU-{год даты выдачи по Еревану}-{NNNN}` — максимум за год + 1 под advisory-блокировкой; номера отозванных не переиспользуются (строки не удаляются); после 9999 — 5 цифр. `public_token` — 32 символа base64url (24 случайных байта).
- Дата выдачи — по умолчанию сейчас, не в будущем. Срок: уровень — бессрочно (передан срок → `invalid`); тренер / судья — передан или `issued_at + staff_valid_months` (`site_settings.certificates`, seed `{ staff_valid_months: 24 }`, `03` 4.6 / 16); срок ≤ сейчас → `expiry_invalid`.
- Степень: `users.level` = уровень сертификата, журнал `user.level` (как в `memberships/activate.ts`).
- Баллы: `awardPoints` по правилу (`certificate_level_advanced` / `_pro` / `certificate_trainer` / `_judge`), источник — id сертификата. **Перевыдача не удваивает:** если у участника уже есть неотменённое (`reversal`) начисление за сертификат того же типа и уровня — баллы не начисляются (`points: 'already_awarded'` в журнале; предложено, `questions.md`). Админ решает сам через `/admin/points` (`03` 4.7).
- Журнал: `certificate.issue` (entity `certificate`: участник, тип, уровень, категория, номер, экзамен, даты, комментарий, степень до / после, итог баллов), `user.level`.
- Письмо (`03` 14) — после коммита, только если в зависимостях есть `send`; ошибка отправки — `console.warn`, выдача не откатывается. Язык участника; номер, название, дата, ссылки `/certificate/{token}` (6.5) и `/cabinet/progress` (6.8). PDF — 6.4 (встанет между коммитом и письмом).
- Отзыв (`revokeCertificate`): причина 1–2000 обязательна; `active` / `expired` → `revoked`, `revoked_at`; повтор — `already_revoked`. Степень и баллы **не трогает** (`03` 4.7); профиль тренера — 6.6. Журнал `certificate.revoke`. Письма нет (`03` 14 не требует).
- Срок действия: `certificateState(cert, now)` — `revoked` / `expired` (статус или `expires_at ≤ now`) / `active` — для 6.5 / 6.8 до ежедневной задачи 6.9 (она пишет `expired` и шлёт письма).
- Профиль тренера / судьи при выдаче — 6.6 (не здесь).

## Файлы (ожидаемо)

- `src/lib/server/services/certificates/` — `issue.ts` (+ `issue.test.ts`, `issue-level.test.ts`), `issue-input.ts` (чистая проверка ввода, + `.test.ts`), `issue-facts.ts` (блокировки и чтения), `number.ts` (+ `.test.ts`), `revoke.ts` (+ `.test.ts`), `validity.ts` (+ `.test.ts`), `settings.ts` (+ `.test.ts`), `mail.ts`, `index.ts`, `points.test.ts` (проект `server-points`)
- `src/lib/i18n/messages/{en,hy,ru}-certificates.ts` + подключение в `{en,hy,ru}.ts`
- `src/lib/server/seed/settings.ts` (+ `.test.ts`) — ключ `certificates`
- `vite.config.ts` — `certificates/points.test.ts` в `RULES_TESTS`

## Не ломать

- Степень меняется только выдачей сертификата; пропуск уровня невозможен ни с экзаменом, ни без.
- Двойная выдача (двойной клик, гонка) — один сертификат, одни баллы.
- Модератор и участник не выдают и не отзывают; отзыв не трогает степень и баллы.
- Seed настроек: существующие ключи и значения владельца не перезаписываются.

## Проверка

- `npx vitest --run src/lib/server/services/certificates src/lib/server/seed/settings.test.ts`
- `npm run check`, `npm run lint`

## Риск

high (степени, баллы, права).

## Читать

- `03` разд. 3, 4, 6.1, 14, 15, 16. `04` 5.1 (`certificates.*`), 8. `05` разд. 8. `02` `certificates` — по схеме `schema/certification.ts`.

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW — общим шагом в конце этапа

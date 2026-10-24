# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`; 6.7c админка тренеров и судей (решения и «для REVIEW») — `git show ba7fd1a:docs/todo.md`; 6.8 кабинет `/cabinet/progress` (решения и «для REVIEW») — `git show 9b82a38:docs/todo.md`; 6.9 ежедневная задача сертификатов (решения, миграция 0013, «для REVIEW») — `git show f3ffcb4:docs/todo.md`.

## Задача

6.10 — тесты этапа 6: степень меняется только выдачей сертификата, нельзя пропустить уровень, отзыв, дубли баллов, публичная проверка не раскрывает лишнего. «ебашь» владельца — 2026-10-24. Только тесты (как 5.10): падающий тест — баг, чинится в GREEN. Без миграции. REVIEW — общим в конце этапа 6.

Факты: `03` § 3.1 (пропускать уровень нельзя), 3.2 (степень повышается только сертификатом уровня; баллы, оплата, желание — нет), 3.5 (`users.level` меняют только: выдача сертификата, `novice` при первой оплате взноса, ручное понижение админом — его пока нет, 6.3), 4.3 (выдача — одна транзакция), 4.7 (отзыв: баллы и степень сами не меняются), 6.2 п. 2 (один источник — одно начисление), § 15 (запрещено повышать степень в обход сертификата, раскрывать контакты и дату рождения).

Уже покрыто последовательно (6.2–6.9, не дублировать):
- Пропуск уровня при выдаче — с экзаменом и без, «не понижает», шаг за шагом (`issue-level.test`); экзамен назначается через уровень только с подтверждением (`exams/schedule.test`).
- Результат экзамена степень не меняет (`exams/result.test`); взнос даёт `novice` только пустой степени, продление и возврат степень не трогают (`memberships/effects.test`).
- Двойная выдача подряд — `already_issued` (`issue.test`); баллы при перевыдаче — только после отмены прежних (`certificates/points.test`); баланс = сумма журнала (`points/invariants.test`).
- Отзыв: степень и баллы остаются, один раз, права (`revoke.test`); профиль выключается (`staff/profile.test`); истёкший / отозванный в ежедневной задаче (`daily.test`); в кабинете без PDF и QR (`cabinet/progress.test`).
- Публичная проверка: точный набор полей, отозванный без причины, 404 удалённого (`public.test`); `noindex`, `no-store`, в HTML нет email / телефона / года рождения / id (`tests/e2e/certificate.spec.ts`).

Дыры, которые закрывает 6.10:
1. **Нет охраны «где пишется `users.level`»**: новый код может поменять степень в обход сертификата, и ни один тест не упадёт.
2. **Сам участник через API входа** (`POST /api/auth/update-user`, `sign-up/email`) — `level` в Better Auth `input: false`, но тестом не проверено.
3. **Одновременные действия** (две сессии БД, как 5.10): двойная выдача по одному экзамену, двойная выдача уровня без экзамена, выдача «через уровень» наперегонки со ступенью, понижение степени гонкой перевыдачи, двойной отзыв, отзыв против перевыдачи — нигде не проверены. Выдача блокирует строку участника (`lockExamMember`), отзыв — строку сертификата: ожидаем зелёные, тест подтверждает.

## Файлы (ожидаемо)

- `src/lib/server/services/certificates/level-guard.test.ts` (новый, без базы) — проход по `src/**/*.ts` (без `*.test.ts`, `test-support`, `race-support`, seed): `update(users)…set({… level` и SQL `update users … level` — только в `certificates/issue.ts` и `memberships/activate.ts`; новое место — тест падает с путём. Плюс в `auth/index.ts` поле `level` (и `role`, `status`) — только с `readOnly` (`input: false`).
- `tests/e2e/level-guard.spec.ts` (новый) — регистрация с `level: 'pro'` в теле → степени нет; вошедший участник шлёт `POST /api/auth/update-user` с `{ level: 'pro', role: 'admin' }` → в кабинете степень и роль прежние (отказ 400 или молчаливый пропуск — оба годятся, проверяем итог).
- `src/lib/server/services/certificates/race.test.ts` (новый, проект `server-certificates`) — гонки через `raceDb` из `registrations/race-support.ts` (`member`, `staff`, `race`):
  - два админа выдают по одному сданному экзамену → один сертификат, степень поднята один раз, одна запись `certificate.issue` и `user.level`, одно начисление, баланс + правило один раз; второй — `already_issued`;
  - уровень без экзамена дважды (старые записи) → то же;
  - `novice` со сданными `advanced` и `pro` (pro назначен с подтверждением), обе выдачи разом в обоих порядках → `pro` есть только при живом `advanced`, выданном раньше; иначе `level_skip`;
  - `advanced` (сертификат отозван, степень оставлена) со сданным `pro`: выдача `pro` и перевыдача `advanced` разом, оба порядка → итоговая степень `pro`, никогда не ниже;
  - двойной отзыв → одна запись `certificate.revoke`, второй — `already_revoked`;
  - отзыв против перевыдачи по тому же экзамену → не больше одного живого сертификата на экзамен, без второго начисления, пока первое не отменено.
- `src/lib/server/services/registrations/race-support.ts` — при необходимости уборка экзаменов и сертификатов тестов (или свой маленький `certificates/race-support.ts`, если в общий не ложится); не ломать гонки 5.10.
- `vite.config.ts` — `race` в `ISSUE_TESTS` (последовательный проект, иначе ждёт advisory-замок номера до таймаута).

## Не ломать

- Гонки коммитят в `parkour_dev`: участники — мягко удаляются, их сертификаты и экзамены остаются за удалённым владельцем (публично — 404, ежедневная задача уровневые не трогает); журнал баллов и `audit_log` остаются (append-only). Правила баллов в коммите не менять — только вставить недостающие (`ON CONFLICT DO NOTHING`), ожидание — по фактическому правилу.
- Тесты 6.2–6.9 и гонки 5.10 (`registrations/race*.test.ts`) не трогать; общий `race-support.ts` — только дополнять.
- Код выдачи, отзыва и Better Auth не менять, если тесты зелёные (K3).
- e2e: уникальный email `e2e-*@example.com`, после `goto` с вводом — `hydrated(page)`; лимит входа по IP.

## Проверка

- `npx vitest --run --project server-certificates src/lib/server/services/certificates/race.test.ts` и `npx vitest --run src/lib/server/services/certificates/level-guard.test.ts`
- `npx playwright test tests/e2e/level-guard.spec.ts`; `npm run check`, `npm run lint`

## Риск

high (степени, баллы, Better Auth — K1 / K3; `vite.config.ts`).

## Читать

- `03` § 3, 4, 6.2, 15 (прочитаны). `zone-notes.md` § «Экзамены и сертификаты» (прочитан). Образец гонок — `registrations/race-support.ts`, `registrations/race.test.ts`; помощники выдачи — `certificates/test-support.ts`, `issue-level.test.ts`; e2e-вход — `tests/e2e/cabinet-progress.spec.ts`.

## Фазы 6.10

- [x] SPEC
- [ ] RED / прогон новых тестов (зелёные с первого раза — проверить, что ловят поломку: без блокировки участника в выдаче гонки должны падать; лишнее место записи `level` — охрана падает)
- [ ] GREEN — починка, если тест нашёл баг; иначе реализация не меняется
- [ ] REVIEW — общим шагом в конце этапа 6

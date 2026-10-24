# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки: 3.13 (песочница VPOS, боевая проверка, чек-лист ревью) — `git show c0779a9:docs/todo.md`; 4.3 (решения сервиса баллов) — `git show 4de7a8d:docs/todo.md`; 4.4a — `git show f9184bd:docs/todo.md`; 4.4b (с ответами владельца) — `git show d9f7832:docs/todo.md`; 4.5 — `git show 1260f29:docs/todo.md`; 4.6 — `git show 18f968c:docs/todo.md`; фото профиля (долг 3.10, шаг 1) — `git show 587ca52:docs/todo.md`; язык письма гостю (долг 3.7, миграция 0010) — `git show 5775200:docs/todo.md`; 5.1 таблицы — `git show ce61380:docs/todo.md`; 5.2 согласия — `git show 5729ebd:docs/todo.md`; 5.3 сервис регистраций — `git show 5a1ee28:docs/todo.md`; 5.4 платное участие — `git show ce0b9b3:docs/todo.md`; 5.5 блок регистрации на странице события — `git show d7a9fd1:docs/todo.md`; 5.6 баллы за события — `git show 8e9cde1:docs/todo.md`; 5.7a / 5.7b / 5.7c админка регистраций — `git show 3c7dca9:docs/todo.md`; 5.8 «Мои события» — `git show f3f645f:docs/todo.md`; 5.9 письма — `git show c009e36:docs/todo.md`; 5.10 тесты гонок, возраста и согласий — `git show affc6fa:docs/todo.md`; 6.1 таблицы экзаменов — `git show d6ce569:docs/todo.md`; 6.2 сервис экзаменов — `git show 95a19c6:docs/todo.md`; 6.3 сервис сертификатов — `git show d3db9da:docs/todo.md`; 6.4 PDF сертификата — `git show f582544:docs/todo.md`; 6.5 публичная проверка — `git show 3f59199:docs/todo.md`; 6.6 профили тренеров и судей, `/federation/team` — `git show ab29f7d:docs/todo.md`; 6.7a админка экзаменов (решения и «для REVIEW») — `git show 7fe95db:docs/todo.md`; 6.7b админка сертификатов (решения и «для REVIEW») — `git show 93f3107:docs/todo.md`; 6.7c админка тренеров и судей (решения и «для REVIEW») — `git show ba7fd1a:docs/todo.md`; 6.8 кабинет `/cabinet/progress` (решения и «для REVIEW») — `git show 9b82a38:docs/todo.md`.

## Задача

6.9 — ежедневная задача: истечение сертификатов тренера и судьи, письма заранее. «ебашь» владельца — 2026-10-24. **Нужна миграция 0013 — ждёт «go».** REVIEW — общим в конце этапа 6.

Факты (`03` § 4.6, 5.3, 14; `zone-notes` 6.3, 6.6, 6.7c, 6.8): сертификаты уровня бессрочные, тренера и судьи — `expires_at` (по умолчанию 24 мес.). `certificateState` уже считает просроченный `expired` по дате — задача пишет только статус. При истечении профиль `is_active = false` (`deactivateLapsedStaff(db, now)` — готов, журнал `staff_profile.deactivate`). Письмо — после коммита, ошибка отправки не ломает задачу (в лог). Образец — ежедневная задача членства: `memberships/daily.ts`, `reminders.ts` (отметка до отправки — повтор не шлёт дважды), `POST /api/cron/memberships` (`cronAccess` + `CRON_SECRET`), `.github/workflows/cron.yml` (09:00 по Еревану).

Решения агента 6.9 (в рамках документов; за сколько дней — в документах нет, предложение в `questions.md`):
- **Порядок за запуск**: 1) `active` тренер / судья с `expires_at <= now` → `expired` (одна транзакция, журнал `certificate.expire` на каждый, actor `null`); 2) `deactivateLapsedStaff(db, now)`; 3) письма. Итог `{ expired, deactivated, reminded }` в лог и в ответ. Повторный запуск безопасен.
- **Письма заранее — за 30 и 7 дней** (как у членства, `03` § 2 п. 4), список дней — в `site_settings.certificates.staff_remind_days` (по умолчанию `[30, 7]`; ключа в seed нет — `parseCertificateSettings` даёт значение по умолчанию; поломанное — по умолчанию). Короткое окно получает одно письмо (самое близкое), не два.
- **Отметка «письмо ушло»** — новая колонка `certificates.reminded_days smallint NULL`: самое малое окно, по которому письмо уже ушло. Шлём, если `expires_at <= now + d` для окна `d` и (`reminded_days` пуст или больше `d`). Отметка ставится условным `UPDATE` до отправки (как `reminded7At` у членства). Одна колонка, а не по колонке на окно: дни меняются в настройках.
- **Кому**: живой (`active`, срок в будущем) сертификат `trainer` / `judge`; владелец `active`, не удалён. Не пишем, если у него есть другой живой сертификат того же вида с более поздним сроком (переаттестация уже прошла). Членство не проверяем — сертификат от него не зависит.
- **Письмо** на языке участника (`users.locale`, иначе EN): вид сертификата (`certificates.kind.*`), номер, дата окончания по Еревану, «для переаттестации свяжитесь с федерацией», ссылка на `/cabinet/progress`. Письма «истёк» нет — только заранее (как у членства).
- **Маршрут** `POST /api/cron/certificates` (`cronAccess`, как членства); после выключения профилей — сброс кеша группы `staff` (`/federation/team`). Шаг в `cron.yml` — в то же суточное расписание, отдельный job.

## Миграция 0013 (Migration Gate — ждать «go»)

- Что: `ALTER TABLE "certificates" ADD COLUMN "reminded_days" smallint;` — только добавление пустой колонки, данные не трогаются, на `parkour_dev` применить после «go»; на прод — с деплоем этапа (вместе с 0012).
- Откат: `scripts/rollback/0013_down.sql` — `ALTER TABLE "certificates" DROP COLUMN "reminded_days";` (теряются только отметки писем: повторный запуск пришлёт напоминание ещё раз). Запускать только по «go».
- Без миграции можно отмечать письма записью в `audit_log` и искать её `NOT EXISTS` по jsonb — хуже: журнал действий не для служебных отметок, медленнее и без атомарной отметки до отправки. Не предлагаю.

## Файлы (ожидаемо)

- `src/lib/server/db/schema/certification.ts`, `drizzle/0013_certificate_reminders.sql` (+ `drizzle/meta`), `scripts/rollback/0013_down.sql` — колонка
- `src/lib/server/services/certificates/settings.ts` (+ `settings.test.ts`) — `staffRemindDays`
- `src/lib/server/services/certificates/daily.ts` (+ `daily.test.ts`) — `runCertificateDaily(db, deps)`: истечение, профили, письма; `daily-reminders.ts` — выборка и отправка; письмо — в `mail.ts` (`expiryLetter`)
- `src/lib/server/services/certificates/index.ts` — `certificateDailyNow(db)` (`sendMail`, `PUBLIC_SITE_URL`)
- `src/routes/api/cron/certificates/+server.ts` — маршрут; `.github/workflows/cron.yml` — job
- `src/lib/i18n/messages/{en,hy,ru}-certificates*.ts` — тема и текст письма
- Тест `daily.test.ts` — в проект Vitest `server-certificates` (пишет сертификаты, как `revoke.test.ts`)

## Не ломать

- Сертификаты уровня не истекают и писем не получают; отозванный не становится `expired` и писем не получает (K3).
- Живой сертификат (срок в будущем) не трогается; профиль с другим живым сертификатом того же вида не выключается; выключенный руками профиль не включается.
- Повторный запуск в тот же день: ни второго письма, ни второй записи журнала; ошибка отправки письма не валит задачу и не откатывает истечение.
- `POST /api/cron/certificates` без верного `CRON_SECRET` — 401 / 403, как у членства (K1).

## Проверка

- `npx vitest --run --project server-certificates src/lib/server/services/certificates/daily.test.ts` и `npx vitest --run src/lib/server/services/certificates/settings.test.ts src/lib/server/auth/cron.test.ts`
- `npm run check`, `npm run lint`; миграция — `npm run db:migrate` на `parkour_dev` (под Node 24)

## Риск

high (миграция, `+server.ts`, статус сертификатов и профилей — K3; `.github`).

## Читать

- `03` § 4.6, 5.3, 14 (прочитаны). `zone-notes.md` § «Экзамены и сертификаты» (6.3 «для 6.9», 6.6, 6.7c, 6.8). Образец — `memberships/{daily,reminders,mail,index}.ts`, `routes/api/cron/memberships/+server.ts`, `cron.yml` (прочитаны).

## Фазы 6.9

- [x] SPEC
- [ ] «go» на миграцию 0013
- [ ] RED
- [ ] GREEN
- [ ] REVIEW — общим шагом в конце этапа

# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

Этап 8, доработка 6.4 (решение владельца 2026-10-26, `questions.md` этап 6): под линией подписи в PDF сертификата — имя и должность подписанта на языках PDF («Ռազմիկ Գյուրջյան, ֆեդերացիայի ղեկավար» / «Razmik Giurdzian, Head of the Federation» / «Размик Гюрджян, руководитель федерации»), из `site_settings.certificates`, не из переводов. Латиницей — только Razmik Giurdzian (`00` § «Организация»).

Решения (агент):
1. Поле `signer` в `site_settings.certificates`: `{ name: { en, hy?, ru? }, title: { en, hy?, ru? } }`; не задано или битое — `null`, под линией прежняя надпись «Ստորագրություն / Signature / Подпись».
2. В PDF — строка «имя, должность» на каждом языке PDF, каждая отдельной строкой под линией; нет перевода — английский; одинаковые строки — один раз.
3. Seed (новые базы) — значения владельца. Seed существующий ключ не перезаписывает, поэтому на проде и dev подпись задаётся во вкладке «Сертификаты» `/admin/settings/certificates` (только admin, `settings.write`; журнал `settings.update` через `writeSettings`; остальные поля ключа сохраняются как есть). Все поля пустые — подпись снимается.
4. Готовые PDF не пересоздаются сами — кнопкой «Пересоздать PDF» на карточке сертификата.

## Файлы (ожидаемо)

- `src/lib/server/services/certificates/settings.ts` — `signer` в разборе, `saveCertificateSigner`
- `src/lib/server/services/certificates/pdf-content.ts` — `signature: string[]`; `pdf-render.ts` — строки под линией; `pdf-store.ts` — передать `signer`
- `src/lib/validation/certificate-signer.ts` — схема формы
- `src/routes/admin/settings/certificates/+page.server.ts`, `+page.svelte`; `SettingsTabs.svelte`
- `src/lib/server/seed/settings.ts`; переводы `*-certificates-admin.ts`
- Тесты: `settings.test.ts`, `pdf-content.test.ts`, `signer.test.ts` (сохранение), `pdf-render.test.ts` (не ломать)

## Не ломать

- Выдача и пересоздание PDF (`pdf-store.test`, `pdf-render.test`); `pdf_russian`, сроки и дни напоминаний читаются как раньше.
- Другие вкладки настроек и права: не-admin не сохраняет.

## Проверка

- `npx vitest --run src/lib/server/services/certificates/settings.test.ts src/lib/server/services/certificates/pdf-content.test.ts src/lib/server/services/certificates/signer.test.ts src/lib/server/services/certificates/pdf-render.test.ts src/lib/server/seed/settings.test.ts`

## Риск

normal (настройки и PDF; права — `settings.write`, как у вкладки «Видео»)

## Читать

- `questions.md` этап 6 (прочитано: имя и должность на языках PDF, в `site_settings.certificates`)
- `zone-notes.md` § «Экзамены и сертификаты», 6.4 (прочитано: `pdf-content` / `pdf-render`, `pdf_russian`)

## Фазы

- [x] SPEC
- [x] RED `b0072fe`
- [x] GREEN — Vitest задачи + `pdf-store`, `translate` 46/46, `access-coverage` и `audit-coverage` зелёные (`audit-coverage` — повтор с `--testTimeout`, первый раз упал по таймауту 20 с); e2e `admin-audit` + `admin-permissions` 5/5; check 0, eslint и prettier чистые. Строки подписи (до ~148 pt шрифтом APU Sans 7.5) помещаются в 150 pt без ужатия, правее — круг печати
- [ ] REVIEW (этапа)

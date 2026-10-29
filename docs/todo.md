# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).
> Памятки прошлых задач (`git show <хеш>:docs/todo.md`) — `docs/archive/todo-index.md`; закрыл задачу — дописать туда строку.

## Задача

10.5 — публичная страница проверки книжки по QR `/volunteer/{public_token}` (`06` 4.12; `03` 19.2, 19.3, 13 п. 5; `04` § 3 — строка «Книжка волонтёра»): `noindex`, без кеша, минимум персональных данных. Миграции нет. Кассир и кнопка «Отметить» — 10.6, здесь только место под них.

## Файлы (ожидаемо)

- `src/lib/server/services/volunteer/card-public.ts` (+ test) — `findPublicCard(db, token, now)`: `null` (404) | `{ valid: false, number }` | `{ valid: true, number, holder, avatarKey, validUntil, partners }`. Запрос — как `cardPdfData` (`paidUntilSql`, `privacySql`, `cardValidity`, `holderName`), но по `public_token` и без отсева удалённых: удалённый владелец — недействительна
- `src/routes/[[lang=lang]]/(site)/volunteer/[token]/+page.server.ts` — 404, `cache-control: no-store`, `x-robots-tag: noindex`; ключи фото и логотипов → `publicUrl` (как `federation/team`)
- `src/routes/[[lang=lang]]/(site)/volunteer/[token]/+page.svelte` — ✅ / ❌, фото, имя, номер, «действительна до», партнёры (логотип, плюшка, условия), `<meta name="robots" content="noindex">`
- `src/lib/i18n/messages/{en,hy,ru}-volunteer-cards.ts` — ключи `volunteerCards.check.*` (~8; файлы 105–107 строк → ≤ 116)
- `tests/e2e/volunteer-check.spec.ts` (новый) — действительная, отозванная, неизвестный токен, заголовки

## Решения агента (в пределах документов)

1. 404 — токен не base64url или длиннее 64 (как `certificates/public.ts`), неизвестный токен (в т. ч. старый после перевыдачи — токен новый на каждую выдачу). У книжки с токеном номер всегда есть; нет — тоже 404.
2. Недействительна (`cardValidity` не `valid` или владелец удалён — `06` 4.12): отдаётся только `{ valid: false, number }`; имя, фото, причины, партнёры не возвращаются из сервиса вовсе.
3. Действительна: фото — `users.avatar_key` независимо от `show_avatar` (`04` § 3); до 18 — только при `privacy`, а без неё книжка и так недействительна (`cardValidity`). Фото удалено после выдачи — рамка-заглушка без ошибки.
4. Партнёры — `visiblePartners(db, cardId, now)`; исчерпанная разовая (остаток 0) и партнёр без плюшек не показываются — как в PDF (10.4, решение 5). Остаток не печатается — его видит только кассир своего партнёра (10.6). Логотипа нет — только название.
5. Язык — `[[lang]]` страницы (QR ведёт на `/hy`), тексты плюшек — `pickLocalized` (нет перевода — EN); дата — `newsDate`, как на проверке сертификата.
6. Без лимита запросов и журнала, как проверка сертификата (6.5): токен 32 символа base64url, подбор невозможен; просмотр не опасное действие. Не через `cached()` (группа `volunteer: []`).
7. В данные страницы не попадают `id` книжки и участника; `id` партнёров и плюшек — да (нужны 10.6 для кнопок).

## Не ломать

- Личные данные (K4): на странице нет email, телефона, даты рождения, баллов, истории, причины отзыва; у недействительной — только номер (ни имени, ни фото), в т. ч. у заблокированного, удалённого и несовершеннолетнего без `privacy`.
- Отзыв, конец членства, блокировка видны сразу (`no-store`); старый QR после перевыдачи — 404.
- `/certificate/[token]` (образец, без правок); кабинет `/cabinet/volunteer` и PDF — адрес `cardCheckUrl` не меняется.
- Плюшки: только `published` у партнёра и плюшки, даты по Еревану (`03` 19.3).

## Проверка

- `npx vitest run src/lib/server/services/volunteer/card-public.test.ts`; `npm run check`, `npm run lint`
- `npx playwright test tests/e2e/volunteer-check.spec.ts`

## Риск

`high` — публичная страница с фото и именем владельца, в т. ч. до 18 (K4).

## Читать

- `03` § 19.2, 19.3, 13 п. 5; `06` § 4.12, § 4.10; `04` § 3 строка «Книжка волонтёра» — выписано выше
- `zone-notes.md` § «Волонтёрство» (10.3 правила, 10.4 PDF), § «Экзамены и сертификаты» (6.5)
- образцы: `certificates/public.ts` (+ test), `certificate/[token]/+page.server.ts` и `+page.svelte`; `volunteer/card-pdf.ts` (`cardPdfData`), `card-sql.ts`, `perks-visible.ts`; `federation/team/+page.server.ts` (`publicUrl`); `tests/e2e/certificate.spec.ts`, `admin-permissions-volunteer.ts` (вставка выданной книжки)

## Фазы

- [x] SPEC
- [ ] RED
- [ ] GREEN
- [ ] REVIEW (этапа)

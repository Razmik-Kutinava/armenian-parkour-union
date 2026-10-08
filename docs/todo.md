# todo — текущая задача (SBR)

> Один живой файл на текущую задачу. Ведётся по `.cursor/rules/sbr.mdc`. После REVIEW очищается до шаблона, итог — в `PROGRESS.md` («Сделано»).

## Задача

2.2 Редактор текста TipTap и очистка HTML при сохранении (`05` § 18). Формы, которые им пользуются (страницы, новости), — 2.3 / 2.4; здесь компонент, серверная очистка и схема поля.

Факты: § 18 — заголовки, жирный, курсив, списки, ссылки, изображения (из медиатеки), видео YouTube, цитаты; HTML очищается при сохранении. Библиотеки согласованы владельцем 2026-10-08: `sanitize-html`, `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-youtube`. Instagram — отдельным шагом.

## Файлы (ожидаемо)

- `src/lib/server/rich-text/sanitize.ts` (+ test) — белый список тегов и атрибутов, ссылки только http(s)/mailto, картинки только из хранилища (`R2_PUBLIC_URL`), iframe только YouTube embed
- `src/lib/server/rich-text/schema.ts` (+ test) — Zod-поле: длина + очистка
- `src/lib/components/admin/RichTextEditor.svelte` (+ `RichTextToolbar.svelte`, `rich-text-extensions.ts`) — TipTap, скрытое поле с HTML
- `src/lib/i18n/messages/en-editor.ts`, `ru-editor.ts` — тексты панели
- `src/routes/dev/design/AdminDemo.svelte` — пример для ручной проверки
- `package.json` — новые зависимости

## Не ломать

- Медиабиблиотека и её ключи (`services/media`, `validation/media.ts`)
- `npm run check` / `lint` / сборка: TipTap только в браузере, `sanitize-html` только на сервере
- Существующие формы админки (`LocalizedInput`, `FormLayout`)

## Проверка

- `npx vitest --run src/lib/server/rich-text`
- `npm run check; npm run lint; npm run build`

## Риск

high — очистка от XSS, `package.json`.

## Читать

- `05` § 18 (выписано выше), `01` откр. решения п. 7

## Фазы

- [x] SPEC
- [ ] RED (`test: … [RED]`)
- [ ] GREEN (`feat: … [GREEN]`)
- [ ] REGRESS
- [ ] REVIEW: local · bugbot · security-review · сверка со SPEC · PROGRESS · push · CI green
- [ ] DEPLOY (только по апруву владельца)

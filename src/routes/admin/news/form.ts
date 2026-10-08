import { error, fail } from '@sveltejs/kit';
import { R2_PUBLIC_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { readListState } from '#lib/components/admin/list-state.ts';
import { db } from '#lib/server/db/index.ts';
import { listMedia, mediaListOptions } from '#lib/server/services/media/list.ts';
import { listAuthors } from '#lib/server/services/posts/list.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import { postFormSchema, type PostValues } from '#lib/validation/posts.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';

/** The post form, cleaned on the server: the HTML is stored only as richTextSchema returns it. */
export async function readPostForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = postFormSchema(R2_PUBLIC_URL || null).safeParse(raw);
	if (parsed.success) return { values: parsed.data as PostValues, raw };
	return {
		failure: fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) })
	};
}

const refusalField: Record<string, [string, MessageKey]> = {
	slug_taken: ['slug', 'pages.error.slugTaken'],
	bad_author: ['authorId', 'news.error.author'],
	bad_cover: ['coverKey', 'news.error.cover']
};

/** Service refusals: field errors for the form, 403 / 404 for the rest. */
export function refused(result: string, raw: Record<string, unknown>) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	const [field, message] = refusalField[result];
	return fail(400, { values: flattenValues(raw), errors: { [field]: message } });
}

/** Choices for the form: authors and the latest library images for the cover. */
export async function formChoices() {
	const state = readListState(new URLSearchParams('kind=image'), mediaListOptions);
	const [authors, images] = await Promise.all([listAuthors(db), listMedia(db, state)]);
	return {
		authors,
		images: images.rows.map((m) => ({
			key: m.key,
			name: m.originalName,
			url: publicUrl(m.key)
		}))
	};
}

import { fail } from '@sveltejs/kit';
import { R2_PUBLIC_URL } from '$app/env/private';
import { pageFormSchema, type PageValues } from '#lib/validation/pages.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';

/** The page form, cleaned on the server: the HTML is stored only as richTextSchema returns it. */
export async function readPageForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = pageFormSchema(R2_PUBLIC_URL || null).safeParse(raw);
	if (parsed.success) return { values: parsed.data as PageValues, raw };
	return {
		failure: fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) })
	};
}

export const slugTaken = (raw: Record<string, unknown>) =>
	fail(400, {
		values: flattenValues(raw),
		errors: { slug: 'pages.error.slugTaken' as const }
	});

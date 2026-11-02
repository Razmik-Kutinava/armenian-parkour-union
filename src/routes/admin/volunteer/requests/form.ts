import { error, fail } from '@sveltejs/kit';
import { R2_PUBLIC_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requestFormSchema, type RequestFormValues } from '#lib/validation/volunteer-requests.ts';

/* Shared parse for create / update of a volunteer request. */

const REFUSED: Record<string, MessageKey> = {
	not_found: 'volunteer.requests.error.gone',
	bad_state: 'volunteer.requests.error.state',
	times: 'volunteer.requests.error.respondBy',
	places: 'volunteer.requests.error.places',
	respond_by: 'volunteer.requests.error.respondBy'
};

export function refused(reason: string, values?: Record<string, unknown>) {
	if (reason === 'not_allowed') error(403, 'Forbidden');
	return fail(400, { message: REFUSED[reason] ?? 'volunteer.requests.error.gone', values });
}

export async function readRequestForm(request: Request) {
	const form = Object.fromEntries(await request.formData());
	const nested: Record<string, unknown> = { ...form, title: {}, description: {} };
	for (const [key, value] of Object.entries(form)) {
		const m = /^(title|description)\.(en|hy|ru)$/.exec(key);
		if (m) (nested[m[1]] as Record<string, unknown>)[m[2]] = value;
	}
	const parsed = requestFormSchema(R2_PUBLIC_URL || null).safeParse(nested);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		return {
			failure: fail(400, {
				message: (issue?.message as MessageKey) ?? 'auth.error.required',
				values: form
			})
		};
	}
	return { values: parsed.data as RequestFormValues, raw: form };
}

import { fail } from '@sveltejs/kit';
import { purposeFormSchema, type PurposeValues } from '#lib/validation/donation-purposes.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';

/** The purpose form; an unchecked "active" box sends nothing and hides the purpose. */
export async function readPurposeForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = purposeFormSchema.safeParse(raw);
	if (parsed.success) return { values: parsed.data as PurposeValues };
	return {
		failure: fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) })
	};
}

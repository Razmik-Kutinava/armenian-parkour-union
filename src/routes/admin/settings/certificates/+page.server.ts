import { error, fail } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	certificateSettings,
	saveCertificateSigner
} from '#lib/server/services/certificates/settings.ts';
import { SIGNER_FIELDS, signerFormSchema } from '#lib/validation/certificate-signer.ts';
import { fieldErrors } from '#lib/validation/form.ts';
import type { Actions, PageServerLoad } from './$types';

/* questions.md stage 6 (2026-10-26): who signs the certificate PDF — `site_settings.certificates`. */
export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals.user, 'settings.write');
	const { signer } = await certificateSettings(db);
	return {
		values: {
			nameHy: signer?.name.hy ?? '',
			nameEn: signer?.name.en ?? '',
			nameRu: signer?.name.ru ?? '',
			titleHy: signer?.title.hy ?? '',
			titleEn: signer?.title.en ?? '',
			titleRu: signer?.title.ru ?? ''
		}
	};
};

export const actions: Actions = {
	default: async (event) => {
		const actor = requirePermission(event.locals.user, 'settings.write');
		const form = await event.request.formData();
		const values = Object.fromEntries(
			SIGNER_FIELDS.map((f) => [f, String(form.get(f) ?? '').slice(0, 200)])
		) as Record<(typeof SIGNER_FIELDS)[number], string>;
		const parsed = signerFormSchema.safeParse(values);
		if (!parsed.success) return fail(400, { values, errors: fieldErrors(parsed.error) });
		const result = await saveCertificateSigner(db, actor, parsed.data, event.getClientAddress());
		if (result !== 'ok') error(403, 'Forbidden');
		return { saved: true as const, values };
	}
};

import { z } from 'zod';

/* questions.md stage 6 (2026-10-26): who signs the certificate PDF — name and title per language.
 * English is the fallback, so it is required once anything is filled; all empty — no signer. */

const MAX = 80;

export const SIGNER_FIELDS = [
	'nameHy',
	'nameEn',
	'nameRu',
	'titleHy',
	'titleEn',
	'titleRu'
] as const;
type SignerField = (typeof SIGNER_FIELDS)[number];

const localized = (en: string, hy: string, ru: string) => ({
	en,
	...(hy ? { hy } : {}),
	...(ru ? { ru } : {})
});

export const signerFormSchema = z
	.object(
		Object.fromEntries(SIGNER_FIELDS.map((f) => [f, z.string().trim()])) as Record<
			SignerField,
			z.ZodString
		>
	)
	.superRefine((v, ctx) => {
		for (const f of SIGNER_FIELDS) {
			if (v[f].length > MAX) {
				ctx.addIssue({ code: 'custom', path: [f], message: 'certificates.signer.error.long' });
			}
		}
		if (SIGNER_FIELDS.every((f) => v[f] === '')) return;
		for (const f of ['nameEn', 'titleEn'] as const) {
			if (v[f] === '') {
				ctx.addIssue({ code: 'custom', path: [f], message: 'certificates.signer.error.required' });
			}
		}
	})
	.transform((v) =>
		SIGNER_FIELDS.every((f) => v[f] === '')
			? null
			: {
					name: localized(v.nameEn, v.nameHy, v.nameRu),
					title: localized(v.titleEn, v.titleHy, v.titleRu)
				}
	);
export type SignerForm = z.output<typeof signerFormSchema>;

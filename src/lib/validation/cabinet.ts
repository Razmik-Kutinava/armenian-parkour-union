import { z } from 'zod';
import { isCountryCode } from '#lib/countries.ts';
import { locales } from '#lib/i18n/locales.ts';
import { PASSWORD_MAX, PASSWORD_MIN, email, guardian, name, optional, phone } from './auth';

/* Cabinet forms (docs/06 section 5.2). Messages are i18n keys. Birth date is not here: it changes
 * only through an admin; whether parent data is required follows the stored date. */

const text = (max: number) => z.string().trim().max(max, { error: 'auth.error.tooLong' });
const required = { error: 'auth.error.required' } as const;

export function ownProfileSchema(minor: boolean) {
	return z
		.object({
			firstName: name,
			lastName: name,
			phone: optional(phone),
			country: z
				.string(required)
				.trim()
				.toUpperCase()
				.refine(isCountryCode, { error: 'cabinet.error.country' }),
			city: optional(text(100)),
			bio: optional(text(1000)),
			locale: z.enum(locales, { error: 'cabinet.error.locale' }),
			...guardian
		})
		.superRefine((data, ctx) => {
			if (!minor) return;
			for (const field of ['guardianName', 'guardianPhone', 'guardianEmail'] as const) {
				if (data[field] === undefined) {
					ctx.addIssue({ code: 'custom', path: [field], message: 'auth.error.required' });
				}
			}
		});
}

export type OwnProfileInput = z.output<ReturnType<typeof ownProfileSchema>>;

export const emailChangeSchema = z.object({ newEmail: email });

export const passwordChangeSchema = z.object({
	currentPassword: z.string(required).min(1, required),
	newPassword: z
		.string({ error: 'auth.error.passwordLength' })
		.min(PASSWORD_MIN, { error: 'auth.error.passwordLength' })
		.max(PASSWORD_MAX, { error: 'auth.error.passwordLength' })
});

import { z } from 'zod';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
const ADULT_AGE = 18;
const MAX_AGE = 120;

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const email = z
	.string({ error: 'auth.error.email' })
	.trim()
	.toLowerCase()
	.pipe(z.email({ error: 'auth.error.email' }));
const password = z
	.string({ error: 'auth.error.passwordLength' })
	.min(PASSWORD_MIN, { error: 'auth.error.passwordLength' })
	.max(PASSWORD_MAX, { error: 'auth.error.passwordLength' });
const name = z
	.string({ error: 'auth.error.required' })
	.trim()
	.min(1, { error: 'auth.error.required' })
	.max(100, { error: 'auth.error.tooLong' });
const optional = <T extends z.ZodType>(schema: T) =>
	z.preprocess(blankToUndefined, schema.optional());
const phone = z
	.string()
	.trim()
	.regex(/^\+?[\d\s()-]{6,20}$/, { error: 'auth.error.phone' });

function parseDate(value: string): { y: number; m: number; d: number } | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const [y, m, d] = match.slice(1).map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	const real =
		date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
	return real ? { y, m, d } : null;
}

function ageOn(birthDate: string, today: Date): number | null {
	const b = parseDate(birthDate);
	if (!b) return null;
	const [ty, tm, td] = [today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()];
	const hadBirthday = tm > b.m || (tm === b.m && td >= b.d);
	return ty - b.y - (hadBirthday ? 0 : 1);
}

/** Under 18 on `today` (UTC calendar date). `birthDate` is `YYYY-MM-DD`. */
export function isMinor(birthDate: string, today: Date): boolean {
	const age = ageOn(birthDate, today);
	return age !== null && age >= 0 && age < ADULT_AGE;
}

const guardianFields = ['guardianName', 'guardianPhone', 'guardianEmail'] as const;

/** docs/06 section 4.11, docs/03 sections 1 and 13: parent data is required under 18. */
export function registerSchema(today: Date = new Date()) {
	return z
		.object({
			email,
			password,
			firstName: name,
			lastName: name,
			birthDate: z.string({ error: 'auth.error.birthDate' }).refine((v) => {
				const age = ageOn(v, today);
				return age !== null && age >= 0 && age <= MAX_AGE;
			}, 'auth.error.birthDate'),
			terms: z.literal('on', { error: 'auth.error.terms' }).transform(() => true),
			guardianName: optional(name),
			guardianPhone: optional(phone),
			guardianEmail: optional(email)
		})
		.superRefine(
			(data, ctx) => {
				if (typeof data.birthDate !== 'string' || !isMinor(data.birthDate, today)) return;
				for (const field of guardianFields) {
					if (data[field] === undefined) {
						ctx.addIssue({ code: 'custom', path: [field], message: 'auth.error.required' });
					}
				}
			},
			{ when: () => true }
		);
}

export type Registration = z.output<ReturnType<typeof registerSchema>>;

export const signInSchema = z.object({
	email,
	password: z.string({ error: 'auth.error.required' }).min(1, { error: 'auth.error.required' })
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
	token: z.string().min(1),
	password
});

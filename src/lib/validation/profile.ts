import { z } from 'zod';
import { birthDate, guardian, name, requireGuardianIfMinor } from './auth';

/** docs/06 section 4.11 without email and password: what a Google account still has to give. */
export function completeProfileSchema(today: Date = new Date()) {
	return z
		.object({
			firstName: name,
			lastName: name,
			birthDate: birthDate(today),
			terms: z.literal('on', { error: 'auth.error.terms' }).transform(() => true as const),
			...guardian
		})
		.superRefine(...requireGuardianIfMinor(today));
}

export type ProfileCompletion = z.output<ReturnType<typeof completeProfileSchema>>;

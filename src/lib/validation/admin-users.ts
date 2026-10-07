import { z } from 'zod';
import { birthDate, email, guardian, name, optional, phone, requireGuardianIfMinor } from './auth';

/* Admin forms for users (docs/05 sections 6 and 23). Messages are i18n keys. */

export const roles = ['member', 'editor', 'moderator', 'admin'] as const;

const city = z.string().trim().max(100, { error: 'auth.error.tooLong' });

const profileFields = (today: Date) => ({
	firstName: name,
	lastName: name,
	birthDate: birthDate(today),
	phone: optional(phone),
	city: optional(city),
	...guardian
});

/** Email is not edited here: it is the login and changes with confirmation (later). */
export const profileSchema = (today: Date = new Date()) =>
	z.object(profileFields(today)).superRefine(...requireGuardianIfMinor(today));

export const createUserSchema = (today: Date = new Date()) =>
	z.object({ email, ...profileFields(today) }).superRefine(...requireGuardianIfMinor(today));

export type ProfileInput = z.output<ReturnType<typeof profileSchema>>;
export type NewUserInput = z.output<ReturnType<typeof createUserSchema>>;

export const roleSchema = z.object({ role: z.enum(roles) });

export const blockSchema = z.object({
	reason: z
		.string({ error: 'auth.error.required' })
		.trim()
		.min(1, { error: 'auth.error.required' })
		.max(1000, { error: 'auth.error.tooLong' })
});

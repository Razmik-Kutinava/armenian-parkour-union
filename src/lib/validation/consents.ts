import { z } from 'zod';
import { yerevanDay } from './admin-payments';
import { mediaTypes } from './media';

/* Consents (docs/05 section 10, docs/06 section 5.10); files and terms — decisions.md 2026-10-22. */

export const CONSENT_MAX_BYTES = 10 * 1024 * 1024;
export const consentMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type ConsentMime = (typeof consentMimes)[number];
export const isConsentMime = (mime: string): mime is ConsentMime =>
	(consentMimes as readonly string[]).includes(mime);

export const consentKinds = ['parental', 'medical', 'privacy'] as const;
export type ConsentKind = (typeof consentKinds)[number];

const kind = z.enum(consentKinds, { error: 'consents.error.kind' });

export const consentSignSchema = z.object({
	kind,
	mime: z.enum(consentMimes, { error: 'consents.error.type' }),
	size: z.coerce
		.number()
		.int()
		.min(1, { error: 'consents.error.empty' })
		.max(CONSENT_MAX_BYTES, { error: 'consents.error.size' })
});
export type ConsentSignRequest = z.output<typeof consentSignSchema>;

/** `consents/<user id>/<uuid>.<ext>`: the owner is part of the key, the name never comes from the user. */
export const consentKey = (userId: string, mime: ConsentMime) =>
	`consents/${userId}/${crypto.randomUUID()}.${mediaTypes[mime]}`;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const KEY = new RegExp(`^consents/(${UUID})/${UUID}\\.(\\w+)$`);

/** The type of a consent key of this user; `null` for anyone else's or any other key. */
export function consentMimeOfKey(userId: string, key: string): ConsentMime | null {
	const match = KEY.exec(key);
	if (!match || match[1] !== userId) return null;
	return consentMimes.find((m) => mediaTypes[m] === match[2]) ?? null;
}

function realDay(value: string): boolean {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!m) return false;
	const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
	return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** The last moment of a day in Yerevan (no daylight saving: +04:00). */
export const endOfYerevanDay = (day: string) => new Date(`${day}T23:59:59.999+04:00`);
export const startOfYerevanDay = (day: string) => new Date(`${day}T00:00:00+04:00`);

export function consentCompleteSchema(now: Date = new Date()) {
	const today = yerevanDay(now);
	return z.object({
		kind,
		key: z.string().max(200),
		signedOn: z
			.string({ error: 'consents.error.signedOn' })
			.refine((v) => realDay(v) && v <= today, { error: 'consents.error.signedOn' })
	});
}
export type ConsentCompleteRequest = z.output<ReturnType<typeof consentCompleteSchema>>;

/** "Valid until" — optional, today or later; stored as the end of that day. */
export function approveSchema(now: Date = new Date()) {
	const today = yerevanDay(now);
	return z.object({
		validUntil: z
			.string()
			.optional()
			.transform((v) => v?.trim() ?? '')
			.refine((v) => v === '' || (realDay(v) && v >= today), {
				error: 'consents.error.validUntil'
			})
			.transform((v) => (v ? endOfYerevanDay(v) : null))
	});
}

export const rejectSchema = z.object({
	note: z
		.string({ error: 'consents.error.note' })
		.trim()
		.min(1, { error: 'consents.error.note' })
		.max(500, { error: 'auth.error.tooLong' })
});

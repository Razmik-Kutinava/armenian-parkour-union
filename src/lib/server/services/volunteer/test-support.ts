import { eq } from 'drizzle-orm';
import type { PartnerValues, PerkValues } from '#lib/validation/volunteer-partners.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { insertUser } from '../../db/test-db';
import { consents } from '../../db/schema/consents';
import { memberships } from '../../db/schema/payments';
import { media, siteSettings } from '../../db/schema/service';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import type { Mail } from '../../mail/resend';

/* Test support only: volunteering services against the rolled-back test transaction. */

export async function staff(tx: LimitDb, role: UserRole = 'admin') {
	const { id } = await insertUser(tx, { role });
	return { id, role };
}

export const partnerValues = (extra: Partial<PartnerValues> = {}): PartnerValues => ({
	name: `Partner ${crypto.randomUUID().slice(0, 8)}`,
	logoKey: null,
	website: null,
	address: null,
	status: 'draft',
	...extra
});

export const perkValues = (extra: Partial<PerkValues> = {}): PerkValues => ({
	title: { en: '10% off', ru: 'Скидка 10 %' },
	terms: null,
	kind: 'reusable',
	usesLimit: null,
	validFrom: null,
	validUntil: null,
	status: 'draft',
	sortOrder: 0,
	...extra
});

/** A library file; `mime` other than an image, or `deleted`, makes a bad logo. */
export async function insertMedia(
	tx: LimitDb,
	uploadedBy: string,
	{ mime = 'image/png', deleted = false } = {}
) {
	const key = `media/2026/10/${crypto.randomUUID()}.${mime === 'image/png' ? 'png' : 'pdf'}`;
	await tx.insert(media).values({
		key,
		originalName: 'logo',
		mime,
		sizeBytes: 10,
		uploadedBy,
		deletedAt: deleted ? new Date() : null
	});
	return key;
}

export const SITE = 'https://parkour.test';
export const IP = '10.0.0.8';
const DAY = 86_400_000;
export const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

/** Letters the code tried to send; `failing` throws like an unreachable mail service. */
export function mailbox(failing = false) {
	const sent: Mail[] = [];
	const send = async (mail: Mail) => {
		if (failing) throw new Error('mail is down');
		sent.push(mail);
	};
	return { sent, send };
}

export const cardDeps = (send: (mail: Mail) => Promise<void>) => ({ send, siteUrl: SITE, ip: IP });

export async function addMembership(tx: LimitDb, userId: string, from: number, to: number) {
	await tx.insert(memberships).values({
		userId,
		status: 'active',
		startsAt: daysFromNow(from),
		endsAt: daysFromNow(to)
	});
}

type VolunteerOptions = Parameters<typeof insertUser>[1] & { member?: boolean };

/** Meets the card conditions (docs/03 section 19.1) unless overridden: an adult with a verified
 * email, a photo and a membership till +300 days. */
export async function volunteer(tx: LimitDb, { member = true, ...values }: VolunteerOptions = {}) {
	const user = await insertUser(tx, {
		emailVerified: true,
		avatarKey: `avatars/${crypto.randomUUID()}.jpg`,
		...values
	});
	if (member) await addMembership(tx, user.id, -10, 300);
	return user;
}

export async function insertPrivacy(tx: LimitDb, userId: string, validUntil: Date | null = null) {
	await tx.insert(consents).values({
		userId,
		kind: 'privacy',
		status: 'approved',
		fileKey: `consents/${userId}/${crypto.randomUUID()}.pdf`,
		validUntil
	});
}

export const cardRow = async (tx: LimitDb, id: string) =>
	(await tx.select().from(volunteerCards).where(eq(volunteerCards.id, id)))[0];

export async function setFederationEmail(tx: LimitDb, email: string | null) {
	const value = email ? { email } : {};
	await tx
		.insert(siteSettings)
		.values({ key: 'contacts', value })
		.onConflictDoUpdate({ target: siteSettings.key, set: { value } });
}

import type { PartnerValues, PerkValues } from '#lib/validation/volunteer-partners.ts';
import type { LimitDb } from '../../auth/rate-limit';
import type { UserRole } from '../../auth/session';
import { insertUser } from '../../db/test-db';
import { media } from '../../db/schema/service';

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

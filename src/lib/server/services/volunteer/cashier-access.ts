import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { localizePath } from '#lib/i18n/locales.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { partnerCashiers, volunteerPartners } from '../../db/schema/volunteer-partners';

/* docs/03 section 19.4 items 1–2, docs/04 sections 2 and 5.2 item 7: a cashier is a phone, not a
 * user — known by the hash of its cookie token, while the access is bound and not disabled. */

export const CASHIER_COOKIE = 'apu_cashier';
/** Seconds; browsers cap cookies at 400 days, docs/03 asks for no less than a year. */
export const CASHIER_COOKIE_MAX_AGE = 400 * 86_400;

export const newCashierToken = () => randomBytes(32).toString('base64url');
export const cashierTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Our tokens only: 32 random bytes in base64url. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const hashOf = (token: string | null | undefined) =>
	token && TOKEN.test(token) ? cashierTokenHash(token) : null;

/** Like the QR, the link opens the Armenian page. */
export const cashierInviteUrl = (siteUrl: string, token: string) =>
	`${siteUrl.replace(/\/+$/, '')}${localizePath(`/partner/join/${token}`, 'hy')}`;

export type Cashier = { id: string; partnerId: string; partnerName: string; label: string };

const liveInvite = (hash: string, now: Date) =>
	and(
		eq(partnerCashiers.inviteTokenHash, hash),
		isNull(partnerCashiers.disabledAt),
		gt(partnerCashiers.inviteExpiresAt, now)
	);

/** The join page asks before binding: a link preview must not use the link up. */
export async function findInvite(db: LimitDb, token: string, now = new Date()) {
	const hash = hashOf(token);
	if (!hash) return null;
	const [row] = await db
		.select({ partnerName: volunteerPartners.name, label: partnerCashiers.label })
		.from(partnerCashiers)
		.innerJoin(volunteerPartners, eq(volunteerPartners.id, partnerCashiers.partnerId))
		.where(liveInvite(hash, now));
	return row ?? null;
}

/** One statement: of two parallel opens only one binds. Returns the cookie token of the phone. */
export async function bindCashier(db: LimitDb, token: string, now = new Date()) {
	const hash = hashOf(token);
	if (!hash) return null;
	const device = newCashierToken();
	const [row] = await db
		.update(partnerCashiers)
		.set({ inviteTokenHash: null, deviceTokenHash: cashierTokenHash(device), boundAt: now })
		.where(liveInvite(hash, now))
		.returning({ id: partnerCashiers.id });
	return row ? device : null;
}

export async function findCashier(
	db: LimitDb,
	deviceToken: string | null | undefined
): Promise<Cashier | null> {
	const hash = hashOf(deviceToken);
	if (!hash) return null;
	const [row] = await db
		.select({
			id: partnerCashiers.id,
			partnerId: partnerCashiers.partnerId,
			partnerName: volunteerPartners.name,
			label: partnerCashiers.label
		})
		.from(partnerCashiers)
		.innerJoin(volunteerPartners, eq(volunteerPartners.id, partnerCashiers.partnerId))
		.where(
			and(
				eq(partnerCashiers.deviceTokenHash, hash),
				isNull(partnerCashiers.disabledAt),
				isNotNull(partnerCashiers.boundAt)
			)
		);
	return row ?? null;
}

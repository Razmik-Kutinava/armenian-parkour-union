import { and, eq, gt, isNull, or, type SQL } from 'drizzle-orm';
import { isMinor } from '#lib/validation/auth.ts';
import { consentKinds, type ConsentKind } from '#lib/validation/consents.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { isUuid } from '../users/target';

export type ConsentStatus = (typeof consents.$inferSelect)['status'];

/** decisions.md 2026-10-22 (5.2): a minor — every kind; an adult — the medical clearance only. */
export const kindsFor = (birthDate: string | null, today: Date): ConsentKind[] =>
	birthDate && isMinor(birthDate, today) ? [...consentKinds] : ['medical'];

/** docs/03 section 13 p. 2: approved and not past its term. */
export const inForce = (now: Date): SQL =>
	and(
		eq(consents.status, 'approved'),
		or(isNull(consents.validUntil), gt(consents.validUntil, now))
	)!;

/** `expired` is not written by a job yet: an approved consent past its term is shown as expired. */
export const statusView = (status: ConsentStatus, validUntil: Date | null, now: Date) =>
	status === 'approved' && validUntil && validUntil <= now ? 'expired' : status;

/** For event registration (5.3): the member has this consent in force. */
export async function hasValidConsent(
	db: LimitDb,
	userId: string,
	kind: ConsentKind,
	now = new Date()
): Promise<boolean> {
	if (!isUuid(userId)) return false;
	const [row] = await db
		.select({ id: consents.id })
		.from(consents)
		.where(and(eq(consents.userId, userId), eq(consents.kind, kind), inForce(now)))
		.limit(1);
	return Boolean(row);
}

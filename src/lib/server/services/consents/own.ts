import { and, desc, eq, isNull } from 'drizzle-orm';
import { isMinor } from '#lib/validation/auth.ts';
import type { ConsentKind } from '#lib/validation/consents.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { users } from '../../db/schema/users';
import type { PrivateStorage } from '../../storage/types';
import { isUuid } from '../users/target';
import { fileLink } from './files';
import { kindsFor, statusView } from './valid';

export type ConsentView = 'pending' | 'approved' | 'rejected' | 'expired';

export type OwnConsent = {
	kind: ConsentKind;
	/** The latest upload of this kind. */
	latest: {
		status: ConsentView;
		signedAt: Date | null;
		validUntil: Date | null;
		reviewNote: string | null;
		createdAt: Date;
		fileUrl: string | null;
	} | null;
	/** An approved consent in force — maybe older than `latest`, which may wait for review. */
	inForce: { validUntil: Date | null } | null;
};

export type OwnConsents = { minor: boolean; items: OwnConsent[] };

/** docs/06 section 5.10: the signed-in member's own consents (docs/04 section 5.3). */
export async function getOwnConsents(
	db: LimitDb,
	storage: PrivateStorage | null,
	userId: string,
	now = new Date()
): Promise<OwnConsents | null> {
	if (!isUuid(userId)) return null;
	const [user] = await db
		.select({ birthDate: users.birthDate })
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	if (!user) return null;
	const rows = await db
		.select()
		.from(consents)
		.where(eq(consents.userId, userId))
		.orderBy(desc(consents.createdAt));
	const items = kindsFor(user.birthDate, now).map(async (kind): Promise<OwnConsent> => {
		const mine = rows.filter((r) => r.kind === kind);
		const last = mine[0];
		const force = mine.find((r) => statusView(r.status, r.validUntil, now) === 'approved');
		return {
			kind,
			latest: last
				? {
						status: statusView(last.status, last.validUntil, now),
						signedAt: last.signedAt,
						validUntil: last.validUntil,
						reviewNote: last.status === 'rejected' ? last.reviewNote : null,
						createdAt: last.createdAt,
						fileUrl: await fileLink(storage, userId, last.fileKey)
					}
				: null,
			inForce: force ? { validUntil: force.validUntil } : null
		};
	});
	const minor = user.birthDate ? isMinor(user.birthDate, now) : false;
	return { minor, items: await Promise.all(items) };
}

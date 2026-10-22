import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ageOn } from '#lib/validation/auth.ts';
import type { ConsentKind } from '#lib/validation/consents.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { users } from '../../db/schema/users';
import type { PrivateStorage } from '../../storage/types';
import { isUuid, type Actor } from '../users/target';
import { fileLink } from './files';
import type { ConsentView } from './own';
import { statusView } from './valid';

/* docs/05 section 10: the card — member and parent, the file by a short signed link. */

export type ConsentCard = {
	id: string;
	kind: ConsentKind;
	status: ConsentView;
	signedAt: Date | null;
	validUntil: Date | null;
	reviewNote: string | null;
	guardianName: string | null;
	reviewerName: string | null;
	createdAt: Date;
	updatedAt: Date;
	fileUrl: string | null;
	member: {
		id: string;
		name: string;
		age: number | null;
		guardianName: string | null;
		guardianPhone: string | null;
		guardianEmail: string | null;
		/* only with users.read_full (docs/04 section 4) */
		email?: string;
	};
};

const reviewer = alias(users, 'reviewer');

/** docs/04 section 4: a moderator sees the age and the parent, not the birth date or contacts. */
export async function getConsentCard(
	db: LimitDb,
	viewer: Actor,
	storage: PrivateStorage | null,
	id: string,
	now = new Date()
): Promise<ConsentCard | null> {
	if (!roleCan(viewer.role, 'consents.review') || !isUuid(id)) return null;
	const [row] = await db
		.select({ consent: consents, user: users, reviewerName: reviewer.name })
		.from(consents)
		.innerJoin(users, eq(users.id, consents.userId))
		.leftJoin(reviewer, eq(reviewer.id, consents.reviewedBy))
		.where(and(eq(consents.id, id), isNull(users.deletedAt)));
	if (!row) return null;
	const { consent: c, user: u } = row;
	const member: ConsentCard['member'] = {
		id: u.id,
		name: u.name,
		age: u.birthDate ? ageOn(u.birthDate, now) : null,
		guardianName: u.guardianName,
		guardianPhone: u.guardianPhone,
		guardianEmail: u.guardianEmail
	};
	if (roleCan(viewer.role, 'users.read_full')) member.email = u.email;
	return {
		id: c.id,
		kind: c.kind,
		status: statusView(c.status, c.validUntil, now),
		signedAt: c.signedAt,
		validUntil: c.validUntil,
		reviewNote: c.reviewNote,
		guardianName: c.guardianName,
		reviewerName: row.reviewerName,
		createdAt: c.createdAt,
		updatedAt: c.updatedAt,
		fileUrl: await fileLink(storage, u.id, c.fileKey),
		member
	};
}

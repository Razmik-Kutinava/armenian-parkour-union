import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ageOn } from '#lib/validation/auth.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { isUuid } from '../users/target';
import { cardValidity } from './card-rules';
import { paidUntilSql, privacySql } from './card-sql';

/* docs/05 section 28 "Cards", the card: data, photo, validity, the check page; decisions —
 * docs/todo.md 10.3 (8). PDF, invitations, redemptions and reports come with 10.4–10.10. */

const reviewer = alias(users, 'reviewer');

export async function cardDetail(db: LimitDb, id: string, now = new Date()) {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			card: volunteerCards,
			member: {
				id: users.id,
				name: users.name,
				email: users.email,
				birthDate: users.birthDate,
				avatarKey: users.avatarKey,
				status: users.status
			},
			reviewerName: reviewer.name,
			paidUntil: paidUntilSql(now),
			privacy: privacySql(now)
		})
		.from(volunteerCards)
		.innerJoin(users, eq(users.id, volunteerCards.userId))
		.leftJoin(reviewer, eq(reviewer.id, volunteerCards.reviewedBy))
		.where(and(eq(volunteerCards.id, id), isNull(users.deletedAt)));
	if (!row) return null;
	const { card, member, paidUntil, privacy } = row;
	const facts = { birthDate: member.birthDate, status: member.status, paidUntil, privacy };
	return {
		id: card.id,
		status: card.status,
		number: card.number,
		publicToken: card.publicToken,
		appliedAt: card.appliedAt,
		issuedAt: card.issuedAt,
		reviewedAt: card.reviewedAt,
		reviewNote: card.reviewNote,
		reviewerName: row.reviewerName,
		declineStreak: card.declineStreak,
		flagged: card.flaggedAt !== null,
		paidUntil,
		validity: cardValidity(card.status, facts, now),
		member: {
			id: member.id,
			name: member.name,
			email: member.email,
			avatarKey: member.avatarKey,
			age: member.birthDate ? ageOn(member.birthDate, now) : null
		}
	};
}
export type CardDetail = NonNullable<Awaited<ReturnType<typeof cardDetail>>>;

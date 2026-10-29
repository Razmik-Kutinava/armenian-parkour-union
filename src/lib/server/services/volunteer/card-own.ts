import { and, eq, isNull } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { isUuid } from '../users/target';
import { cardFacts } from './card-facts';
import {
	cardValidity,
	missingForCard,
	type CardMissing,
	type CardStatus,
	type CardValidity
} from './card-rules';
import { visiblePartners, type VisiblePartner } from './perks-visible';

/* docs/06 section 5.12 "Card" and "Perks": the member's own card only — the id comes from the
 * session. The QR token and the perks — a valid card only (docs/03 section 19.2 p. 3). */

export type OwnCard = {
	card: {
		status: CardStatus;
		number: string | null;
		issuedAt: Date | null;
		reviewNote: string | null;
	} | null;
	/** What applying lacks (docs/03 section 19.1 p. 1). */
	missing: CardMissing[];
	/** Only for an active card (docs/03 section 19.2). */
	validity: CardValidity | null;
	/** The check page token for the QR. */
	checkToken: string | null;
	partners: VisiblePartner[];
};

export async function ownCard(db: LimitDb, userId: string, now = new Date()): Promise<OwnCard> {
	const empty: OwnCard = {
		card: null,
		missing: [],
		validity: null,
		checkToken: null,
		partners: []
	};
	if (!isUuid(userId)) return empty;
	const [member] = await db
		.select({
			status: users.status,
			birthDate: users.birthDate,
			emailVerified: users.emailVerified,
			avatarKey: users.avatarKey
		})
		.from(users)
		.where(and(eq(users.id, userId), isNull(users.deletedAt)));
	if (!member) return empty;
	const [[row], facts] = await Promise.all([
		db
			.select({
				id: volunteerCards.id,
				publicToken: volunteerCards.publicToken,
				status: volunteerCards.status,
				number: volunteerCards.number,
				issuedAt: volunteerCards.issuedAt,
				reviewNote: volunteerCards.reviewNote
			})
			.from(volunteerCards)
			.where(eq(volunteerCards.userId, userId)),
		cardFacts(db, userId, member, now)
	]);
	const validity = row?.status === 'active' ? cardValidity(row.status, facts, now) : null;
	const checkToken = (validity?.valid && row?.publicToken) || null;
	return {
		card: row
			? {
					status: row.status,
					number: row.number,
					issuedAt: row.issuedAt,
					reviewNote: row.reviewNote
				}
			: null,
		missing: missingForCard(facts, now),
		validity,
		checkToken,
		partners: checkToken && row ? await visiblePartners(db, row.id, now) : []
	};
}

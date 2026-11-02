import { and, desc, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { perkRedemptions, volunteerCards } from '../../db/schema/volunteer-cards';
import { volunteerPartners, volunteerPerks } from '../../db/schema/volunteer-partners';
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
 * session. The QR token and the perks — a valid card only (docs/03 section 19.2 p. 3). History of
 * uses stays when the card is no longer valid (docs/03 section 19.2 p. 3). */

export type OwnRedemption = {
	id: string;
	createdAt: Date;
	partnerName: string;
	perkTitle: LocalizedText;
	/** The mark was later reversed (docs/03 section 19.4 p. 5). */
	reversed: boolean;
};

export type OwnCard = {
	card: {
		status: CardStatus;
		number: string | null;
		issuedAt: Date | null;
		reviewNote: string | null;
		declineStreak: number;
		flagged: boolean;
	} | null;
	/** What applying lacks (docs/03 section 19.1 p. 1). */
	missing: CardMissing[];
	/** Only for an active card (docs/03 section 19.2). */
	validity: CardValidity | null;
	/** The check page token for the QR. */
	checkToken: string | null;
	partners: VisiblePartner[];
	/** Cashier marks only (reversal rows are not listed — the mark shows `reversed`). */
	redemptions: OwnRedemption[];
};

const empty: OwnCard = {
	card: null,
	missing: [],
	validity: null,
	checkToken: null,
	partners: [],
	redemptions: []
};

const reversal = alias(perkRedemptions, 'own_rev');

async function ownRedemptions(db: LimitDb, cardId: string): Promise<OwnRedemption[]> {
	const rows = await db
		.select({
			id: perkRedemptions.id,
			createdAt: perkRedemptions.createdAt,
			partnerName: volunteerPartners.name,
			perkTitle: volunteerPerks.title,
			reversedById: reversal.id
		})
		.from(perkRedemptions)
		.innerJoin(volunteerPartners, eq(volunteerPartners.id, perkRedemptions.partnerId))
		.innerJoin(volunteerPerks, eq(volunteerPerks.id, perkRedemptions.perkId))
		.leftJoin(reversal, eq(reversal.reversalOfId, perkRedemptions.id))
		.where(and(eq(perkRedemptions.cardId, cardId), isNull(perkRedemptions.reversalOfId)))
		.orderBy(desc(perkRedemptions.createdAt), desc(perkRedemptions.id));
	return rows.map((r) => ({
		id: r.id,
		createdAt: r.createdAt,
		partnerName: r.partnerName,
		perkTitle: r.perkTitle as LocalizedText,
		reversed: r.reversedById !== null
	}));
}

export async function ownCard(db: LimitDb, userId: string, now = new Date()): Promise<OwnCard> {
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
				reviewNote: volunteerCards.reviewNote,
				declineStreak: volunteerCards.declineStreak,
				flaggedAt: volunteerCards.flaggedAt
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
					reviewNote: row.reviewNote,
					declineStreak: row.declineStreak,
					flagged: row.flaggedAt !== null
				}
			: null,
		missing: missingForCard(facts, now),
		validity,
		checkToken,
		partners: checkToken && row ? await visiblePartners(db, row.id, now) : [],
		redemptions: row ? await ownRedemptions(db, row.id) : []
	};
}

import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { holderName } from '../certificates/pdf-content';
import { cardValidity } from './card-rules';
import { paidUntilSql, privacySql } from './card-sql';
import { visiblePartners, type VisiblePartner } from './perks-visible';

/* docs/06 section 4.12, docs/03 sections 19.2–19.3: what anyone with the QR sees. A card that is
 * not valid — the number only: no name, photo, reason or partners leave this function. */

export type PublicCard =
	| { valid: false; number: string }
	| {
			valid: true;
			number: string;
			holder: string;
			avatarKey: string | null;
			validUntil: Date;
			partners: VisiblePartner[];
	  };

/** `newPublicToken` is base64url; anything else cannot be ours. */
const TOKEN = /^[A-Za-z0-9_-]{1,64}$/;

/** An unknown token (an old one after a new issue too) — `null`, the page answers 404. */
export async function findPublicCard(
	db: LimitDb,
	token: string,
	now = new Date()
): Promise<PublicCard | null> {
	if (!TOKEN.test(token)) return null;
	const [row] = await db
		.select({
			id: volunteerCards.id,
			status: volunteerCards.status,
			number: volunteerCards.number,
			member: {
				name: users.name,
				firstName: users.firstName,
				lastName: users.lastName,
				avatarKey: users.avatarKey,
				birthDate: users.birthDate,
				status: users.status,
				deletedAt: users.deletedAt
			},
			paidUntil: paidUntilSql(now),
			privacy: privacySql(now)
		})
		.from(volunteerCards)
		.innerJoin(users, eq(users.id, volunteerCards.userId))
		.where(eq(volunteerCards.publicToken, token));
	if (!row?.number) return null;
	const { member, paidUntil, privacy } = row;
	const facts = { birthDate: member.birthDate, status: member.status, paidUntil, privacy };
	const validity = cardValidity(row.status, facts, now);
	if (!validity.valid || member.deletedAt) return { valid: false, number: row.number };
	const partners = (await visiblePartners(db, row.id, now))
		.map((p) => ({ ...p, perks: p.perks.filter((perk) => perk.remaining !== 0) }))
		.filter((p) => p.perks.length > 0);
	return {
		valid: true,
		number: row.number,
		holder: holderName(member),
		avatarKey: member.avatarKey,
		validUntil: validity.until,
		partners
	};
}

import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import type { Mail } from '../../mail/resend';
import { isUuid } from '../users/target';
import { cardFacts, federationEmail, lockCardMember } from './card-facts';
import { cardRequestLetter } from './card-mail';
import { missingForCard, type CardMissing } from './card-rules';

/* docs/03 section 19.1 pp. 1, 5; decisions — docs/todo.md 10.3 (3, 5, 7). The member applies from the
 * cabinet; the conditions are checked here and again at the issue. Only decisions are audited
 * (docs/03 section 19.9). The letter waits for the commit. */

export type CardDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
	now?: Date;
};
export type CardApplyResult =
	| { ok: true; id: string }
	| { ok: false; reason: 'not_found' | 'blocked' | 'bad_state' }
	| { ok: false; reason: 'conditions'; missing: CardMissing[] };

const refuse = (reason: 'not_found' | 'blocked' | 'bad_state') => ({ ok: false, reason }) as const;

/** One row per member (`volunteer_cards_user_id_unique`): a parallel first request. */
const isDuplicate = (e: unknown) =>
	[e, (e as { cause?: unknown })?.cause].some((x) => (x as { code?: string })?.code === '23505');

async function apply(db: LimitDb, userId: string, now: Date) {
	return db.transaction(async (tx) => {
		const member = await lockCardMember(tx, userId);
		if (!member) return refuse('not_found');
		if (member.status !== 'active') return refuse('blocked');
		const [existing] = await tx
			.select({ id: volunteerCards.id, status: volunteerCards.status })
			.from(volunteerCards)
			.where(eq(volunteerCards.userId, userId))
			.for('update');
		if (existing && existing.status !== 'rejected' && existing.status !== 'revoked') {
			return refuse('bad_state');
		}
		const missing = missingForCard(await cardFacts(tx, userId, member, now), now);
		if (missing.length > 0) return { ok: false, reason: 'conditions', missing } as const;
		if (existing) {
			await tx
				.update(volunteerCards)
				.set({
					status: 'pending',
					appliedAt: now,
					reviewedBy: null,
					reviewedAt: null,
					reviewNote: null
				})
				.where(eq(volunteerCards.id, existing.id));
			return { ok: true, id: existing.id, member } as const;
		}
		const [row] = await tx
			.insert(volunteerCards)
			.values({ userId, appliedAt: now })
			.returning({ id: volunteerCards.id });
		return { ok: true, id: row.id, member } as const;
	});
}

export async function applyForCard(
	db: LimitDb,
	userId: string,
	deps: CardDeps
): Promise<CardApplyResult> {
	if (!isUuid(userId)) return refuse('not_found');
	const outcome = await apply(db, userId, deps.now ?? new Date()).catch((e) => {
		if (isDuplicate(e)) return refuse('bad_state');
		throw e;
	});
	if (!outcome.ok) return outcome;
	const to = await federationEmail(db);
	if (!to) console.warn(`volunteer card ${outcome.id}: no federation email, letter not sent`);
	else {
		const letter = cardRequestLetter(to, outcome.member, outcome.id, deps.siteUrl);
		await deps.send(letter).catch((e) => console.warn(`volunteer card ${outcome.id}: letter`, e));
	}
	return { ok: true, id: outcome.id };
}

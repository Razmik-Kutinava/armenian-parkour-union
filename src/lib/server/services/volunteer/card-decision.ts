import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { writeAudit } from '../audit';
import { newPublicToken } from '../certificates/number';
import { isUuid, type Actor } from '../users/target';
import type { CardDeps } from './card-apply';
import { cardFacts, lockCardMember, nextCardNumber } from './card-facts';
import { cardDecisionLetter, type CardDecisionMail } from './card-mail';
import { missingForCard, type CardMissing } from './card-rules';

/* docs/03 section 19.1 pp. 2–5, 19.9; docs/05 section 28 "Cards"; decisions — docs/todo.md 10.3
 * (2, 6). Issue and reject only a pending card, revoke only an active one; issue checks the
 * conditions again. Row lock, audit in the same transaction, the letter after the commit. */

export type CardDecisionInput =
	{ action: 'issue' } | { action: 'reject' | 'revoke'; reason: string };
export type CardDecisionResult =
	| { ok: true }
	| { ok: false; reason: 'not_allowed' | 'invalid' | 'not_found' | 'bad_state' }
	| { ok: false; reason: 'conditions'; missing: CardMissing[] };

export const CARD_REASON_MAX = 1000;
const STATUS = { issue: 'active', reject: 'rejected', revoke: 'revoked' } as const;
const refuse = (reason: 'not_allowed' | 'invalid' | 'not_found' | 'bad_state') =>
	({ ok: false, reason }) as const;

async function decide(
	db: LimitDb,
	actor: Actor,
	id: string,
	input: CardDecisionInput,
	note: string | null,
	deps: CardDeps,
	now: Date
) {
	return db.transaction(async (tx) => {
		const byId = eq(volunteerCards.id, id);
		const [ref] = await tx
			.select({ userId: volunteerCards.userId })
			.from(volunteerCards)
			.where(byId);
		if (!ref) return refuse('not_found');
		/* The member first, then the card — the order an application takes. */
		const member = await lockCardMember(tx, ref.userId);
		if (!member) return refuse('not_found');
		const [row] = await tx.select().from(volunteerCards).where(byId).for('update');
		const from = input.action === 'revoke' ? 'active' : 'pending';
		if (row.status !== from) return refuse('bad_state');
		const facts = await cardFacts(tx, row.userId, member, now);
		const status = STATUS[input.action];
		let issue = {};
		if (input.action === 'issue') {
			const missing = missingForCard(facts, now);
			if (missing.length > 0) return { ok: false, reason: 'conditions', missing } as const;
			issue = {
				number: row.number ?? (await nextCardNumber(tx, now)),
				publicToken: newPublicToken(),
				issuedAt: now
			};
		}
		const [saved] = await tx
			.update(volunteerCards)
			.set({ status, reviewedBy: actor.id, reviewedAt: now, reviewNote: note, ...issue })
			.where(byId)
			.returning({ number: volunteerCards.number });
		await writeAudit(tx, {
			actorId: actor.id,
			action: `volunteer_card.${input.action}`,
			entityType: 'volunteer_card',
			entityId: id,
			before: { status: row.status },
			after: {
				status,
				userId: row.userId,
				number: saved.number,
				...(note ? { reviewNote: note } : {})
			},
			ip: deps.ip
		});
		const decision: CardDecisionMail =
			input.action === 'issue'
				? { status: 'active', number: saved.number ?? '', validUntil: facts.paidUntil }
				: { status: STATUS[input.action], reason: note ?? '' };
		return { ok: true, letter: cardDecisionLetter(member, decision, deps.siteUrl) } as const;
	});
}

export async function decideCard(
	db: LimitDb,
	actor: Actor,
	id: string,
	input: CardDecisionInput,
	deps: CardDeps
): Promise<CardDecisionResult> {
	if (!roleCan(actor.role, 'volunteer.manage')) return refuse('not_allowed');
	const note = input.action === 'issue' ? null : input.reason.trim();
	if (note !== null && (!note || note.length > CARD_REASON_MAX)) return refuse('invalid');
	if (!isUuid(id)) return refuse('not_found');
	const outcome = await decide(db, actor, id, input, note, deps, deps.now ?? new Date());
	if (!outcome.ok) return outcome;
	await deps.send(outcome.letter).catch((e) => console.warn(`volunteer card ${id}: letter`, e));
	return { ok: true };
}

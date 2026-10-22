import { eq } from 'drizzle-orm';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { users } from '../../db/schema/users';
import type { Mail } from '../../mail/resend';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { decisionLetter, type Decision } from './mail';

/* docs/05 section 10: only a pending consent is decided, under its row lock; the letter waits for
 * the commit and its failure does not undo the decision (docs/03 section 14). */

export type ReviewDeps = {
	send: (mail: Mail) => Promise<void>;
	siteUrl: string | undefined;
	ip: string | null;
};
export type ReviewResult = 'ok' | 'not_found' | 'not_allowed' | 'wrong_status';

async function decide(
	db: LimitDb,
	actor: Actor,
	id: string,
	decision: Decision,
	deps: ReviewDeps
): Promise<ReviewResult> {
	if (!roleCan(actor.role, 'consents.review')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	const outcome = await db.transaction(async (tx) => {
		const [row] = await tx
			.select({
				consent: consents,
				user: {
					email: users.email,
					locale: users.locale,
					firstName: users.firstName,
					name: users.name,
					deletedAt: users.deletedAt
				}
			})
			.from(consents)
			.innerJoin(users, eq(users.id, consents.userId))
			.where(eq(consents.id, id))
			.for('update', { of: consents });
		if (!row || row.user.deletedAt) return 'not_found' as const;
		if (row.consent.status !== 'pending') return 'wrong_status' as const;
		const change =
			decision.status === 'approved'
				? { status: 'approved' as const, validUntil: decision.validUntil, reviewNote: null }
				: { status: 'rejected' as const, reviewNote: decision.note };
		await tx
			.update(consents)
			.set({ ...change, reviewedBy: actor.id })
			.where(eq(consents.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: decision.status === 'approved' ? 'consent.approve' : 'consent.reject',
			entityType: 'user',
			entityId: row.consent.userId,
			before: { consentId: id, status: 'pending' },
			after: { consentId: id, kind: row.consent.kind, ...change },
			ip: deps.ip
		});
		return decisionLetter(row.user, row.consent.kind, decision, deps.siteUrl);
	});
	if (typeof outcome === 'string') return outcome;
	await deps.send(outcome).catch((e) => console.warn(`consent ${id}: letter not sent`, e));
	return 'ok';
}

export const approveConsent = (
	db: LimitDb,
	actor: Actor,
	id: string,
	input: { validUntil: Date | null },
	deps: ReviewDeps
) => decide(db, actor, id, { status: 'approved', validUntil: input.validUntil }, deps);

export const rejectConsent = (
	db: LimitDb,
	actor: Actor,
	id: string,
	input: { note: string },
	deps: ReviewDeps
) => decide(db, actor, id, { status: 'rejected', note: input.note }, deps);

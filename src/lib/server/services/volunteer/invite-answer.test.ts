import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships } from '../../db/schema/payments';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { answerInvite } from './invite-answer';
import { createRequest, publishRequest, type RequestValues } from './requests-admin';
import { cardDeps as deps, daysFromNow, IP, mailbox, staff, volunteer } from './test-support';

/* docs/03 section 19.5 p. 3; docs/04 § 7: accept while places left and card valid; change mind
 * until respond_by; last seat — one winner. */

const values = (extra: Partial<RequestValues> = {}): RequestValues => ({
	title: { en: `Shift ${crypto.randomUUID().slice(0, 8)}` },
	description: null,
	eventId: null,
	startsAt: daysFromNow(5),
	endsAt: daysFromNow(5.2),
	location: null,
	places: 1,
	respondBy: daysFromNow(2),
	...extra
});

async function openInvite(tx: LimitDb, places = 1) {
	const admin = await staff(tx);
	const users = [await volunteer(tx), await volunteer(tx)];
	for (const user of users) {
		const applied = await applyForCard(tx, user.id, deps(mailbox().send));
		if (!applied.ok) throw new Error(applied.reason);
		await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	}
	const created = await createRequest(tx, admin, values({ places }), IP);
	if (typeof created === 'string') throw new Error(created);
	await publishRequest(tx, admin, created.id, deps(mailbox().send));
	const invites = await tx
		.select()
		.from(volunteerInvitations)
		.where(eq(volunteerInvitations.requestId, created.id));
	const byUser = Object.fromEntries(invites.map((i) => [i.userId, i.id]));
	return { admin, users, requestId: created.id, byUser };
}

describe.skipIf(!testDbUrl)('volunteer invitation answers', { timeout: 60_000 }, () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('accept then decline frees the seat for another', async () => {
		await inRollback(async (tx) => {
			const { users, byUser } = await openInvite(tx, 1);
			expect(await answerInvite(tx, users[0].id, byUser[users[0].id], 'accepted')).toEqual({
				ok: true
			});
			expect(await answerInvite(tx, users[1].id, byUser[users[1].id], 'accepted')).toEqual({
				ok: false,
				reason: 'full'
			});
			expect(await answerInvite(tx, users[0].id, byUser[users[0].id], 'declined')).toEqual({
				ok: true
			});
			expect(await answerInvite(tx, users[1].id, byUser[users[1].id], 'accepted')).toEqual({
				ok: true
			});
		});
	});

	it('full: accept hidden — decline still works; after respond_by — closed', async () => {
		await inRollback(async (tx) => {
			const { users, byUser, requestId } = await openInvite(tx, 1);
			await answerInvite(tx, users[0].id, byUser[users[0].id], 'accepted');
			expect(await answerInvite(tx, users[1].id, byUser[users[1].id], 'declined')).toEqual({
				ok: true
			});
			await tx
				.update(volunteerRequests)
				.set({ respondBy: daysFromNow(-0.1) })
				.where(eq(volunteerRequests.id, requestId));
			expect(await answerInvite(tx, users[1].id, byUser[users[1].id], 'accepted')).toEqual({
				ok: false,
				reason: 'respond_by'
			});
		});
	});

	it('invalid card: cannot answer; previous answer stays', async () => {
		await inRollback(async (tx) => {
			const { users, byUser } = await openInvite(tx, 2);
			await answerInvite(tx, users[0].id, byUser[users[0].id], 'accepted');
			await tx.delete(memberships).where(eq(memberships.userId, users[0].id));
			expect(await answerInvite(tx, users[0].id, byUser[users[0].id], 'declined')).toEqual({
				ok: false,
				reason: 'card'
			});
			const [row] = await tx
				.select()
				.from(volunteerInvitations)
				.where(eq(volunteerInvitations.id, byUser[users[0].id]));
			expect(row.status).toBe('accepted');
		});
	});

	it('refusals: not own invite, unknown id', async () => {
		await inRollback(async (tx) => {
			const { users, byUser } = await openInvite(tx, 2);
			expect(await answerInvite(tx, users[1].id, byUser[users[0].id], 'accepted')).toEqual({
				ok: false,
				reason: 'not_found'
			});
			expect(await answerInvite(tx, users[0].id, crypto.randomUUID(), 'declined')).toEqual({
				ok: false,
				reason: 'not_found'
			});
			expect(
				await tx
					.select()
					.from(volunteerInvitations)
					.where(
						and(
							eq(volunteerInvitations.id, byUser[users[0].id]),
							eq(volunteerInvitations.status, 'invited')
						)
					)
			).toHaveLength(1);
		});
	});
});

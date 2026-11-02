import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { testDbUrl } from '../../db/test-db';
import { volunteerInvitations } from '../../db/schema/volunteer-requests';
import { answerInvite } from './invite-answer';
import { volunteerRaceDb } from './race-support';

/* docs/03 section 19.5 p. 3, roadmap 10.11: two "I'll go" clicks race for the last seat — one
 * accepted, the other full. Commits (race-support.ts). */

describe.skipIf(!testDbUrl)('volunteer: simultaneous accept for the last seat', () => {
	const db = volunteerRaceDb();
	afterAll(db.cleanup);

	it('last seat, two members at once: one accepted, one full', { timeout: 60_000 }, async () => {
		const { users, byUser, requestId } = await db.openInvite(1);
		const [u0, u1] = users;
		const [first, second] = await db.race(
			(tx) => answerInvite(tx, u0.id, byUser[u0.id], 'accepted'),
			(tx) => answerInvite(tx, u1.id, byUser[u1.id], 'accepted')
		);
		expect(first).toEqual({ ok: true });
		expect(second).toEqual({ ok: false, reason: 'full' });
		const accepted = await db.main
			.select({ id: volunteerInvitations.id })
			.from(volunteerInvitations)
			.where(
				and(
					eq(volunteerInvitations.requestId, requestId),
					eq(volunteerInvitations.status, 'accepted')
				)
			);
		expect(accepted).toHaveLength(1);
	});
});

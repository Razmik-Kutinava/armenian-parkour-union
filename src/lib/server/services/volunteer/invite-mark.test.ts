import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import { testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { balanceOf, setRules } from '../points/test-support';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { answerInvite } from './invite-answer';
import { closeRequestInvites } from './invite-close';
import { finishRequest, markInvite, marksOpen } from './invite-mark';
import { createRequest, publishRequest, type RequestValues } from './requests-admin';
import { writeVolunteerSettings } from './settings';
import { cardDeps as deps, daysFromNow, IP, mailbox, staff, volunteer } from './test-support';

/* docs/03 section 19.5 p. 5, 19.6–19.7 p. 1, 19.9: mark attended / no_show / excused;
 * attended awards once and resets streak; no_show +2; finish open → finished. */

const values = (extra: Partial<RequestValues> = {}): RequestValues => ({
	title: { en: `Mark ${crypto.randomUUID().slice(0, 8)}` },
	description: null,
	eventId: null,
	startsAt: daysFromNow(0.01),
	endsAt: daysFromNow(0.2),
	location: null,
	places: 2,
	respondBy: daysFromNow(-0.5),
	...extra
});

async function setup(tx: LimitDb, places = 2) {
	await writeVolunteerSettings(tx, { declineThreshold: 99, cashierInviteHours: 72 });
	await setRules(tx, { volunteer_participation: { points: 20 } });
	const admin = await staff(tx);
	const users = [await volunteer(tx), await volunteer(tx)];
	const cards: string[] = [];
	for (const user of users) {
		const applied = await applyForCard(tx, user.id, deps(mailbox().send));
		if (!applied.ok) throw new Error(applied.reason);
		await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
		cards.push(applied.id);
	}
	const created = await createRequest(
		tx,
		admin,
		values({
			places,
			startsAt: daysFromNow(-0.1),
			endsAt: daysFromNow(0.1),
			respondBy: daysFromNow(-0.2)
		}),
		IP
	);
	if (typeof created === 'string') throw new Error(created);
	/* publish needs respond_by in the future — set past after publish. */
	await tx
		.update(volunteerRequests)
		.set({
			respondBy: daysFromNow(1),
			startsAt: daysFromNow(2),
			endsAt: daysFromNow(2.1)
		})
		.where(eq(volunteerRequests.id, created.id));
	await publishRequest(tx, admin, created.id, deps(mailbox().send));
	const invites = await tx
		.select()
		.from(volunteerInvitations)
		.where(eq(volunteerInvitations.requestId, created.id));
	const byUser = Object.fromEntries(invites.map((i) => [i.userId, i.id]));
	await answerInvite(tx, users[0].id, byUser[users[0].id], 'accepted');
	await answerInvite(tx, users[1].id, byUser[users[1].id], 'accepted');
	await tx
		.update(volunteerRequests)
		.set({
			respondBy: daysFromNow(-0.2),
			startsAt: daysFromNow(-0.1),
			endsAt: daysFromNow(0.1)
		})
		.where(eq(volunteerRequests.id, created.id));
	await closeRequestInvites(tx, created.id, daysFromNow(0));
	return { admin, users, cards, requestId: created.id, byUser };
}

describe.skipIf(!testDbUrl)('volunteer invitation attendance', { timeout: 60_000 }, () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('marksOpen: from midnight of the request day in Yerevan', () => {
		const starts = new Date('2026-11-02T10:00:00+04:00');
		expect(marksOpen(starts, new Date('2026-11-02T00:00:00+04:00'))).toBe(true);
		expect(marksOpen(starts, new Date('2026-11-01T23:59:00+04:00'))).toBe(false);
	});

	it('attended: points once, streak 0, audited; no_show then attended keeps points', async () => {
		await inRollback(async (tx) => {
			const { admin, users, byUser, requestId } = await setup(tx);
			const id = byUser[users[0].id];
			expect(await markInvite(tx, admin, id, 'attended', IP)).toBe('ok');
			expect(await balanceOf(tx, users[0].id)).toBe(20);
			expect(await markInvite(tx, admin, id, 'attended', IP)).toBe('ok');
			expect(await balanceOf(tx, users[0].id)).toBe(20);
			expect(await markInvite(tx, admin, id, 'no_show', IP)).toBe('ok');
			expect(await balanceOf(tx, users[0].id)).toBe(20);
			expect(await markInvite(tx, admin, id, 'attended', IP)).toBe('ok');
			expect(await balanceOf(tx, users[0].id)).toBe(20);
			const [row] = await tx
				.select()
				.from(volunteerInvitations)
				.where(eq(volunteerInvitations.id, id));
			expect(row).toMatchObject({ status: 'attended', markedBy: admin.id });
			expect(row.markedAt).toBeInstanceOf(Date);
			expect(row.countedAt).toBeInstanceOf(Date);
			expect(await auditFor(tx, 'volunteer_invitation', id)).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						action: 'volunteer_invitation.mark',
						actorId: admin.id,
						ip: IP
					})
				])
			);
			expect(await finishRequest(tx, admin, requestId, IP)).toBe('ok');
			const [req] = await tx
				.select()
				.from(volunteerRequests)
				.where(eq(volunteerRequests.id, requestId));
			expect(req.status).toBe('finished');
		});
	});

	it('no_show +2 streak; excused no change; moderator refused', async () => {
		await inRollback(async (tx) => {
			const { admin, users, cards, byUser } = await setup(tx);
			await tx
				.update(volunteerCards)
				.set({ declineStreak: 1 })
				.where(eq(volunteerCards.id, cards[0]));
			expect(await markInvite(tx, admin, byUser[users[0].id], 'no_show', IP)).toBe('ok');
			const [afterNoShow] = await tx
				.select()
				.from(volunteerCards)
				.where(eq(volunteerCards.id, cards[0]));
			expect(afterNoShow.declineStreak).toBe(3);
			expect(await markInvite(tx, admin, byUser[users[1].id], 'excused', IP)).toBe('ok');
			const [afterExcuse] = await tx
				.select()
				.from(volunteerCards)
				.where(eq(volunteerCards.id, cards[1]));
			expect(afterExcuse.declineStreak).toBe(0);
			const mod = await staff(tx, 'moderator');
			expect(await markInvite(tx, mod, byUser[users[1].id], 'attended', IP)).toBe('not_allowed');
			expect(await balanceOf(tx, users[0].id)).toBe(0);
		});
	});

	it('too early, not accepted, finished — refuse', async () => {
		await inRollback(async (tx) => {
			const { admin, users, byUser, requestId } = await setup(tx);
			await tx
				.update(volunteerRequests)
				.set({ startsAt: daysFromNow(2), endsAt: daysFromNow(2.1) })
				.where(eq(volunteerRequests.id, requestId));
			expect(await markInvite(tx, admin, byUser[users[0].id], 'attended', IP)).toBe('too_early');
			await tx
				.update(volunteerRequests)
				.set({ startsAt: daysFromNow(-0.1), endsAt: daysFromNow(0.1) })
				.where(eq(volunteerRequests.id, requestId));
			const guest = await volunteer(tx);
			const applied = await applyForCard(tx, guest.id, deps(mailbox().send));
			if (!applied.ok) throw new Error(applied.reason);
			await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
			const [extra] = await tx
				.insert(volunteerInvitations)
				.values({
					requestId,
					userId: guest.id,
					status: 'declined',
					answeredAt: new Date(),
					countedAt: new Date()
				})
				.returning({ id: volunteerInvitations.id });
			expect(await markInvite(tx, admin, extra.id, 'attended', IP)).toBe('wrong_status');
			await finishRequest(tx, admin, requestId, IP);
			expect(await markInvite(tx, admin, byUser[users[0].id], 'attended', IP)).toBe(
				'request_closed'
			);
		});
	});
});

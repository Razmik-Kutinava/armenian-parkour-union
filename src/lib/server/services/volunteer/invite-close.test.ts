import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { volunteerCards } from '../../db/schema/volunteer-cards';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { answerInvite } from './invite-answer';
import { closeDueRequests, closeRequestInvites } from './invite-close';
import { createRequest, publishRequest, type RequestValues } from './requests-admin';
import { writeVolunteerSettings } from './settings';
import { cardDeps as deps, daysFromNow, IP, mailbox, staff, volunteer } from './test-support';

/* docs/03 section 19.5 p. 4, 19.6: after respond_by — closed_at once; silence → expired (+1);
 * full seats → invited excused (no streak); declined counted once. */

const values = (extra: Partial<RequestValues> = {}): RequestValues => ({
	title: { en: `Close ${crypto.randomUUID().slice(0, 8)}` },
	description: null,
	eventId: null,
	startsAt: daysFromNow(5),
	endsAt: daysFromNow(5.2),
	location: null,
	places: 1,
	respondBy: daysFromNow(2),
	...extra
});

async function issued(tx: LimitDb) {
	const admin = await staff(tx);
	const user = await volunteer(tx);
	const applied = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!applied.ok) throw new Error(applied.reason);
	await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	return { admin, user, cardId: applied.id };
}

async function openRequest(tx: LimitDb, places = 1) {
	const a = await issued(tx);
	const b = await issued(tx);
	const created = await createRequest(tx, a.admin, values({ places }), IP);
	if (typeof created === 'string') throw new Error(created);
	await publishRequest(tx, a.admin, created.id, deps(mailbox().send));
	const invites = await tx
		.select()
		.from(volunteerInvitations)
		.where(eq(volunteerInvitations.requestId, created.id));
	const byUser = Object.fromEntries(invites.map((i) => [i.userId, i.id]));
	return { admin: a.admin, a, b, requestId: created.id, byUser };
}

async function expireRespondBy(tx: LimitDb, requestId: string) {
	await tx
		.update(volunteerRequests)
		.set({ respondBy: daysFromNow(-0.1) })
		.where(eq(volunteerRequests.id, requestId));
}

describe.skipIf(!testDbUrl)('volunteer request close after respond_by', { timeout: 60_000 }, () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('silence → expired +1 streak; full seats → invited excused without streak', async () => {
		await inRollback(async (tx) => {
			await writeVolunteerSettings(tx, { declineThreshold: 99, cashierInviteHours: 72 });
			const { a, b, requestId, byUser } = await openRequest(tx, 1);
			await answerInvite(tx, a.user.id, byUser[a.user.id], 'accepted');
			await expireRespondBy(tx, requestId);
			expect(await closeRequestInvites(tx, requestId, daysFromNow(0))).toMatchObject({
				ok: true
			});
			const [req] = await tx
				.select()
				.from(volunteerRequests)
				.where(eq(volunteerRequests.id, requestId));
			expect(req.closedAt).toBeInstanceOf(Date);
			const [accepted] = await tx
				.select()
				.from(volunteerInvitations)
				.where(eq(volunteerInvitations.id, byUser[a.user.id]));
			const [silent] = await tx
				.select()
				.from(volunteerInvitations)
				.where(eq(volunteerInvitations.id, byUser[b.user.id]));
			expect(accepted).toMatchObject({ status: 'accepted', countedAt: null });
			expect(silent.status).toBe('excused');
			expect(silent.countedAt).toBeInstanceOf(Date);
			const [cardB] = await tx.select().from(volunteerCards).where(eq(volunteerCards.id, b.cardId));
			expect(cardB.declineStreak).toBe(0);
			expect(await closeRequestInvites(tx, requestId, daysFromNow(0))).toMatchObject({
				ok: true,
				already: true
			});
		});
	});

	it('declined and expired each +1 once; threshold flags and writes once', async () => {
		await inRollback(async (tx) => {
			await writeVolunteerSettings(tx, { declineThreshold: 2, cashierInviteHours: 72 });
			const first = await openRequest(tx, 2);
			await answerInvite(tx, first.a.user.id, first.byUser[first.a.user.id], 'declined');
			await expireRespondBy(tx, first.requestId);
			const mail = mailbox();
			expect(
				await closeRequestInvites(tx, first.requestId, daysFromNow(0), {
					send: mail.send,
					siteUrl: 'https://parkour.test'
				})
			).toMatchObject({ ok: true });
			const [cardA] = await tx
				.select()
				.from(volunteerCards)
				.where(eq(volunteerCards.id, first.a.cardId));
			const [cardB] = await tx
				.select()
				.from(volunteerCards)
				.where(eq(volunteerCards.id, first.b.cardId));
			expect(cardA.declineStreak).toBe(1);
			expect(cardB.declineStreak).toBe(1);
			expect(cardA.flaggedAt).toBeNull();
			expect(mail.sent).toHaveLength(0);

			const second = await openRequest(tx, 2);
			await tx
				.update(volunteerCards)
				.set({ declineStreak: 1 })
				.where(eq(volunteerCards.id, second.a.cardId));
			await answerInvite(tx, second.a.user.id, second.byUser[second.a.user.id], 'declined');
			await expireRespondBy(tx, second.requestId);
			expect(
				await closeRequestInvites(tx, second.requestId, daysFromNow(0), {
					send: mail.send,
					siteUrl: 'https://parkour.test'
				})
			).toMatchObject({ ok: true });
			const [flagged] = await tx
				.select()
				.from(volunteerCards)
				.where(eq(volunteerCards.id, second.a.cardId));
			expect(flagged.declineStreak).toBe(2);
			expect(flagged.flaggedAt).toBeInstanceOf(Date);
			expect(mail.sent.some((m) => m.to === second.a.user.email)).toBe(true);
		});
	});

	it('closeDueRequests closes every open request past respond_by', async () => {
		await inRollback(async (tx) => {
			const one = await openRequest(tx, 2);
			const two = await openRequest(tx, 2);
			await expireRespondBy(tx, one.requestId);
			await expireRespondBy(tx, two.requestId);
			const summary = await closeDueRequests(tx, daysFromNow(0));
			expect(summary.closed).toBeGreaterThanOrEqual(2);
			for (const id of [one.requestId, two.requestId]) {
				const [row] = await tx.select().from(volunteerRequests).where(eq(volunteerRequests.id, id));
				expect(row.closedAt).toBeInstanceOf(Date);
			}
		});
	});
});

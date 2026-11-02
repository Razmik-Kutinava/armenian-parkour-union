import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { testDb, testDbUrl } from '../../db/test-db';
import { volunteerInvitations, volunteerRequests } from '../../db/schema/volunteer-requests';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import {
	cancelRequest,
	createRequest,
	inviteMore,
	publishRequest,
	updateRequest,
	type RequestValues
} from './requests-admin';
import { auditFor } from '../memberships/test-support';
import { cardDeps as deps, daysFromNow, IP, mailbox, staff, volunteer } from './test-support';

/* docs/03 section 19.5 pp. 1–2, 6–7, 19.9: draft → send to valid cards, resend newcomers,
 * cancel excuses all; places/respond_by after open. */

const values = (extra: Partial<RequestValues> = {}): RequestValues => ({
	title: { en: `Help ${crypto.randomUUID().slice(0, 8)}` },
	description: { en: '<p>Bring water</p>' },
	eventId: null,
	startsAt: daysFromNow(7),
	endsAt: daysFromNow(7.1),
	location: 'Cascade',
	places: 2,
	respondBy: daysFromNow(3),
	...extra
});

async function issued(tx: LimitDb, name?: string) {
	const admin = await staff(tx);
	const user = await volunteer(tx, name ? { name } : {});
	const applied = await applyForCard(tx, user.id, deps(mailbox().send));
	if (!applied.ok) throw new Error(applied.reason);
	await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
	return { admin, user, cardId: applied.id };
}

describe.skipIf(!testDbUrl)('volunteer requests in the admin panel', { timeout: 60_000 }, () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('create draft, publish: one invite per valid card, letter, audited', async () => {
		await inRollback(async (tx) => {
			const a = await issued(tx, 'Vol A');
			const b = await issued(tx, 'Vol B');
			await volunteer(tx); // no card — not invited
			const pending = await volunteer(tx, { name: 'Pending' });
			const applied = await applyForCard(tx, pending.id, deps(mailbox().send));
			if (!applied.ok) throw new Error(applied.reason);
			const mail = mailbox();
			const created = await createRequest(tx, a.admin, values(), IP);
			if (typeof created === 'string') throw new Error(created);
			const published = await publishRequest(tx, a.admin, created.id, deps(mail.send));
			expect(published).toMatchObject({ ok: true });
			if (!published.ok) throw new Error('publish failed');
			expect(published.invited).toBeGreaterThanOrEqual(2);
			const [row] = await tx
				.select()
				.from(volunteerRequests)
				.where(eq(volunteerRequests.id, created.id));
			expect(row).toMatchObject({ status: 'open', createdBy: a.admin.id });
			expect(row.publishedAt).toBeInstanceOf(Date);
			const invites = await tx
				.select()
				.from(volunteerInvitations)
				.where(eq(volunteerInvitations.requestId, created.id));
			const invitedUsers = new Set(invites.map((i) => i.userId));
			expect(invites.every((i) => i.status === 'invited')).toBe(true);
			expect(invitedUsers.has(a.user.id)).toBe(true);
			expect(invitedUsers.has(b.user.id)).toBe(true);
			expect(invitedUsers.has(pending.id)).toBe(false);
			expect(mail.sent).toHaveLength(published.invited);
			expect(mail.sent.map((m) => m.to)).toEqual(
				expect.arrayContaining([a.user.email, b.user.email])
			);
			expect(await auditFor(tx, 'volunteer_request', created.id)).toMatchObject([
				{ action: 'volunteer_request.create', actorId: a.admin.id, ip: IP },
				{ action: 'volunteer_request.publish', after: { invited: published.invited } }
			]);
		});
	});

	it('invite more: only new valid cards before respond_by; past deadline — refuse', async () => {
		await inRollback(async (tx) => {
			const first = await issued(tx);
			const mail = mailbox();
			const created = await createRequest(tx, first.admin, values({ places: 5 }), IP);
			if (typeof created === 'string') throw new Error(created);
			await publishRequest(tx, first.admin, created.id, deps(mail.send));
			const late = await issued(tx);
			expect(await inviteMore(tx, first.admin, created.id, deps(mail.send))).toMatchObject({
				ok: true,
				invited: 1
			});
			expect(
				await tx
					.select()
					.from(volunteerInvitations)
					.where(
						and(
							eq(volunteerInvitations.requestId, created.id),
							eq(volunteerInvitations.userId, late.user.id)
						)
					)
			).toHaveLength(1);
			expect(await inviteMore(tx, first.admin, created.id, deps(mailbox().send))).toMatchObject({
				ok: true,
				invited: 0
			});
			await tx
				.update(volunteerRequests)
				.set({ respondBy: daysFromNow(-1) })
				.where(eq(volunteerRequests.id, created.id));
			expect(await inviteMore(tx, first.admin, created.id, deps(mailbox().send))).toEqual({
				ok: false,
				reason: 'respond_by'
			});
			expect(await auditFor(tx, 'volunteer_request', created.id)).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						action: 'volunteer_request.invite_more',
						after: { invited: 1 }
					})
				])
			);
		});
	});

	it('after open: places not below accepted; respond_by only while open and before start', async () => {
		await inRollback(async (tx) => {
			const { admin, user } = await issued(tx);
			const created = await createRequest(tx, admin, values({ places: 2 }), IP);
			if (typeof created === 'string') throw new Error(created);
			await publishRequest(tx, admin, created.id, deps(mailbox().send));
			await tx
				.update(volunteerInvitations)
				.set({ status: 'accepted', answeredAt: new Date() })
				.where(
					and(
						eq(volunteerInvitations.requestId, created.id),
						eq(volunteerInvitations.userId, user.id)
					)
				);
			expect(await updateRequest(tx, admin, created.id, values({ places: 1 }), IP)).toMatchObject({
				ok: true
			});
			expect(await updateRequest(tx, admin, created.id, values({ places: 0 }), IP)).toMatchObject({
				ok: false,
				reason: 'places'
			});
			expect(
				await updateRequest(
					tx,
					admin,
					created.id,
					values({ respondBy: daysFromNow(8), startsAt: daysFromNow(7) }),
					IP
				)
			).toMatchObject({ ok: false, reason: 'respond_by' });
		});
	});

	it('cancel: invitations excused, letter to accepted only, audited', async () => {
		await inRollback(async (tx) => {
			const a = await issued(tx);
			const b = await issued(tx);
			const created = await createRequest(tx, a.admin, values({ places: 2 }), IP);
			if (typeof created === 'string') throw new Error(created);
			await publishRequest(tx, a.admin, created.id, deps(mailbox().send));
			await tx
				.update(volunteerInvitations)
				.set({ status: 'accepted', answeredAt: new Date() })
				.where(
					and(
						eq(volunteerInvitations.requestId, created.id),
						eq(volunteerInvitations.userId, a.user.id)
					)
				);
			await tx
				.update(volunteerInvitations)
				.set({ status: 'declined', answeredAt: new Date() })
				.where(
					and(
						eq(volunteerInvitations.requestId, created.id),
						eq(volunteerInvitations.userId, b.user.id)
					)
				);
			const mail = mailbox();
			expect(await cancelRequest(tx, a.admin, created.id, deps(mail.send))).toEqual({
				ok: true
			});
			const invites = await tx
				.select()
				.from(volunteerInvitations)
				.where(eq(volunteerInvitations.requestId, created.id));
			expect(invites.every((i) => i.status === 'excused')).toBe(true);
			expect(
				(await tx.select().from(volunteerRequests).where(eq(volunteerRequests.id, created.id)))[0]
					.status
			).toBe('cancelled');
			expect(mail.sent).toHaveLength(1);
			expect(mail.sent[0].to).toBe(a.user.email);
			expect(await auditFor(tx, 'volunteer_request', created.id)).toEqual(
				expect.arrayContaining([expect.objectContaining({ action: 'volunteer_request.cancel' })])
			);
		});
	});

	it('refusals: not admin, unknown id', async () => {
		await inRollback(async (tx) => {
			for (const role of ['moderator', 'editor', 'member'] as const) {
				const actor = await staff(tx, role);
				expect(await createRequest(tx, actor, values(), null)).toBe('not_allowed');
			}
			const admin = await staff(tx);
			expect(await publishRequest(tx, admin, crypto.randomUUID(), deps(mailbox().send))).toEqual({
				ok: false,
				reason: 'not_found'
			});
		});
	});
});

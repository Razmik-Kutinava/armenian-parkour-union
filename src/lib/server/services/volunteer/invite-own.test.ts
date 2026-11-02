import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { volunteerInvitations } from '../../db/schema/volunteer-requests';
import { testDb, testDbUrl } from '../../db/test-db';
import { applyForCard } from './card-apply';
import { decideCard } from './card-decision';
import { listOwnInvites } from './invite-own';
import { createRequest, publishRequest, type RequestValues } from './requests-admin';
import {
	cardDeps as deps,
	daysFromNow,
	IP,
	mailbox,
	staff,
	volunteer
} from './test-support';

/* docs/06 section 5.12 "Invitations": open — request, seats left, respond_by, buttons;
 * past — answer. Only the session owner's rows. */

const values = (extra: Partial<RequestValues> = {}): RequestValues => ({
	title: { en: `Call ${crypto.randomUUID().slice(0, 8)}` },
	description: null,
	eventId: null,
	startsAt: daysFromNow(4),
	endsAt: daysFromNow(4.1),
	location: 'Yerevan',
	places: 3,
	respondBy: daysFromNow(1),
	...extra
});

describe.skipIf(!testDbUrl)('own volunteer invitations in the cabinet', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('open vs past; seats left; stranger sees nothing', async () => {
		await inRollback(async (tx) => {
			const admin = await staff(tx);
			const me = await volunteer(tx, { name: 'Me' });
			const other = await volunteer(tx, { name: 'Other' });
			for (const user of [me, other]) {
				const applied = await applyForCard(tx, user.id, deps(mailbox().send));
				if (!applied.ok) throw new Error(applied.reason);
				await decideCard(tx, admin, applied.id, { action: 'issue' }, deps(mailbox().send));
			}
			const open = await createRequest(tx, admin, values({ places: 2 }), IP);
			if (typeof open === 'string') throw new Error(open);
			await publishRequest(tx, admin, open.id, deps(mailbox().send));
			const past = await createRequest(
				tx,
				admin,
				values({
					title: { en: `Past ${crypto.randomUUID().slice(0, 8)}` },
					startsAt: daysFromNow(-2),
					endsAt: daysFromNow(-1.9),
					respondBy: daysFromNow(-3)
				}),
				IP
			);
			if (typeof past === 'string') throw new Error(past);
			await publishRequest(tx, admin, past.id, deps(mailbox().send));
			await tx
				.update(volunteerInvitations)
				.set({ status: 'accepted', answeredAt: new Date() })
				.where(eq(volunteerInvitations.requestId, open.id));
			const mine = await listOwnInvites(tx, me.id);
			expect(mine.open).toHaveLength(1);
			expect(mine.open[0]).toMatchObject({
				requestId: open.id,
				status: 'accepted',
				placesLeft: 0,
				canAccept: false,
				canDecline: true
			});
			expect(mine.open[0].title).toMatchObject({ en: expect.any(String) });
			expect(mine.open[0].respondBy).toBeInstanceOf(Date);
			expect(mine.past.map((p) => p.requestId)).toContain(past.id);
			expect(mine.past.find((p) => p.requestId === past.id)?.status).toBe('invited');
			expect(await listOwnInvites(tx, crypto.randomUUID())).toEqual({ open: [], past: [] });
		});
	});
});

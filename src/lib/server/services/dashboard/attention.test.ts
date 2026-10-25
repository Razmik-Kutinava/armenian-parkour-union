import { afterAll, describe, expect, it } from 'vitest';
import type { UserRole } from '../../auth/session';
import type { LimitDb } from '../../auth/rate-limit';
import { consents } from '../../db/schema/consents';
import { payments } from '../../db/schema/payments';
import { eventRegistrations } from '../../db/schema/registrations';
import { shopOrders } from '../../db/schema/shop';
import { videos } from '../../db/schema/videos';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { insertEvent } from '../registrations/test-support';
import { attentionCounts } from './attention';

/* docs/05 section 3 "Needs action": each counter only for a role with the right to its section
 * (docs/04 section 5.1); counts are compared before and after inside a rolled-back transaction. */

const actor = (role: UserRole) => ({ id: crypto.randomUUID(), role });
const keys = async (tx: LimitDb, role: UserRole) =>
	(await attentionCounts(tx, actor(role))).map((i) => i.key);
const counts = async (tx: LimitDb) =>
	Object.fromEntries((await attentionCounts(tx, actor('admin'))).map((i) => [i.key, i.count]));

let n = 0;
/** One row per counter; `done` — already handled (reviewed, confirmed, checked, event cancelled). */
async function addAll(tx: LimitDb, userId: string, done: boolean) {
	n += 1;
	await tx.insert(videos).values({
		userId,
		url: `https://www.youtube.com/watch?v=${String(n).padStart(11, 'd')}`,
		platform: 'youtube',
		title: `Dash ${n}`,
		...(done ? { status: 'approved' as const, reviewedAt: new Date() } : {})
	});
	await tx
		.insert(consents)
		.values({ userId, kind: 'parental', status: done ? 'approved' : 'pending' });
	await tx.insert(shopOrders).values({
		number: `ORD-T-${crypto.randomUUID()}`,
		userId,
		status: done ? 'confirmed' : 'new',
		totalPoints: 10,
		recipientName: 'Test',
		phone: '+37400000000',
		city: 'Yerevan',
		address: 'Street 1'
	});
	await tx.insert(payments).values({
		userId,
		kind: 'donation',
		amountMinor: 1000,
		currency: 'AMD',
		provider: 'mock',
		needsReview: !done
	});
	const event = await insertEvent(tx, { status: done ? 'cancelled' : 'published', capacity: 1 });
	await tx.insert(eventRegistrations).values({ eventId: event.id, userId, status: 'waitlist' });
}

describe.skipIf(!testDbUrl)('dashboard: needs action', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('counters by role: editor none, moderator without payments, admin all', async () => {
		await inRollback(async (tx) => {
			expect(await keys(tx, 'editor')).toEqual([]);
			expect(await keys(tx, 'member')).toEqual([]);
			expect(await keys(tx, 'moderator')).toEqual(['videos', 'consents', 'orders', 'waitlist']);
			expect(await keys(tx, 'admin')).toEqual([
				'videos',
				'consents',
				'orders',
				'payments',
				'waitlist'
			]);
		});
	});

	it('links open the list with the same filter', async () => {
		await inRollback(async (tx) => {
			const items = await attentionCounts(tx, actor('admin'));
			expect(Object.fromEntries(items.map((i) => [i.key, i.href]))).toEqual({
				videos: '/admin/videos',
				consents: '/admin/consents?status=pending',
				orders: '/admin/orders?status=new',
				payments: '/admin/payments?review=1',
				waitlist: '/admin/registrations?period=upcoming'
			});
		});
	});

	it('pending, new, needs review and the waitlist of a live event are counted', async () => {
		await inRollback(async (tx) => {
			const before = await counts(tx);
			const user = await insertUser(tx);
			await addAll(tx, user.id, false);
			expect(await counts(tx)).toEqual({
				videos: before.videos + 1,
				consents: before.consents + 1,
				orders: before.orders + 1,
				payments: before.payments + 1,
				waitlist: before.waitlist + 1
			});
		});
	});

	it('reviewed, confirmed, checked and a cancelled event are not counted', async () => {
		await inRollback(async (tx) => {
			const before = await counts(tx);
			const user = await insertUser(tx);
			await addAll(tx, user.id, true);
			expect(await counts(tx)).toEqual(before);
		});
	});
});

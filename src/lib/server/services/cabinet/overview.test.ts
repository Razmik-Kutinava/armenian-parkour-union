import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { memberships } from '../../db/schema/payments';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { daysFromNow } from '../memberships/test-support';
import { getCabinetOverview } from './overview';

/* docs/06 section 5.1: greeting, membership, points and "what needs action" — own data only. */

async function period(
	tx: LimitDb,
	userId: string,
	status: 'active' | 'expired',
	from: number,
	to: number
) {
	await tx
		.insert(memberships)
		.values({ userId, status, startsAt: daysFromNow(from), endsAt: daysFromNow(to) });
}

describe.skipIf(!testDbUrl)('cabinet: overview', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a new account: name, no level, zero points, confirm email and join', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { firstName: 'Ani', name: 'Ani Hakobyan' });
			const o = await getCabinetOverview(tx, user.id);
			expect(o).toMatchObject({
				firstName: 'Ani',
				name: 'Ani Hakobyan',
				avatarKey: null,
				level: null,
				pointsBalance: 0,
				emailVerified: false,
				reminder: null,
				actions: ['verify_email', 'join']
			});
			expect(o?.membership.active).toBe(false);
		});
	});

	it('a member whose membership ends soon: level, balance, "ends soon"', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, {
				emailVerified: true,
				level: 'advanced',
				pointsBalance: 120
			});
			await period(tx, user.id, 'active', -350, 15);
			const o = await getCabinetOverview(tx, user.id);
			expect(o).toMatchObject({ level: 'advanced', pointsBalance: 120, emailVerified: true });
			expect(o?.membership.active).toBe(true);
			expect(o?.reminder?.kind).toBe('ends_soon');
			expect(o?.actions).toEqual(['membership_ends_soon']);
		});
	});

	it('an expired membership: "expired", not "join"', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { emailVerified: true, level: 'novice' });
			await period(tx, user.id, 'expired', -400, -35);
			const o = await getCabinetOverview(tx, user.id);
			expect(o?.reminder?.kind).toBe('expired');
			expect(o?.actions).toEqual(['membership_expired']);
		});
	});

	it('an active membership far from its end: nothing needs action', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { emailVerified: true, level: 'novice' });
			await period(tx, user.id, 'active', -10, 355);
			expect((await getCabinetOverview(tx, user.id))?.actions).toEqual([]);
		});
	});

	it('another member’s membership is not seen', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { emailVerified: true });
			const other = await insertUser(tx, { emailVerified: true });
			await period(tx, other.id, 'active', -10, 355);
			const o = await getCabinetOverview(tx, user.id);
			expect(o?.membership.active).toBe(false);
			expect(o?.actions).toEqual(['join']);
		});
	});

	it('a deleted, unknown or malformed id: null', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { deletedAt: new Date() });
			expect(await getCabinetOverview(tx, user.id)).toBeNull();
			expect(await getCabinetOverview(tx, crypto.randomUUID())).toBeNull();
			expect(await getCabinetOverview(tx, 'nope')).toBeNull();
		});
	});
});

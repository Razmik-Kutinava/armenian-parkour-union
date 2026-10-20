import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { awardPoints } from './award';
import { balanceOf, ledgerOf, ledgerSum, setRules } from './test-support';

/* docs/03 section 6.2: only the service awards; entry and balance in one transaction; the same
 * source is rewarded once (silent skip); an inactive or zero rule writes nothing; the size is fixed
 * at award time. */

describe.skipIf(!testDbUrl)('points: award by rule', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('writes the rule points with reason, source and rule, and raises the balance', async () => {
		await inRollback(async (tx) => {
			const [rule] = await setRules(tx, { certificate_trainer: { points: 150 } });
			const user = await insertUser(tx);
			const certificateId = crypto.randomUUID();
			const result = await awardPoints(tx, {
				rule: 'certificate_trainer',
				userId: user.id,
				sourceId: certificateId
			});
			expect(result).toMatchObject({ status: 'awarded', points: 150 });
			const entries = await ledgerOf(tx, user.id);
			expect(entries).toHaveLength(1);
			expect(entries[0]).toMatchObject({
				delta: 150,
				reason: 'certificate',
				ruleId: rule.id,
				sourceType: 'certificate',
				sourceId: certificateId,
				comment: null,
				reversalOfId: null,
				createdBy: null
			});
			expect(await balanceOf(tx, user.id)).toBe(150);
		});
	});

	it('the same source twice: skipped silently, one entry, the caller transaction goes on', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const user = await insertUser(tx);
			const award = {
				rule: 'video_approved' as const,
				userId: user.id,
				sourceId: crypto.randomUUID()
			};
			expect((await awardPoints(tx, award)).status).toBe('awarded');
			expect(await awardPoints(tx, award)).toEqual({ status: 'skipped', reason: 'duplicate' });
			await tx.execute(sql`select 1`);
			expect(await ledgerOf(tx, user.id)).toHaveLength(1);
			expect(await balanceOf(tx, user.id)).toBe(10);
		});
	});

	it('winner of an event: registration, participation and place add up (5 + 20 + 50)', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, {
				event_registration: { points: 5 },
				event_participation: { points: 20 },
				event_place_1: { points: 50 }
			});
			const user = await insertUser(tx);
			const registrationId = crypto.randomUUID();
			for (const rule of ['event_registration', 'event_participation', 'event_place_1'] as const) {
				const result = await awardPoints(tx, { rule, userId: user.id, sourceId: registrationId });
				expect(result.status, rule).toBe('awarded');
			}
			const entries = await ledgerOf(tx, user.id);
			expect(entries.map((e) => e.sourceType)).toEqual(Array(3).fill('event_registration'));
			expect(entries.map((e) => e.reason).sort()).toEqual([
				'event_participation',
				'event_place',
				'event_registration'
			]);
			expect(await balanceOf(tx, user.id)).toBe(75);
		});
	});

	it('one registration earns place points once, whatever the place', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { event_place_1: { points: 50 }, event_place_2: { points: 30 } });
			const user = await insertUser(tx);
			const sourceId = crypto.randomUUID();
			await awardPoints(tx, { rule: 'event_place_1', userId: user.id, sourceId });
			const again = await awardPoints(tx, { rule: 'event_place_2', userId: user.id, sourceId });
			expect(again).toEqual({ status: 'skipped', reason: 'duplicate' });
			expect(await balanceOf(tx, user.id)).toBe(50);
		});
	});

	it('an inactive rule or a rule with 0 or fewer points writes nothing', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, {
				certificate_judge: { points: 150, isActive: false },
				event_registration: { points: 0 },
				event_participation: { points: -5 }
			});
			const user = await insertUser(tx);
			const sourceId = crypto.randomUUID();
			const award = (rule: 'certificate_judge' | 'event_registration' | 'event_participation') =>
				awardPoints(tx, { rule, userId: user.id, sourceId });
			expect(await award('certificate_judge')).toEqual({
				status: 'skipped',
				reason: 'rule_inactive'
			});
			expect(await award('event_registration')).toEqual({ status: 'skipped', reason: 'no_points' });
			expect(await award('event_participation')).toEqual({
				status: 'skipped',
				reason: 'no_points'
			});
			expect(await ledgerOf(tx, user.id)).toHaveLength(0);
			expect(await balanceOf(tx, user.id)).toBe(0);
		});
	});

	it('the size is fixed at award time: a later rule change keeps old entries', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const user = await insertUser(tx);
			await awardPoints(tx, {
				rule: 'video_approved',
				userId: user.id,
				sourceId: crypto.randomUUID()
			});
			await setRules(tx, { video_approved: { points: 25 } });
			await awardPoints(tx, {
				rule: 'video_approved',
				userId: user.id,
				sourceId: crypto.randomUUID()
			});
			expect((await ledgerOf(tx, user.id)).map((e) => e.delta).sort()).toEqual([10, 25]);
			expect(await balanceOf(tx, user.id)).toBe(35);
			expect(await ledgerSum(tx, user.id)).toBe(35);
		});
	});

	it('a deleted or missing user gets nothing', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, { video_approved: { points: 10 } });
			const deleted = await insertUser(tx, { deletedAt: new Date() });
			for (const userId of [deleted.id, crypto.randomUUID()]) {
				const result = await awardPoints(tx, {
					rule: 'video_approved',
					userId,
					sourceId: crypto.randomUUID()
				});
				expect(result).toEqual({ status: 'skipped', reason: 'no_user' });
			}
			expect(await ledgerOf(tx, deleted.id)).toHaveLength(0);
		});
	});
});

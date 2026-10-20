import { afterAll, describe, expect, it } from 'vitest';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { adjustPoints } from './adjust';
import { awardPoints } from './award';
import { reverseEntry } from './reverse';
import { balanceOf, ledgerOf, ledgerSum, setRules, staffActor } from './test-support';

/* docs/03 section 6.3 p. 2-4: a mistake is fixed by a `reversal` of the opposite sign linked to the
 * original; one entry is reversed once; the entry itself never changes; the balance stays >= 0.
 * docs/04 5.1: reversal — admin only. */

const IP = { ip: '10.0.0.9' };

describe.skipIf(!testDbUrl)('points: reversal', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function awarded(tx: Parameters<Parameters<typeof inRollback>[0]>[0], points = 100) {
		await setRules(tx, { certificate_level_advanced: { points } });
		const user = await insertUser(tx);
		const sourceId = crypto.randomUUID();
		const result = await awardPoints(tx, {
			rule: 'certificate_level_advanced',
			userId: user.id,
			sourceId
		});
		if (result.status !== 'awarded') throw new Error(result.reason);
		return { userId: user.id, entryId: result.entryId, sourceId };
	}

	it('reverses an award: opposite delta, link, admin, comment, balance back, audit', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const { userId, entryId, sourceId } = await awarded(tx);
			const result = await reverseEntry(tx, admin, { entryId, comment: ' Wrong level ' }, IP);
			if (!result.ok) throw new Error(result.reason);
			expect(result.balance).toBe(0);
			const reversal = (await ledgerOf(tx, userId)).find((e) => e.id === result.entryId);
			expect(reversal).toMatchObject({
				delta: -100,
				reason: 'reversal',
				reversalOfId: entryId,
				comment: 'Wrong level',
				createdBy: admin.id,
				sourceType: 'certificate',
				sourceId
			});
			const original = (await ledgerOf(tx, userId)).find((e) => e.id === entryId);
			expect(original).toMatchObject({ delta: 100, reason: 'certificate' });
			expect(await balanceOf(tx, userId)).toBe(0);
			expect(await ledgerSum(tx, userId)).toBe(0);
			const audit = await auditFor(tx, 'user', userId);
			expect(audit).toHaveLength(1);
			expect(audit[0]).toMatchObject({ actorId: admin.id, action: 'points.reverse', ip: IP.ip });
			expect(audit[0].before).toEqual({ balance: 100 });
			expect(audit[0].after).toEqual({
				balance: 0,
				delta: -100,
				entryId: result.entryId,
				reversalOfId: entryId,
				comment: 'Wrong level'
			});
		});
	});

	it('an entry is reversed only once', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const { userId, entryId } = await awarded(tx);
			await adjustPoints(tx, admin, { userId, delta: 500, comment: 'Room' }, IP);
			expect((await reverseEntry(tx, admin, { entryId, comment: 'Once' }, IP)).ok).toBe(true);
			const twice = await reverseEntry(tx, admin, { entryId, comment: 'Twice' }, IP);
			expect(twice).toEqual({ ok: false, reason: 'already_reversed' });
			expect(await balanceOf(tx, userId)).toBe(500);
			expect(await ledgerOf(tx, userId)).toHaveLength(3);
		});
	});

	it('a reversal itself cannot be reversed', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const { entryId } = await awarded(tx);
			const first = await reverseEntry(tx, admin, { entryId, comment: 'Mistake' }, IP);
			if (!first.ok) throw new Error(first.reason);
			const back = await reverseEntry(tx, admin, { entryId: first.entryId, comment: 'Undo' }, IP);
			expect(back).toEqual({ ok: false, reason: 'not_reversible' });
		});
	});

	it('reversing a manual charge gives the points back', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const user = await insertUser(tx);
			await adjustPoints(tx, admin, { userId: user.id, delta: 40, comment: 'Start' }, IP);
			const charge = await adjustPoints(
				tx,
				admin,
				{ userId: user.id, delta: -30, comment: 'Oops' },
				IP
			);
			if (!charge.ok) throw new Error(charge.reason);
			const result = await reverseEntry(
				tx,
				admin,
				{ entryId: charge.entryId, comment: 'Back' },
				IP
			);
			expect(result).toMatchObject({ ok: true, balance: 40 });
			expect(await ledgerSum(tx, user.id)).toBe(40);
		});
	});

	it('spent points: a reversal below zero is refused, nothing is written', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const { userId, entryId } = await awarded(tx, 100);
			await adjustPoints(tx, admin, { userId, delta: -80, comment: 'Spent' }, IP);
			const result = await reverseEntry(tx, admin, { entryId, comment: 'Late fix' }, IP);
			expect(result).toEqual({ ok: false, reason: 'insufficient_balance' });
			expect(await balanceOf(tx, userId)).toBe(20);
			expect(await ledgerOf(tx, userId)).toHaveLength(2);
			expect(await auditFor(tx, 'user', userId)).toHaveLength(1);
		});
	});

	it('not an admin, empty comment, unknown or malformed entry — refused', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const moderator = await staffActor(tx, 'moderator');
			const { userId, entryId } = await awarded(tx);
			expect(await reverseEntry(tx, moderator, { entryId, comment: 'x' }, IP)).toEqual({
				ok: false,
				reason: 'not_allowed'
			});
			expect(await reverseEntry(tx, admin, { entryId, comment: '  ' }, IP)).toEqual({
				ok: false,
				reason: 'invalid'
			});
			for (const id of [crypto.randomUUID(), 'nope']) {
				expect(await reverseEntry(tx, admin, { entryId: id, comment: 'x' }, IP), id).toEqual({
					ok: false,
					reason: 'not_found'
				});
			}
			expect(await ledgerOf(tx, userId)).toHaveLength(1);
			expect(await balanceOf(tx, userId)).toBe(100);
		});
	});
});

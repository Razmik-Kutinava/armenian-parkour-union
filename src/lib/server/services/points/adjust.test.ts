import { afterAll, describe, expect, it } from 'vitest';
import type { UserRole } from '../../auth/session';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { auditFor } from '../memberships/test-support';
import { adjustPoints } from './adjust';
import { balanceOf, ledgerOf, ledgerSum, staffActor } from './test-support';

/* docs/03 section 6.3: an admin adds or takes points by hand (`manual`) with a comment; every
 * manual operation goes to the audit log; the balance never goes below zero. docs/04 5.1:
 * `points.adjust` — admin only, checked by the service itself. */

const IP = { ip: '10.0.0.9' };

describe.skipIf(!testDbUrl)('points: manual adjustment', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('admin adds points: manual entry by the admin, trimmed comment, balance, audit with IP', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const user = await insertUser(tx);
			const input = { userId: user.id, delta: 50, comment: '  Helped at the jam  ' };
			const result = await adjustPoints(tx, admin, input, IP);
			if (!result.ok) throw new Error(result.reason);
			expect(result.balance).toBe(50);
			const [entry] = await ledgerOf(tx, user.id);
			expect(entry).toMatchObject({
				id: result.entryId,
				delta: 50,
				reason: 'manual',
				comment: 'Helped at the jam',
				createdBy: admin.id,
				ruleId: null,
				sourceType: null,
				sourceId: null
			});
			expect(await balanceOf(tx, user.id)).toBe(50);
			const audit = await auditFor(tx, 'user', user.id);
			expect(audit).toHaveLength(1);
			expect(audit[0]).toMatchObject({ actorId: admin.id, action: 'points.adjust', ip: IP.ip });
			expect(audit[0].before).toEqual({ balance: 0 });
			expect(audit[0].after).toEqual({
				balance: 50,
				delta: 50,
				entryId: result.entryId,
				comment: 'Helped at the jam'
			});
		});
	});

	it('takes points within the balance; below zero is refused and nothing is written', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const user = await insertUser(tx);
			await adjustPoints(tx, admin, { userId: user.id, delta: 40, comment: 'Start' }, IP);
			const take = await adjustPoints(
				tx,
				admin,
				{ userId: user.id, delta: -30, comment: 'Fix' },
				IP
			);
			expect(take).toMatchObject({ ok: true, balance: 10 });
			const tooMuch = await adjustPoints(
				tx,
				admin,
				{ userId: user.id, delta: -11, comment: 'No' },
				IP
			);
			expect(tooMuch).toEqual({ ok: false, reason: 'insufficient_balance' });
			expect(await balanceOf(tx, user.id)).toBe(10);
			expect(await ledgerOf(tx, user.id)).toHaveLength(2);
			expect(await ledgerSum(tx, user.id)).toBe(10);
			expect(await auditFor(tx, 'user', user.id)).toHaveLength(2);
		});
	});

	it('the same manual operation can repeat (no source, no once-only rule)', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const user = await insertUser(tx);
			const input = { userId: user.id, delta: 5, comment: 'Bonus' };
			expect((await adjustPoints(tx, admin, input, IP)).ok).toBe(true);
			expect((await adjustPoints(tx, admin, input, IP)).ok).toBe(true);
			expect(await balanceOf(tx, user.id)).toBe(10);
		});
	});

	it('moderator, editor and member cannot adjust; nothing is written', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx);
			for (const role of ['moderator', 'editor', 'member'] as UserRole[]) {
				const actor = await staffActor(tx, role);
				const result = await adjustPoints(
					tx,
					actor,
					{ userId: user.id, delta: 5, comment: 'x' },
					IP
				);
				expect(result, role).toEqual({ ok: false, reason: 'not_allowed' });
			}
			expect(await ledgerOf(tx, user.id)).toHaveLength(0);
			expect(await auditFor(tx, 'user', user.id)).toHaveLength(0);
		});
	});

	it('zero, fractional, out-of-range amounts and an empty comment are invalid', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const user = await insertUser(tx);
			for (const [delta, comment] of [
				[0, 'zero'],
				[1.5, 'fraction'],
				[Number.NaN, 'nan'],
				[2_147_483_648, 'too big'],
				[-2_147_483_649, 'too small'],
				[5, '   ']
			] as const) {
				const result = await adjustPoints(tx, admin, { userId: user.id, delta, comment }, IP);
				expect(result, `${delta} / ${comment}`).toEqual({ ok: false, reason: 'invalid' });
			}
			expect(await ledgerOf(tx, user.id)).toHaveLength(0);
		});
	});

	it('missing, deleted or malformed user — not found; a blocked user can be adjusted', async () => {
		await inRollback(async (tx) => {
			const admin = await staffActor(tx);
			const deleted = await insertUser(tx, { deletedAt: new Date() });
			for (const userId of [crypto.randomUUID(), deleted.id, 'not-a-uuid']) {
				const result = await adjustPoints(tx, admin, { userId, delta: 5, comment: 'x' }, IP);
				expect(result, userId).toEqual({ ok: false, reason: 'not_found' });
			}
			const blocked = await insertUser(tx, { status: 'blocked' });
			const result = await adjustPoints(
				tx,
				admin,
				{ userId: blocked.id, delta: 5, comment: 'x' },
				IP
			);
			expect(result.ok).toBe(true);
		});
	});
});

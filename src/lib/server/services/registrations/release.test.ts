import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { createMockProvider } from '../payments/providers/mock';
import { expireHold, feeEffects, paidEvent, payStarted, settleFee } from './pay-support';
import { releaseExpiredHolds } from './release';
import {
	HOUR,
	SETTINGS,
	cancelDeps,
	insertMember,
	mailbox,
	registerOk,
	registrationOf
} from './test-support';

/* docs/03 section 7.4, docs/07 section 5.3 p. 4: an unpaid registration gives its seat back when
 * the hold ends; the first in line gets it with `offer_hours` to pay (docs/03 section 7.3). */

describe.skipIf(!testDbUrl)('registrations: releasing expired holds', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('hold over, never paid: cancelled and told, the first in line gets the seat and a letter', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx, { capacity: 1 });
			const [a, b] = [await insertMember(tx), await insertMember(tx)];
			const held = await registerOk(tx, a.id, event.id);
			const queued = await registerOk(tx, b.id, event.id);
			await expireHold(tx, held.id);
			const box = mailbox();
			const now = new Date();
			expect(await releaseExpiredHolds(tx, cancelDeps(box), now)).toBeGreaterThanOrEqual(1);
			expect(await registrationOf(tx, held.id)).toMatchObject({
				status: 'cancelled',
				holdUntil: null
			});
			const promoted = await registrationOf(tx, queued.id);
			expect(promoted.status).toBe('pending_payment');
			expect(promoted.holdUntil!.getTime()).toBe(now.getTime() + SETTINGS.offerHours * HOUR);
			expect(box.sent.map((m) => m.to)).toEqual([a.email, b.email]);
		});
	});

	it('hold still running: untouched', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx);
			const member = await insertMember(tx);
			const { id } = await registerOk(tx, member.id, event.id);
			await releaseExpiredHolds(tx, cancelDeps());
			expect((await registrationOf(tx, id)).status).toBe('pending_payment');
		});
	});

	it('hold over with a payment still at the provider: left to reconciliation', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx);
			const { registrationId } = await payStarted(tx, createMockProvider(), event.id);
			await expireHold(tx, registrationId);
			await releaseExpiredHolds(tx, cancelDeps());
			expect((await registrationOf(tx, registrationId)).status).toBe('pending_payment');
		});
	});

	it('hold over after a failed or cancelled payment: released', async () => {
		await inRollback(async (tx) => {
			const mock = createMockProvider();
			const effects = feeEffects();
			const event = await paidEvent(tx);
			const ids: string[] = [];
			for (const status of ['failed', 'cancelled'] as const) {
				const { registrationId, payment } = await payStarted(tx, mock, event.id);
				await settleFee(tx, mock, payment.id, status, effects);
				await expireHold(tx, registrationId);
				ids.push(registrationId);
			}
			await releaseExpiredHolds(tx, cancelDeps());
			for (const id of ids) expect((await registrationOf(tx, id)).status).toBe('cancelled');
		});
	});
});

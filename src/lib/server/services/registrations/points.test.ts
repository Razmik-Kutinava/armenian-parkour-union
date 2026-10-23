import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { events } from '../../db/schema/events';
import { testDb, testDbUrl } from '../../db/test-db';
import { createMockProvider } from '../payments/providers/mock';
import { appendEntry } from '../points/ledger';
import { balanceOf, ledgerOf, ledgerSum, setRules } from '../points/test-support';
import { cancelRegistration } from './cancel';
import { feeEffects, paidEvent, payStarted, settleFee } from './pay-support';
import {
	HOUR,
	cancelDeps as deps,
	insertEvent,
	insertMember,
	registerOk as register
} from './test-support';

/* docs/03 section 6.2 p. 5-6: points for a registration made on the site once it is active (a paid
 * one — after the payment); cancelled before the start — taken back by a reversal. */

type Tx = Parameters<typeof setRules>[0];
const rules = (tx: Tx) => setRules(tx, { event_registration: { points: 5 } });

/* `setRules` holds the rules table lock until the rollback: other files' tests queue on it. */
describe.skipIf(!testDbUrl)(
	'registrations: points for the registration',
	{ timeout: 60_000 },
	() => {
		const { inRollback, close } = testDb();
		afterAll(close);

		it('a free registration earns the rule points once, the registration is the source', async () => {
			await inRollback(async (tx) => {
				await rules(tx);
				const event = await insertEvent(tx);
				const member = await insertMember(tx);
				const { id } = await register(tx, member.id, event.id);
				expect(await ledgerOf(tx, member.id)).toMatchObject([
					{
						delta: 5,
						reason: 'event_registration',
						sourceType: 'event_registration',
						sourceId: id,
						createdBy: null
					}
				]);
				expect(await balanceOf(tx, member.id)).toBe(5);
			});
		});

		it('waitlist and an unpaid seat earn nothing; the paid seat earns on the payment', async () => {
			await inRollback(async (tx) => {
				await rules(tx);
				const mock = createMockProvider();
				const full = await insertEvent(tx, { capacity: 1 });
				await register(tx, (await insertMember(tx)).id, full.id);
				const queued = await insertMember(tx);
				expect((await register(tx, queued.id, full.id)).status).toBe('waitlist');
				expect(await ledgerOf(tx, queued.id)).toHaveLength(0);

				const event = await paidEvent(tx);
				const { member, payment } = await payStarted(tx, mock, event.id);
				expect(await ledgerOf(tx, member.id)).toHaveLength(0);
				await settleFee(tx, mock, payment.id, 'paid', feeEffects());
				expect(await balanceOf(tx, member.id)).toBe(5);
			});
		});

		it('the first in line who gets a free seat earns the points', async () => {
			await inRollback(async (tx) => {
				await rules(tx);
				const event = await insertEvent(tx, { capacity: 1 });
				const [a, b] = [await insertMember(tx), await insertMember(tx)];
				await register(tx, a.id, event.id);
				await register(tx, b.id, event.id);
				expect(await cancelRegistration(tx, a.id, event.id, deps())).toBe('ok');
				expect(await balanceOf(tx, b.id)).toBe(5);
			});
		});

		it('cancelled before the start: a system reversal; registering again earns nothing', async () => {
			await inRollback(async (tx) => {
				await rules(tx);
				const event = await insertEvent(tx);
				const member = await insertMember(tx, { locale: 'ru' });
				await register(tx, member.id, event.id);
				expect(await cancelRegistration(tx, member.id, event.id, deps())).toBe('ok');
				const entries = await ledgerOf(tx, member.id);
				const award = entries.find((e) => e.reason === 'event_registration')!;
				const reversal = entries.find((e) => e.reason === 'reversal')!;
				expect(reversal).toMatchObject({
					delta: -5,
					reason: 'reversal',
					reversalOfId: award.id,
					sourceType: 'event_registration',
					sourceId: award.sourceId,
					createdBy: null
				});
				expect(reversal.comment).toContain('Весенний джем');
				expect(await balanceOf(tx, member.id)).toBe(0);

				await register(tx, member.id, event.id);
				expect(await cancelRegistration(tx, member.id, event.id, deps())).toBe('ok');
				expect(await ledgerOf(tx, member.id)).toHaveLength(2);
				expect(await ledgerSum(tx, member.id)).toBe(0);
				expect(await balanceOf(tx, member.id)).toBe(0);
			});
		});

		it('leaving the waitlist writes nothing', async () => {
			await inRollback(async (tx) => {
				await rules(tx);
				const event = await insertEvent(tx, { capacity: 1 });
				await register(tx, (await insertMember(tx)).id, event.id);
				const queued = await insertMember(tx);
				await register(tx, queued.id, event.id);
				expect(await cancelRegistration(tx, queued.id, event.id, deps())).toBe('ok');
				expect(await ledgerOf(tx, queued.id)).toHaveLength(0);
			});
		});

		it('points already spent: the cancel goes through, no reversal, the balance stays >= 0', async () => {
			await inRollback(async (tx) => {
				await rules(tx);
				const event = await insertEvent(tx);
				const member = await insertMember(tx);
				await register(tx, member.id, event.id);
				await appendEntry(tx, {
					userId: member.id,
					delta: -5,
					reason: 'manual',
					comment: 'spent',
					createdBy: null
				});
				const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
				expect(await cancelRegistration(tx, member.id, event.id, deps())).toBe('ok');
				expect(warn).toHaveBeenCalled();
				warn.mockRestore();
				expect((await ledgerOf(tx, member.id)).map((e) => e.reason).sort()).toEqual([
					'event_registration',
					'manual'
				]);
				expect(await balanceOf(tx, member.id)).toBe(0);
			});
		});

		it('refunded before the start — taken back; after the start — kept', async () => {
			await inRollback(async (tx) => {
				await rules(tx);
				const mock = createMockProvider();
				const effects = feeEffects();
				const early = await paidEvent(tx);
				const before = await payStarted(tx, mock, early.id);
				await settleFee(tx, mock, before.payment.id, 'paid', effects);
				await settleFee(tx, mock, before.payment.id, 'refunded', effects);
				const deltas = (await ledgerOf(tx, before.member.id)).map((e) => e.delta);
				expect(deltas.sort((a, b) => a - b)).toEqual([-5, 5]);

				const late = await paidEvent(tx);
				const after = await payStarted(tx, mock, late.id);
				await settleFee(tx, mock, after.payment.id, 'paid', effects);
				await tx
					.update(events)
					.set({ startsAt: new Date(Date.now() - HOUR) })
					.where(eq(events.id, late.id));
				await settleFee(tx, mock, after.payment.id, 'refunded', effects);
				expect(await balanceOf(tx, after.member.id)).toBe(5);
			});
		});

		it('the rule switched off: the registration goes on without points', async () => {
			await inRollback(async (tx) => {
				await setRules(tx, { event_registration: { points: 5, isActive: false } });
				const event = await insertEvent(tx);
				const member = await insertMember(tx);
				expect((await register(tx, member.id, event.id)).status).toBe('registered');
				expect(await ledgerOf(tx, member.id)).toHaveLength(0);
			});
		});
	}
);

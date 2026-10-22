import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { eventRegistrations } from '../../db/schema/registrations';
import { testDb, testDbUrl } from '../../db/test-db';
import { registerForEvent } from './register';
import {
	SETTINGS,
	insertCategory,
	insertEvent,
	insertMember,
	registrationOf,
	registrationsOf
} from './test-support';

/* docs/03 section 7.3–7.4, docs/02 section 3: the status by the limit and the price, one row. */

const deps = { settings: SETTINGS };
const MINUTE = 60_000;

describe.skipIf(!testDbUrl)('registrations: register', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('a free event: registered, no hold, no category', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const member = await insertMember(tx);
			const result = await registerForEvent(
				tx,
				member.id,
				{ eventId: event.id, categoryId: null },
				deps
			);
			expect(result).toMatchObject({ ok: true, status: 'registered', holdUntil: null });
			const [row] = await registrationsOf(tx, event.id);
			expect(row).toMatchObject({
				userId: member.id,
				status: 'registered',
				categoryId: null,
				holdUntil: null,
				paymentId: null
			});
		});
	});

	it('a paid event: waits for payment and holds the seat for hold_minutes', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { priceAmountMinor: 5000 });
			const member = await insertMember(tx);
			const before = Date.now();
			const result = await registerForEvent(
				tx,
				member.id,
				{ eventId: event.id, categoryId: null },
				deps
			);
			expect(result).toMatchObject({ ok: true, status: 'pending_payment' });
			const [row] = await registrationsOf(tx, event.id);
			expect(row.status).toBe('pending_payment');
			const hold = row.holdUntil!.getTime();
			expect(hold).toBeGreaterThanOrEqual(before + 30 * MINUTE - 1000);
			expect(hold).toBeLessThanOrEqual(Date.now() + 30 * MINUTE + 1000);
		});
	});

	it('the limit: when full the next one waits; an unpaid seat counts', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 2, priceAmountMinor: 5000 });
			const [a, b, c] = [await insertMember(tx), await insertMember(tx), await insertMember(tx)];
			const input = { eventId: event.id, categoryId: null };
			expect(await registerForEvent(tx, a.id, input, deps)).toMatchObject({
				status: 'pending_payment'
			});
			await tx
				.update(eventRegistrations)
				.set({ status: 'registered', holdUntil: null })
				.where(eq(eventRegistrations.userId, a.id));
			expect(await registerForEvent(tx, b.id, input, deps)).toMatchObject({
				status: 'pending_payment'
			});
			expect(await registerForEvent(tx, c.id, input, deps)).toMatchObject({
				ok: true,
				status: 'waitlist',
				holdUntil: null
			});
		});
	});

	it('a full category puts its members on the waitlist; other categories still register', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx, { capacity: 10 });
			const small = await insertCategory(tx, event.id, { capacity: 1 });
			const open = await insertCategory(tx, event.id);
			const [a, b, c] = [await insertMember(tx), await insertMember(tx), await insertMember(tx)];
			const into = (categoryId: string) => ({ eventId: event.id, categoryId });
			expect(await registerForEvent(tx, a.id, into(small.id), deps)).toMatchObject({
				status: 'registered'
			});
			expect(await registerForEvent(tx, b.id, into(small.id), deps)).toMatchObject({
				status: 'waitlist'
			});
			expect(await registerForEvent(tx, c.id, into(open.id), deps)).toMatchObject({
				status: 'registered'
			});
		});
	});

	it('twice — refused; after a cancel the same row comes back, results cleared', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const member = await insertMember(tx);
			const input = { eventId: event.id, categoryId: null };
			const first = await registerForEvent(tx, member.id, input, deps);
			if (!first.ok) throw new Error(first.reason);
			expect(await registerForEvent(tx, member.id, input, deps)).toEqual({
				ok: false,
				reason: 'already_registered'
			});
			const old = await registrationOf(tx, first.id);
			await tx
				.update(eventRegistrations)
				.set({ status: 'cancelled', place: 3, resultNote: 'x' })
				.where(eq(eventRegistrations.id, first.id));
			const again = await registerForEvent(tx, member.id, input, deps);
			expect(again).toMatchObject({ ok: true, id: first.id, status: 'registered' });
			const row = await registrationOf(tx, first.id);
			expect(row).toMatchObject({ status: 'registered', place: null, resultNote: null });
			expect(row.registeredAt.getTime()).toBeGreaterThan(old.registeredAt.getTime());
			expect(await registrationsOf(tx, event.id)).toHaveLength(1);
		});
	});
});

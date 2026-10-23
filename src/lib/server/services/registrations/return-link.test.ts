import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { events } from '../../db/schema/events';
import { testDb, testDbUrl } from '../../db/test-db';
import { createMockProvider } from '../payments/providers/mock';
import { paidEvent, payStarted } from './pay-support';
import { eventSlugForPayment } from './return-link';

/* docs/06 section 9: a failed event fee is tried again on the page of its event. */

describe.skipIf(!testDbUrl)('registrations: the way back from the payment page', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the event of the registration while the event is on the site; otherwise null', async () => {
		await inRollback(async (tx) => {
			const event = await paidEvent(tx);
			const { payment } = await payStarted(tx, createMockProvider(), event.id);
			expect(await eventSlugForPayment(tx, payment.id)).toBe(event.slug);

			await tx.update(events).set({ status: 'archived' }).where(eq(events.id, event.id));
			expect(await eventSlugForPayment(tx, payment.id)).toBeNull();

			expect(await eventSlugForPayment(tx, crypto.randomUUID())).toBeNull();
			expect(await eventSlugForPayment(tx, 'nope')).toBeNull();
		});
	});
});

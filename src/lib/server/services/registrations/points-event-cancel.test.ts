import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { events } from '../../db/schema/events';
import { eventRegistrations } from '../../db/schema/registrations';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { cancelEvent } from '../events/lifecycle';
import { balanceOf, ledgerOf, setRules } from '../points/test-support';
import { HOUR, insertEvent, insertMember, registerOk as register } from './test-support';

/* docs/03 section 6.2 p. 6: the event is cancelled before the start — the registration points go
 * back like on the member's own cancel; after the start, or after "attended", they stay. */

const IP = '198.51.100.7';
type Tx = Parameters<typeof setRules>[0];
const rules = (tx: Tx) => setRules(tx, { event_registration: { points: 5 } });
const adminOf = async (tx: Tx) => ({
	id: (await insertUser(tx, { role: 'admin' })).id,
	role: 'admin' as const
});

describe.skipIf(!testDbUrl)('registrations: points when the event is cancelled', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('before the start: a system reversal in the member’s language', async () => {
		await inRollback(async (tx) => {
			await rules(tx);
			const event = await insertEvent(tx);
			const member = await insertMember(tx, { locale: 'ru' });
			await register(tx, member.id, event.id);
			expect(await balanceOf(tx, member.id)).toBe(5);
			expect(await cancelEvent(tx, await adminOf(tx), event.id, 'Bad weather', IP)).toBe('ok');
			const reversal = (await ledgerOf(tx, member.id)).find((e) => e.reason === 'reversal');
			expect(reversal).toMatchObject({ delta: -5, createdBy: null });
			expect(reversal?.comment).toContain('Весенний джем');
			expect(await balanceOf(tx, member.id)).toBe(0);
		});
	});

	it('after the start, or marked "attended": the points stay', async () => {
		await inRollback(async (tx) => {
			await rules(tx);
			const event = await insertEvent(tx);
			const [late, came] = [await insertMember(tx), await insertMember(tx)];
			await register(tx, late.id, event.id);
			const attended = await register(tx, came.id, event.id);
			await tx
				.update(eventRegistrations)
				.set({ status: 'attended' })
				.where(eq(eventRegistrations.id, attended.id));
			await tx
				.update(events)
				.set({ startsAt: new Date(Date.now() - HOUR) })
				.where(eq(events.id, event.id));
			expect(await cancelEvent(tx, await adminOf(tx), event.id, 'Storm', IP)).toBe('ok');
			expect(await balanceOf(tx, late.id)).toBe(5);
			expect(await balanceOf(tx, came.id)).toBe(5);
		});
	});
});

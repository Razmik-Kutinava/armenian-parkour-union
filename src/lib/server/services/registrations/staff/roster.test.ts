import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { eventRegistrations } from '../../../db/schema/registrations';
import { testDb, testDbUrl } from '../../../db/test-db';
import {
	bornBefore,
	insertCategory,
	insertEvent,
	insertMember,
	registerOk as register
} from '../test-support';
import { eventRoster } from './roster';

/* docs/05 section 5 "Event day": the people expected or already marked, by name; name, age and
 * category only — no contacts, no birth date (docs/04 section 4). */

describe.skipIf(!testDbUrl)('registrations staff: event day roster', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('registered, came and did not come — by name; the waitlist and cancelled are not there', async () => {
		await inRollback(async (tx) => {
			const event = await insertEvent(tx);
			const category = await insertCategory(tx, event.id);
			const add = async (
				name: string,
				status: (typeof eventRegistrations.$inferSelect)['status']
			) => {
				const member = await insertMember(tx, { name, birthDate: bornBefore(25) });
				const { id } = await register(tx, member.id, event.id, category.id);
				await tx.update(eventRegistrations).set({ status }).where(eq(eventRegistrations.id, id));
				return id;
			};
			const zara = await add('Zara Test', 'registered');
			const anna = await add('Anna Test', 'attended');
			const mark = await add('Mark Test', 'no_show');
			await add('Bob Test', 'waitlist');
			await add('Carl Test', 'cancelled');
			await add('Dina Test', 'pending_payment');

			const roster = await eventRoster(tx, event.id);
			expect(roster?.map((r) => r.id)).toEqual([anna, mark, zara]);
			expect(roster?.[0]).toMatchObject({
				name: 'Anna Test',
				age: 25,
				status: 'attended',
				categoryName: { en: 'Speed' },
				place: null,
				score: null
			});
			for (const key of ['email', 'birthDate', 'phone'])
				expect(roster?.[0]).not.toHaveProperty(key);
		});
	});

	it('no such event — null', async () => {
		await inRollback(async (tx) => {
			expect(await eventRoster(tx, crypto.randomUUID())).toBeNull();
			expect(await eventRoster(tx, 'nope')).toBeNull();
		});
	});
});

import { afterAll, describe, expect, it } from 'vitest';
import { readListState } from '#lib/components/admin/list-state.ts';
import type { LimitDb } from '../../auth/rate-limit';
import { events } from '../../db/schema/events';
import { testDb, testDbUrl } from '../../db/test-db';
import { eventListOptions, listEventCities, listEvents } from './list';

const DAY = 86_400_000;
const state = (query: string) => readListState(new URLSearchParams(query), eventListOptions);

describe.skipIf(!testDbUrl)('events: admin list (docs/05 section 5)', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const add = async (
		tx: LimitDb,
		tag: string,
		values: Partial<typeof events.$inferInsert> = {}
	) => {
		const startsAt = values.startsAt ?? new Date(Date.now() + 7 * DAY);
		const [row] = await tx
			.insert(events)
			.values({
				slug: `t-${crypto.randomUUID().slice(0, 8)}`,
				title: { en: `Jam ${tag}` },
				startsAt,
				endsAt: new Date(startsAt.getTime() + 3_600_000),
				...values
			})
			.returning();
		return row;
	};
	const ids = async (tx: LimitDb, query: string) =>
		(await listEvents(tx, state(query))).rows.map((r) => r.id).sort();

	it('searches the title; filters by status, period, city, free / paid; hides deleted', async () => {
		await inRollback(async (tx) => {
			const tag = crypto.randomUUID().slice(0, 8);
			const draft = await add(tx, tag, { city: 'Yerevan', priceAmountMinor: 0 });
			const live = await add(tx, tag, {
				status: 'published',
				city: 'Gyumri',
				priceAmountMinor: 3000,
				capacity: 30,
				locationName: 'Park'
			});
			const past = await add(tx, tag, {
				status: 'finished',
				city: 'Yerevan',
				startsAt: new Date(Date.now() - 10 * DAY)
			});
			await add(tx, tag, { deletedAt: new Date() });

			expect(await ids(tx, `q=${tag}`)).toEqual([draft.id, live.id, past.id].sort());
			expect(await ids(tx, `q=${tag}&status=published`)).toEqual([live.id]);
			expect(await ids(tx, `q=${tag}&period=upcoming`)).toEqual([draft.id, live.id].sort());
			expect(await ids(tx, `q=${tag}&period=past`)).toEqual([past.id]);
			expect(await ids(tx, `q=${tag}&city=Gyumri`)).toEqual([live.id]);
			expect(await ids(tx, `q=${tag}&price=paid`)).toEqual([live.id]);
			expect(await ids(tx, `q=${tag}&price=free`)).toEqual([draft.id, past.id].sort());
			expect(await ids(tx, `q=${tag}&status=bogus`)).toHaveLength(3);

			const { rows } = await listEvents(tx, state(`q=${tag}&status=published`));
			expect(rows[0]).toMatchObject({
				id: live.id,
				slug: live.slug,
				title: { en: `Jam ${tag}` },
				status: 'published',
				city: 'Gyumri',
				locationName: 'Park',
				capacity: 30,
				priceAmountMinor: 3000,
				priceCurrency: 'AMD',
				startsAt: live.startsAt,
				endsAt: live.endsAt
			});
		});
	});

	it('cities for the filter: distinct, from events not deleted', async () => {
		await inRollback(async (tx) => {
			const city = `City ${crypto.randomUUID().slice(0, 6)}`;
			const tag = crypto.randomUUID().slice(0, 8);
			await add(tx, tag, { city });
			await add(tx, tag, { city });
			await add(tx, tag, { city: `${city} gone`, deletedAt: new Date() });
			const cities = await listEventCities(tx);
			expect(cities.filter((c) => c.startsWith(city))).toEqual([city]);
		});
	});
});

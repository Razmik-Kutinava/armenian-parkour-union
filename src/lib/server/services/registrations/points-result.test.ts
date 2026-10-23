import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { eventRegistrations } from '../../db/schema/registrations';
import { testDb, testDbUrl } from '../../db/test-db';
import { balanceOf, ledgerOf, setRules } from '../points/test-support';
import { awardEventResult } from './points';
import { insertEvent, insertMember, registerOk as register, registrationOf } from './test-support';

/* docs/03 section 6.1, 7.6-7.7: "attended" earns participation; a place 1-3 adds its points along
 * with it (winner: 5 + 20 + 50); each — once per registration. Called by the results admin (5.7). */

type Tx = Parameters<typeof setRules>[0];

const RULES = {
	event_registration: { points: 5 },
	event_participation: { points: 20 },
	event_place_1: { points: 50 },
	event_place_2: { points: 30 },
	event_place_3: { points: 20 }
};

async function withResult(
	tx: Tx,
	eventId: string,
	status: 'attended' | 'no_show' | 'registered',
	place: number | null
) {
	const member = await insertMember(tx);
	const { id } = await register(tx, member.id, eventId);
	await tx
		.update(eventRegistrations)
		.set({ status, place, attendedAt: status === 'attended' ? new Date() : null })
		.where(eq(eventRegistrations.id, id));
	return { member, registration: await registrationOf(tx, id) };
}

describe.skipIf(!testDbUrl)('registrations: points for the result', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('the winner: registration, participation and place add up; a repeat adds nothing', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const event = await insertEvent(tx);
			const { member, registration } = await withResult(tx, event.id, 'attended', 1);
			await awardEventResult(tx, registration);
			await awardEventResult(tx, registration);
			expect(await balanceOf(tx, member.id)).toBe(75);
			expect((await ledgerOf(tx, member.id)).map((e) => e.reason).sort()).toEqual([
				'event_participation',
				'event_place',
				'event_registration'
			]);
			expect(new Set((await ledgerOf(tx, member.id)).map((e) => e.sourceId))).toEqual(
				new Set([registration.id])
			);
		});
	});

	it('places 2 and 3 by their rules, other places — participation only', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const event = await insertEvent(tx);
			for (const [place, total] of [
				[2, 55],
				[3, 45],
				[4, 25],
				[null, 25]
			] as const) {
				const { member, registration } = await withResult(tx, event.id, 'attended', place);
				await awardEventResult(tx, registration);
				expect(await balanceOf(tx, member.id), `place ${place}`).toBe(total);
			}
		});
	});

	it('not marked "attended" (no-show or still registered): no result points', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const event = await insertEvent(tx);
			for (const status of ['no_show', 'registered'] as const) {
				const { member, registration } = await withResult(tx, event.id, status, 1);
				await awardEventResult(tx, registration);
				expect(await balanceOf(tx, member.id), status).toBe(5);
			}
		});
	});

	it('a place changed after the award: no second place points (fixed by hand, 7.7)', async () => {
		await inRollback(async (tx) => {
			await setRules(tx, RULES);
			const event = await insertEvent(tx);
			const { member, registration } = await withResult(tx, event.id, 'attended', 2);
			await awardEventResult(tx, registration);
			await awardEventResult(tx, { ...registration, place: 1 });
			expect(await balanceOf(tx, member.id)).toBe(55);
		});
	});
});

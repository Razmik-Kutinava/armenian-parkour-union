import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { testDbUrl } from '../../db/test-db';
import { perkRedemptions } from '../../db/schema/volunteer-cards';
import { markPerk } from './perk-mark';
import { volunteerRaceDb } from './race-support';

/* docs/03 section 19.4 p. 4, roadmap 10.11: two cashiers race for the last use of a single perk
 * on the same card — one mark, the other no_uses_left. Commits (race-support.ts). */

describe.skipIf(!testDbUrl)('volunteer: simultaneous single-perk marks', () => {
	const db = volunteerRaceDb();
	afterAll(db.cleanup);

	it('last use, two cashiers at once: one mark, one refused', async () => {
		const { token, perkId, partnerId, cardId, cashiers } = await db.singlePerkScene(1);
		const [a, b] = cashiers;
		const [first, second] = await db.race(
			(tx) => markPerk(tx, token, a, partnerId, perkId),
			(tx) => markPerk(tx, token, b, partnerId, perkId)
		);
		expect(first).toMatchObject({ ok: true });
		expect(second).toEqual({ ok: false, reason: 'no_uses_left' });
		const marks = await db.main
			.select({ id: perkRedemptions.id })
			.from(perkRedemptions)
			.where(
				and(
					eq(perkRedemptions.cardId, cardId),
					eq(perkRedemptions.perkId, perkId),
					isNull(perkRedemptions.reversalOfId)
				)
			);
		expect(marks).toHaveLength(1);
		const [{ used }] = await db.main.execute<{ used: string }>(sql`
			select (count(*) filter (where reversal_of_id is null)
				- count(*) filter (where reversal_of_id is not null))::text as used
			from perk_redemptions where card_id = ${cardId} and perk_id = ${perkId}`);
		expect(Number(used)).toBe(1);
	});
});

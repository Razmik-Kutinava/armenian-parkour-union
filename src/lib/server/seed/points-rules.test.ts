import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { localizedText } from '#lib/validation/site-settings.ts';
import { pointsRules } from '../db/schema/points';
import { testDb, testDbUrl } from '../db/test-db';
import { SEED_POINTS_RULES, seedPointsRules } from './points-rules';

/* docs/03 section 6.1 (approved 2026-10-06); codes — docs/02 section 5. */
const POINTS = {
	certificate_level_advanced: 100,
	certificate_level_pro: 200,
	certificate_trainer: 150,
	certificate_judge: 150,
	event_registration: 5,
	event_participation: 20,
	event_place_1: 50,
	event_place_2: 30,
	event_place_3: 20,
	video_approved: 10
};
const CODES = Object.keys(POINTS);

describe('seed: points rules values', () => {
	it('every code from docs/02 with the points from docs/03 section 6.1', () => {
		const seeded = Object.fromEntries(
			Object.entries(SEED_POINTS_RULES).map(([code, rule]) => [code, rule.points])
		);
		expect(seeded).toEqual(POINTS);
	});

	it('winner gets 5 + 20 + 50 = 75 (docs/03 section 6.1)', () => {
		const r = SEED_POINTS_RULES;
		expect(
			r.event_registration.points + r.event_participation.points + r.event_place_1.points
		).toBe(75);
	});

	it('titles in all three languages', () => {
		for (const [code, rule] of Object.entries(SEED_POINTS_RULES)) {
			expect(localizedText(200).safeParse(rule.title).success, code).toBe(true);
			expect(Object.keys(rule.title).sort(), code).toEqual(['en', 'hy', 'ru']);
		}
	});
});

describe.skipIf(!testDbUrl)('seed: points rules in the database', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('adds missing rules as active and never overwrites one edited by the owner', async () => {
		await inRollback(async (tx) => {
			// The ledger refers to the rules and is append-only: the rows stay, their codes move aside.
			await tx
				.update(pointsRules)
				.set({ code: sql`'old-' || ${pointsRules.id}` })
				.where(inArray(pointsRules.code, CODES));
			const edited = { code: 'video_approved', title: { en: 'Video' }, points: 0, isActive: false };
			await tx.insert(pointsRules).values(edited);

			const added = await seedPointsRules(tx);
			expect(added.sort()).toEqual(CODES.filter((c) => c !== 'video_approved').sort());
			const rows = await tx.select().from(pointsRules).where(inArray(pointsRules.code, CODES));
			for (const row of rows.filter((r) => r.code !== 'video_approved')) {
				expect(row, row.code).toMatchObject({
					points: POINTS[row.code as keyof typeof POINTS],
					title: SEED_POINTS_RULES[row.code].title,
					isActive: true,
					updatedBy: null
				});
			}
			const [video] = await tx
				.select()
				.from(pointsRules)
				.where(eq(pointsRules.code, 'video_approved'));
			expect(video).toMatchObject(edited);

			expect(await seedPointsRules(tx)).toEqual([]);
		});
	});
});

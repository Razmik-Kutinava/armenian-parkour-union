import { afterAll, describe, expect, it } from 'vitest';
import { testDb, testDbUrl } from '../../db/test-db';
import { archiveHeroBlock } from './edit';
import { listHeroBlocks } from './list';
import { IP, clearHero, createdHero, heroValues, staff } from './test-support';

/* docs/05 section 4: cards in order; filters type and active; archive apart. */

describe.skipIf(!testDbUrl)('hero: admin list', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	it('current blocks by order, archive separately, filters by type and active', async () => {
		await inRollback(async (tx) => {
			await clearHero(tx);
			const actor = await staff(tx);
			const a = await createdHero(tx, actor, heroValues({ title: { en: 'A' }, isActive: true }));
			const b = await createdHero(tx, actor, heroValues({ type: 'presentation' }));
			const old = await createdHero(tx, actor, heroValues({ title: { en: 'Old' } }));
			expect(await archiveHeroBlock(tx, actor, old, IP)).toBe('ok');

			expect((await listHeroBlocks(tx, {})).map((r) => r.id)).toEqual([a, b]);
			expect((await listHeroBlocks(tx, { archived: true })).map((r) => r.id)).toEqual([old]);
			expect((await listHeroBlocks(tx, { type: 'presentation' })).map((r) => r.id)).toEqual([b]);
			expect((await listHeroBlocks(tx, { active: true })).map((r) => r.id)).toEqual([a]);
			expect((await listHeroBlocks(tx, {}))[0]).toMatchObject({
				id: a,
				type: 'custom',
				title: { en: 'A' },
				isActive: true,
				startsAt: null,
				endsAt: null,
				mediaKey: null,
				onHome: true
			});
		});
	});
});
